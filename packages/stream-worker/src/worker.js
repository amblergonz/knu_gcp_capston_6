const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
const { Engine } = require('json-rules-engine');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const SESSION_TTL_SECONDS = parseInt(process.env.SESSION_TTL_SECONDS || '1800', 10);
const STREAM_KEY = process.env.EVENT_STREAM_KEY || 'events_stream';
const INTERVENTION_STREAM_KEY = process.env.INTERVENTION_STREAM_KEY || 'interventions_stream';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '10000', 10);

// thresholds.yml 을 못 찾았을 때만 쓰인다.
// 값이 어긋나 있으면 파일이 없는 환경에서 조용히 더 헐거운 규칙으로 돌게 되므로
// shared/config/thresholds.yml 과 항상 같이 갱신한다.
const defaultThresholds = {
  scenarios: {
    S1: {
      base_match: {
        cart_min_count: 2,
        tab_hidden_seconds: 20,
      },
      intent_score_min: 0.65,
      cooldown_seconds: 86400,
    },
    S2: {
      intent_score_min: 0.55,
      cooldown_seconds: 86400,
    },
  },
  booster_weights: {
    clipboard_copy_match: 0.3,
    broadcast_channel_multi_tab: 0.3,
    external_compare: 0.3,
    hidden_repeated: 0.25,
    checkout_form_dwell: 0.2,
    referrer_price_compare: 0.15,
    search_repeated: 0.15,
    wishlist_added: 0.15,
    session_length_5min: 0.1,
    scroll_depth_deep: 0.05,
    idle_entered: 0.05,
    focus_lost: 0.05,
    xgboost_intent_proba: 0,
  },
  discount: {
    tier1_percent: 5,
    tier2_min_score: 0.63,
    tier2_percent: 10,
    tier3_min_score: 0.78,
    tier3_percent: 15,
  },
  global: {
    intervention_per_session_max: 2,
    decision_api_timeout_ms: 800,
    pending_intervention_ttl_seconds: 300,
  },
};

// 부스터 정규 목록. 이 배열이 가중치 로딩·오버라이드 검증·effective 발행의
// 단일 출처다. YAML 파서가 콜론 든 주석 줄을 키로 오인하는 문제가 있어서
// 파싱 결과를 딥카피하지 않고 반드시 이 목록을 순회한다.
const BOOSTERS = {
  clipboard_copy_match:        { label: '호텔명 복사',          tier: 'high',     event_type: 'clipboard_copy',    s2_base: true },
  broadcast_channel_multi_tab: { label: '멀티탭 비교',           tier: 'high',     event_type: 'broadcast_channel', s2_base: true },
  external_compare:            { label: '외부 예약사이트 비교',   tier: 'high',     event_type: 'external_link',     s2_base: true },
  hidden_repeated:             { label: '탭 반복 이탈',          tier: 'high',     event_type: 'visibility_change' },
  checkout_form_dwell:         { label: '결제 폼 체류 이상',      tier: 'mid',      event_type: 'form_field' },
  referrer_price_compare:      { label: '가격비교 유입',          tier: 'mid',      event_type: '*' },
  search_repeated:             { label: '반복 검색',             tier: 'mid',      event_type: 'search_query' },
  wishlist_added:              { label: '찜하기',                tier: 'mid',      event_type: 'wishlist_add' },
  session_length_5min:         { label: '5분 이상 체류',          tier: 'ambient',  event_type: '*' },
  scroll_depth_deep:           { label: '깊은 스크롤',            tier: 'ambient',  event_type: 'scroll_depth' },
  idle_entered:                { label: '유휴 진입',             tier: 'ambient',  event_type: 'idle' },
  focus_lost:                  { label: '포커스 이탈',            tier: 'ambient',  event_type: 'window_focus' },
  xgboost_intent_proba:        { label: '모델 예측 (미사용)',     tier: 'reserved', event_type: null, reserved: true },
};
const BOOSTER_NAMES = Object.keys(BOOSTERS);
const S2_BASE_BOOSTERS = BOOSTER_NAMES.filter((name) => BOOSTERS[name].s2_base);

// 부스터 발동 임계값. event_type 이 '*' 인 두 개는 이벤트 종류와 무관하게 평가된다.
const BOOSTER_TRIGGERS = {
  form_dwell_ms: 8000,
  scroll_depth_percent: 75,
  search_query_count: 3,
};

const RUNTIME_CONFIG_KEY = 'hover:config:runtime';
const EFFECTIVE_CONFIG_KEY = 'hover:config:effective';

function stripComment(value) {
  return value.split('#')[0].trim();
}

function parseScalar(value) {
  const trimmed = stripComment(value);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  const numberValue = Number(trimmed);
  if (trimmed !== '' && Number.isFinite(numberValue)) return numberValue;

  return trimmed.replace(/^['"]|['"]$/g, '');
}

function parseThresholdYaml(content) {
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^(\s*)([^:\s][^:]*):(?:\s*(.*))?$/);
    if (!match) continue;

    const indent = match[1].length;
    const key = match[2].trim();
    const rawValue = match[3] || '';

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].value;
    if (stripComment(rawValue) === '') {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    } else {
      parent[key] = parseScalar(rawValue);
    }
  }

  return root;
}


// ─────────────────────────────────────────────────────────────
// 런타임 오버라이드
//
// thresholds.yml 은 BE-A 가 데이터로 도출한 기준값이고, Redis 의
// hover:config:runtime 이 운영자가 콘솔에서 조정한 값이다. 워커는 매 루프
// 둘을 병합하고, 그 결과를 hover:config:effective 로 다시 발행한다.
// 부스터 정규 목록과 정규식을 아는 건 워커뿐이므로, API 가 자기 사본으로
// 검증하면 드리프트 지점이 하나 더 생긴다.
// ─────────────────────────────────────────────────────────────

function clampWeight(value) {
  const w = Number(value);
  if (!Number.isFinite(w) || w < 0 || w > 1) return null;
  return Math.round(w * 100) / 100;
}

function clampNumber(value, min, max, integer) {
  const v = Number(value);
  if (!Number.isFinite(v) || v < min || v > max) return null;
  return integer ? Math.round(v) : Math.round(v * 100) / 100;
}

function mergeOverrides(baseline, override) {
  const rejected = [];
  const ov = override && typeof override === 'object' && !Array.isArray(override) ? override : null;
  const ovBoosters = (ov && ov.boosters && typeof ov.boosters === 'object') ? ov.boosters : {};

  const boosters = {};
  for (const name of BOOSTER_NAMES) {
    const meta = BOOSTERS[name];
    const defaultWeight = baseline.booster_weights[name] ?? 0;
    let enabled = !meta.reserved;
    let weight = defaultWeight;
    let source = 'baseline';

    const entry = ovBoosters[name];
    if (entry && typeof entry === 'object') {
      if (typeof entry.enabled === 'boolean') {
        enabled = entry.enabled;
        source = 'override';
      }
      if (entry.weight !== undefined) {
        const w = clampWeight(entry.weight);
        if (w === null) {
          rejected.push({ path: `boosters.${name}.weight`, reason: 'out_of_range', value: entry.weight });
        } else {
          weight = w;
          source = 'override';
        }
      }
    }

    boosters[name] = {
      label: meta.label,
      tier: meta.tier,
      event_type: meta.event_type,
      s2_base: meta.s2_base === true,
      reserved: meta.reserved === true,
      enabled,
      weight,
      default_weight: defaultWeight,
      source,
    };
  }

  for (const name of Object.keys(ovBoosters)) {
    if (!BOOSTERS[name]) {
      rejected.push({ path: `boosters.${name}`, reason: 'unknown_booster' });
    }
  }

  const ovScenarios = (ov && ov.scenarios && typeof ov.scenarios === 'object') ? ov.scenarios : {};
  const scenarios = JSON.parse(JSON.stringify(baseline.scenarios));
  scenarios.S1.enabled = true;
  scenarios.S2.enabled = true;

  const scenarioFields = {
    S1: [
      ['cart_min_count', 1, 10, true],
      ['tab_hidden_seconds', 3, 300, true],
      ['intent_score_min', 0.01, 2.05, false],
    ],
    S2: [['intent_score_min', 0.01, 2.05, false]],
  };

  for (const id of ['S1', 'S2']) {
    const src = ovScenarios[id];
    if (!src || typeof src !== 'object') continue;
    if (typeof src.enabled === 'boolean') scenarios[id].enabled = src.enabled;
    for (const [field, min, max, integer] of scenarioFields[id]) {
      if (src[field] === undefined) continue;
      const v = clampNumber(src[field], min, max, integer);
      if (v === null) {
        rejected.push({ path: `scenarios.${id}.${field}`, reason: 'out_of_range', value: src[field] });
        continue;
      }
      if (field === 'intent_score_min') scenarios[id].intent_score_min = v;
      else scenarios[id].base_match[field] = v;
    }
  }

  const discount = { ...baseline.discount };
  const ovDiscount = (ov && ov.discount && typeof ov.discount === 'object') ? ov.discount : {};
  const discountFields = [
    ['tier1_percent', 0, 90, true],
    ['tier2_min_score', 0.01, 2.05, false],
    ['tier2_percent', 0, 90, true],
    ['tier3_min_score', 0.01, 2.05, false],
    ['tier3_percent', 0, 90, true],
  ];
  for (const [field, min, max, integer] of discountFields) {
    if (ovDiscount[field] === undefined) continue;
    const v = clampNumber(ovDiscount[field], min, max, integer);
    if (v === null) {
      rejected.push({ path: `discount.${field}`, reason: 'out_of_range', value: ovDiscount[field] });
      continue;
    }
    discount[field] = v;
  }
  if (discount.tier3_min_score < discount.tier2_min_score) {
    rejected.push({ path: 'discount.tier3_min_score', reason: 'below_tier2', value: discount.tier3_min_score });
    discount.tier3_min_score = baseline.discount.tier3_min_score;
    discount.tier2_min_score = baseline.discount.tier2_min_score;
  }

  const config = {
    version: Number(ov?.version) || 0,
    scenarios,
    boosters,
    discount,
    // intentScore 는 boosters 만 보지만, 하위 호환을 위해 평평한 맵도 남긴다.
    booster_weights: Object.fromEntries(BOOSTER_NAMES.map((nm) => [nm, boosters[nm].weight])),
    global: baseline.global,
  };

  return { config, rejected };
}

function buildEffectiveDoc(config, rejected, overridePresent, baselineSource) {
  return {
    version: config.version,
    worker_loaded_at: Date.now(),
    baseline_source: baselineSource,
    override_present: overridePresent,
    boosters: config.boosters,
    scenarios: {
      S1: {
        enabled: config.scenarios.S1.enabled,
        cart_min_count: config.scenarios.S1.base_match.cart_min_count,
        tab_hidden_seconds: config.scenarios.S1.base_match.tab_hidden_seconds,
        intent_score_min: config.scenarios.S1.intent_score_min,
      },
      S2: {
        enabled: config.scenarios.S2.enabled,
        intent_score_min: config.scenarios.S2.intent_score_min,
        base_boosters: S2_BASE_BOOSTERS,
      },
    },
    discount: config.discount,
    triggers: BOOSTER_TRIGGERS,
    matchers: {
      hotel_text: HOTEL_TEXT_SOURCE,
      price_compare: PRICE_COMPARE_SOURCE,
    },
    rejected,
  };
}

let lastOverrideRaw = null;
let lastPublishedDoc = '';
let lastWarnedRaw = null;

async function refreshConfig() {
  const baseline = loadThresholds();
  let overrideRaw = lastOverrideRaw;

  if (process.env.CONFIG_OVERRIDE_ENABLED === 'false') {
    overrideRaw = null;
  } else {
    try {
      overrideRaw = await redis.get(RUNTIME_CONFIG_KEY);
      lastOverrideRaw = overrideRaw;
    } catch (err) {
      // 기준값으로 폴백하면 방금 끈 신호가 조용히 다시 켜진다. 직전 값을 유지한다.
      console.warn(`[Worker] runtime config read failed: ${err.message}. Reusing last known override.`);
    }
  }

  let parsedOverride = null;
  if (overrideRaw) {
    parsedOverride = parseJson(overrideRaw, null);
    if (!parsedOverride && overrideRaw !== lastWarnedRaw) {
      lastWarnedRaw = overrideRaw;
      console.warn('[Worker] runtime config is not valid JSON. Ignoring.');
    }
  }

  const { config, rejected } = mergeOverrides(baseline, parsedOverride);
  thresholds = config;

  const doc = JSON.stringify(buildEffectiveDoc(config, rejected, !!parsedOverride, baseline.source || ''));
  if (doc !== lastPublishedDoc) {
    lastPublishedDoc = doc;
    try {
      await redis.set(EFFECTIVE_CONFIG_KEY, doc);
    } catch (err) {
      console.warn(`[Worker] effective config publish failed: ${err.message}`);
    }
  }
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function loadThresholds() {
  const candidates = [
    process.env.THRESHOLDS_PATH,
    path.resolve(__dirname, '../../shared/config/thresholds.yml'),
    path.resolve(process.cwd(), 'packages/shared/config/thresholds.yml'),
  ].filter(Boolean);

  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    console.warn('[Worker] thresholds.yml not found. Using defaults.');
    return defaultThresholds;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const source = filePath;
  const parsed = parseThresholdYaml(content);
  const s1 = parsed.scenarios?.S1 || {};
  const s2 = parsed.scenarios?.S2 || {};
  const boosterWeights = parsed.booster_weights || {};
  const discount = parsed.discount || {};
  const global = parsed.global || {};

  return {
    source,
    scenarios: {
      S1: {
        ...defaultThresholds.scenarios.S1,
        base_match: {
          cart_min_count: numberValue(
            s1.base_match?.cart_min_count,
            defaultThresholds.scenarios.S1.base_match.cart_min_count
          ),
          tab_hidden_seconds: numberValue(
            s1.base_match?.tab_hidden_seconds,
            defaultThresholds.scenarios.S1.base_match.tab_hidden_seconds
          ),
        },
        intent_score_min: numberValue(s1.intent_score_min, defaultThresholds.scenarios.S1.intent_score_min),
        cooldown_seconds: numberValue(s1.cooldown_seconds, defaultThresholds.scenarios.S1.cooldown_seconds),
      },
      S2: {
        ...defaultThresholds.scenarios.S2,
        intent_score_min: numberValue(s2.intent_score_min, defaultThresholds.scenarios.S2.intent_score_min),
        cooldown_seconds: numberValue(s2.cooldown_seconds, defaultThresholds.scenarios.S2.cooldown_seconds),
      },
    },
    // 정규 목록 순회. 여기에 없는 키는 의도적으로 버린다.
    booster_weights: Object.fromEntries(
      BOOSTER_NAMES.map((name) => [
        name,
        numberValue(boosterWeights[name], defaultThresholds.booster_weights[name] ?? 0),
      ])
    ),
    discount: {
      tier1_percent: numberValue(discount.tier1_percent, defaultThresholds.discount.tier1_percent),
      tier2_min_score: numberValue(discount.tier2_min_score, defaultThresholds.discount.tier2_min_score),
      tier2_percent: numberValue(discount.tier2_percent, defaultThresholds.discount.tier2_percent),
      tier3_min_score: numberValue(discount.tier3_min_score, defaultThresholds.discount.tier3_min_score),
      tier3_percent: numberValue(discount.tier3_percent, defaultThresholds.discount.tier3_percent),
    },
    global: {
      intervention_per_session_max: numberValue(
        global.intervention_per_session_max,
        defaultThresholds.global.intervention_per_session_max
      ),
      decision_api_timeout_ms: numberValue(
        global.decision_api_timeout_ms,
        defaultThresholds.global.decision_api_timeout_ms
      ),
      pending_intervention_ttl_seconds: numberValue(
        global.pending_intervention_ttl_seconds,
        defaultThresholds.global.pending_intervention_ttl_seconds
      ),
    },
  };
}

// 최초 1회는 오버라이드 없이 병합만 해 둔다. thresholds.boosters 가 없으면
// scoredBoosters 가 전부 걸러내므로 이 초기화는 생략할 수 없다.
let thresholds = mergeOverrides(loadThresholds(), null).config;

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function hashAbGroup(sessionId) {
  const hash = crypto.createHash('sha256').update(sessionId).digest();
  return hash[0] % 2 === 0 ? 'control' : 'treatment';
}

function sessionKey(sessionId) {
  return `session:${sessionId}`;
}

function cooldownKey(sessionId, scenarioId) {
  return `cooldown:${sessionId}:${scenarioId}`;
}

function normalizeState(raw, now) {
  return {
    session_started_at: Number(raw.session_started_at || now),
    cart_count: Number(raw.cart_count || 0),
    hidden_at: Number(raw.hidden_at || 0),
    hidden_count: Number(raw.hidden_count || 0),
    last_page_url: raw.last_page_url || '',
    last_referrer: raw.last_referrer || '',
    hotel_name: raw.hotel_name || '',
    search_count: Number(raw.search_count || 0),
    active_boosters: parseJson(raw.active_boosters, []),
    intervention_count: Number(raw.intervention_count || 0),
  };
}

function addBooster(state, name) {
  if (!state.active_boosters.includes(name)) {
    state.active_boosters.push(name);
  }
}

const HOTEL_TEXT_RE = /(\bhotel\b|\broom\b|\bresort\b|\bsuite\b|\binn\b|\bmotel\b|\bhostel\b|펜션|호텔|객실|리조트|신라|롯데|숙소|힐튼|하얏트|메리어트|인터컨티넨탈|노보텔|쉐라톤|웨스틴|포시즌|그랜드 (호텔|리조트|하얏트))/i;
const PRICE_COMPARE_RE = /(google|naver|trivago|booking|agoda|hotels|kayak|skyscanner)/i;
const HOTEL_TEXT_SOURCE = HOTEL_TEXT_RE.source;
const PRICE_COMPARE_SOURCE = PRICE_COMPARE_RE.source;

function looksLikeHotelText(text) {
  if (!text) return false;
  return HOTEL_TEXT_RE.test(text);
}

function isPriceCompareReferrer(referrer) {
  if (!referrer) return false;
  return PRICE_COMPARE_RE.test(referrer);
}

function updateStateFromEvent(state, event, now) {
  state.last_page_url = event.page_url || state.last_page_url;
  state.last_referrer = event.referrer || state.last_referrer;

  if (isPriceCompareReferrer(event.referrer)) {
    addBooster(state, 'referrer_price_compare');
  }

  if (now - state.session_started_at >= 5 * 60 * 1000) {
    addBooster(state, 'session_length_5min');
  }

  if (event.type === 'cart_change') {
    const count = Number(event.payload?.count);
    if (Number.isFinite(count)) state.cart_count = Math.max(0, count);
  }

  if (event.type === 'add_to_cart') {
    state.cart_count += 1;
  }

  if (event.type === 'visibility_change' || event.type === 'page_lifecycle') {
    const hidden = event.payload?.hidden === true || event.payload?.phase === 'hide';
    const visible = event.payload?.hidden === false || event.payload?.phase === 'show';

    if (hidden && !state.hidden_at) {
      state.hidden_at = Number(event.ts || now);
      state.hidden_count += 1;
      if (state.hidden_count >= 2) {
        addBooster(state, 'hidden_repeated');
      }
    }

    if (visible) {
      state.hidden_at = 0;
    }
  }

  if (event.type === 'clipboard_copy') {
    const selectedText = String(event.payload?.selected_text || '');
    if (looksLikeHotelText(selectedText)) {
      addBooster(state, 'clipboard_copy_match');
      if (!state.hotel_name) state.hotel_name = selectedText.slice(0, 80);
    }
  }

  if (event.type === 'broadcast_channel') {
    const tabCount = Number(event.payload?.tab_count || 0);
    if (tabCount >= 2) {
      addBooster(state, 'broadcast_channel_multi_tab');
    }
  }

  // ── 아래 7개는 데모 사이트의 applyEventToMirror 와 같은 순서·조건을 유지해야 한다.
  //    (packages/demo-hotel-site/src/lib/tracker/rules.ts)

  if (event.type === 'form_field') {
    // 결제 폼에서만 센다. 정렬 드롭다운 같은 일반 입력은 form 이 'unknown' 이다.
    const dwell = Number(event.payload?.dwell_ms || 0);
    if (event.payload?.form === 'checkout' && dwell >= BOOSTER_TRIGGERS.form_dwell_ms) {
      addBooster(state, 'checkout_form_dwell');
    }
  }

  if (event.type === 'scroll_depth') {
    if (Number(event.payload?.percent || 0) >= BOOSTER_TRIGGERS.scroll_depth_percent) {
      addBooster(state, 'scroll_depth_deep');
    }
  }

  if (event.type === 'idle' && event.payload?.idle === true) {
    addBooster(state, 'idle_entered');
  }

  if (event.type === 'window_focus' && event.payload?.focused === false) {
    addBooster(state, 'focus_lost');
  }

  if (event.type === 'external_link') {
    // 유입 판정과 같은 정규식을 쓴다. 클라이언트 미러의 패턴을 하나로 유지하기 위함.
    const host = String(event.payload?.hostname || event.payload?.href || '');
    if (isPriceCompareReferrer(host)) {
      addBooster(state, 'external_compare');
    }
  }

  if (event.type === 'search_query') {
    state.search_count += 1;
    if (state.search_count >= BOOSTER_TRIGGERS.search_query_count) {
      addBooster(state, 'search_repeated');
    }
  }

  if (event.type === 'wishlist_add' && event.payload?.action === 'add') {
    addBooster(state, 'wishlist_added');
  }
}

// active_boosters 는 원본 관측 기록으로 그대로 두고, enabled 는 읽기 시점 필터로만
// 동작시킨다. 그래서 토글을 꺼도 세션을 다시 쓸 필요가 없고, 다시 켜면 소급 적용된다.
function scoredBoosters(state) {
  return state.active_boosters.filter((name) => thresholds.boosters?.[name]?.enabled === true);
}

function intentScore(state) {
  const sum = scoredBoosters(state).reduce((acc, booster) => {
    return acc + Number(thresholds.boosters[booster].weight || 0);
  }, 0);
  // 2dp 반올림. 운영자가 0.5 를 입력했는데 0.15+0.35 === 0.49999999999999994 라
  // 영원히 발화하지 않는 사고를 막는다.
  return Math.round(sum * 100) / 100;
}

// intent 가 높을수록 이탈 위험이 크므로 더 큰 혜택을 준다.
function discountFor(score) {
  const d = thresholds.discount;
  if (score >= d.tier3_min_score) return d.tier3_percent;
  if (score >= d.tier2_min_score) return d.tier2_percent;
  return d.tier1_percent;
}

function hiddenForSeconds(state, now) {
  if (!state.hidden_at) return 0;
  return Math.max(0, Math.floor((now - state.hidden_at) / 1000));
}

async function evaluateScenario(state, now) {
  const score = intentScore(state);
  const s1 = thresholds.scenarios.S1;
  const s2 = thresholds.scenarios.S2;
  const scored = scoredBoosters(state);
  const s2Base = S2_BASE_BOOSTERS.filter((name) => thresholds.boosters?.[name]?.enabled === true);
  const engine = new Engine();

  if (s1.enabled !== false) {
  engine.addRule({
    priority: 10,
    conditions: {
      all: [
        { fact: 'cart_count', operator: 'greaterThanInclusive', value: s1.base_match.cart_min_count },
        { fact: 'hidden_for_seconds', operator: 'greaterThanInclusive', value: s1.base_match.tab_hidden_seconds },
        { fact: 'intent_score', operator: 'greaterThanInclusive', value: s1.intent_score_min },
      ],
    },
    event: {
      type: 'scenario_matched',
      params: { scenario_id: 'S1', component: 'coupon_modal' },
    },
  });
  }

  // 기본조건 신호가 전부 꺼지면 룰 자체를 등록하지 않는다.
  // any: [] 의 동작에 의존하지 않기 위함.
  if (s2.enabled !== false && s2Base.length > 0) {
  engine.addRule({
    priority: 5,
    conditions: {
      all: [
        {
          any: s2Base.map((name) => ({ fact: name, operator: 'equal', value: true })),
        },
        { fact: 'intent_score', operator: 'greaterThanInclusive', value: s2.intent_score_min },
      ],
    },
    event: {
      type: 'scenario_matched',
      params: { scenario_id: 'S2', component: 'price_match_banner' },
    },
  });
  }

  const facts = {
    cart_count: state.cart_count,
    hidden_for_seconds: hiddenForSeconds(state, now),
    intent_score: score,
  };
  // 팩트도 scored 기준으로 만든다. active_boosters 를 쓰면 운영자가 끈 신호로
  // S2 기본조건이 계속 열린다.
  for (const name of S2_BASE_BOOSTERS) {
    facts[name] = scored.includes(name);
  }

  const result = await engine.run(facts);

  const match =
    result.events.find((event) => event.params?.scenario_id === 'S1') ||
    result.events.find((event) => event.params?.scenario_id === 'S2');
  if (match) {
    return { ...match.params, score, scored_boosters: scored };
  }

  return null;
}

function fallbackCopy(scenarioId, discountPercent) {
  if (scenarioId === 'S2') {
    return {
      title: '떠나기 전에 비교해보세요',
      body: '이 서비스에서 더 나은 혜택을 찾아드릴게요.',
      cta: '혜택 확인하기',
    };
  }

  return {
    title: '떠나기 전 잠깐!',
    body: `지금 구매하시면 ${discountPercent || 10}% 추가 할인 쿠폰을 드려요.`,
    cta: '쿠폰 받기',
  };
}

function safeGeminiText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function parseGeminiCopy(text) {
  if (!text) return null;

  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || text;
  try {
    const parsed = JSON.parse(jsonText);
    const title = safeGeminiText(parsed.title, 40);
    const body = safeGeminiText(parsed.body, 120);
    const cta = safeGeminiText(parsed.cta, 24);

    if (!title || !body || !cta) return null;
    return { title, body, cta };
  } catch (_) {
    return null;
  }
}

function geminiPrompt(scenarioId, state, scored, discountPercent) {
  const scenarioName = scenarioId === 'S2' ? 'price comparison intent' : 'cart abandonment intent';
  const hotelName = state.hotel_name || 'the selected hotel';

  return [
    'You generate short Korean ecommerce popup copy for a hotel booking service.',
    'Return only strict JSON with keys title, body, cta. Do not include markdown.',
    'Constraints: title <= 24 Korean chars, body <= 70 Korean chars, cta <= 10 Korean chars.',
    'Do not invent exact prices, inventory counts, or unsupported benefits.',
    `Scenario: ${scenarioName}.`,
    `Hotel context: ${hotelName}.`,
    `Active signals: ${(scored || []).join(', ') || 'none'}.`,
    scenarioId === 'S1'
      ? `Goal: encourage the user to complete the booking before leaving. Mention a limited ${discountPercent || 10}% coupon benefit.`
      : 'Goal: encourage the user to compare benefits inside this service before leaving.',
  ].join('\n');
}

async function generateCopyWithGemini(scenarioId, state, scored, discountPercent) {
  if (!GEMINI_API_KEY) {
    return { copy: fallbackCopy(scenarioId, discountPercent), source: 'fallback' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: geminiPrompt(scenarioId, state, scored, discountPercent) }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn(`[Worker] Gemini request failed with status ${response.status}. Using fallback copy.`);
      return { copy: fallbackCopy(scenarioId, discountPercent), source: 'fallback' };
    }

    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    const copy = parseGeminiCopy(text);

    if (!copy) {
      console.warn('[Worker] Gemini returned invalid copy. Using fallback copy.');
      return { copy: fallbackCopy(scenarioId, discountPercent), source: 'fallback' };
    }

    return { copy, source: 'gemini' };
  } catch (err) {
    console.warn(`[Worker] Gemini copy generation skipped: ${err.message}. Using fallback copy.`);
    return { copy: fallbackCopy(scenarioId, discountPercent), source: 'fallback' };
  } finally {
    clearTimeout(timer);
  }
}

async function createIntervention(sessionId, state, decision) {
  const existing = await redis.get(`pending:${sessionId}`);
  if (existing) return;

  if (state.intervention_count >= thresholds.global.intervention_per_session_max) {
    return;
  }

  const cooldownSeconds = thresholds.scenarios[decision.scenario_id]?.cooldown_seconds || 86400;
  const isCoolingDown = await redis.exists(cooldownKey(sessionId, decision.scenario_id));
  if (isCoolingDown) return;

  const scored = decision.scored_boosters || scoredBoosters(state);
  // S1 만 쿠폰을 준다. 할인율은 intent 구간에 따라 5 / 10 / 15%.
  const discountPercent = decision.scenario_id === 'S1' ? discountFor(decision.score) : undefined;
  const generatedCopy = await generateCopyWithGemini(decision.scenario_id, state, scored, discountPercent);

  const intervention = {
    intervention_id: crypto.randomUUID(),
    session_id: sessionId,
    scenario_id: decision.scenario_id,
    ab_group: hashAbGroup(sessionId),
    component: decision.component,
    copy: generatedCopy.copy,
    context: {
      hotel_name: state.hotel_name || undefined,
      discount_percent: discountPercent,
      // 프론트가 코드를 발명하지 않도록 워커가 내려보낸다.
      coupon_code: discountPercent ? `HOVER${discountPercent}` : undefined,
    },
    ttl_seconds: thresholds.global.pending_intervention_ttl_seconds,
    intent_score: Number(decision.score.toFixed(3)),
    active_boosters: state.active_boosters,
    scored_boosters: scored,
    config_version: thresholds.version ?? 0,
    copy_source: generatedCopy.source,
  };

  await redis
    .multi()
    .setex(
      `pending:${sessionId}`,
      thresholds.global.pending_intervention_ttl_seconds,
      JSON.stringify(intervention)
    )
    .setex(cooldownKey(sessionId, decision.scenario_id), cooldownSeconds, '1')
    .hincrby(sessionKey(sessionId), 'intervention_count', 1)
    .expire(sessionKey(sessionId), SESSION_TTL_SECONDS)
    .xadd(
      INTERVENTION_STREAM_KEY,
      '*',
      'session_id',
      sessionId,
      'intervention_id',
      intervention.intervention_id,
      'scenario_id',
      intervention.scenario_id,
      'ab_group',
      intervention.ab_group,
      'intent_score',
      String(intervention.intent_score),
      'active_boosters',
      JSON.stringify(intervention.active_boosters),
      'copy_source',
      intervention.copy_source,
      'data',
      JSON.stringify(intervention)
    )
    .exec();

  console.log(
    `[Worker] Intervention created for session ${sessionId}: ${decision.scenario_id} score=${intervention.intent_score}`
  );
}

async function saveState(sessionId, state) {
  await redis
    .multi()
    .hset(sessionKey(sessionId), {
      session_started_at: String(state.session_started_at),
      cart_count: String(state.cart_count),
      hidden_at: String(state.hidden_at),
      hidden_count: String(state.hidden_count),
      last_page_url: state.last_page_url,
      last_referrer: state.last_referrer,
      hotel_name: state.hotel_name,
      search_count: String(state.search_count),
      active_boosters: JSON.stringify(state.active_boosters),
      intervention_count: String(state.intervention_count),
    })
    .expire(sessionKey(sessionId), SESSION_TTL_SECONDS)
    .exec();
}

function streamFieldsToObject(fields) {
  const object = {};
  for (let i = 0; i < fields.length; i += 2) {
    object[fields[i]] = fields[i + 1];
  }
  return object;
}

async function handleEvent(sessionId, event) {
  const now = Date.now();
  const rawState = await redis.hgetall(sessionKey(sessionId));
  const state = normalizeState(rawState, now);

  // S1 checks hidden_for_seconds, which is cleared when the tab becomes visible.
  // Evaluate before updateStateFromEvent clears hidden_at, then save, then intervene.
  // This order ensures saveState always runs before createIntervention (prevents
  // intervention_count from being overwritten by hset after hincrby).
  const isVisibleReturn =
    (event.type === 'visibility_change' || event.type === 'page_lifecycle') &&
    (event.payload?.hidden === false || event.payload?.phase === 'show');

  const preUpdateDecision = isVisibleReturn ? await evaluateScenario(state, now) : null;

  updateStateFromEvent(state, event, now);
  await saveState(sessionId, state);

  const decision = preUpdateDecision ?? await evaluateScenario(state, now);
  if (decision) {
    await createIntervention(sessionId, state, decision);
  }
}

async function processStream() {
  console.log('[Worker] Stream Worker started...');
  let lastId = '$';

  while (true) {
    try {
      await refreshConfig();
      const result = await redis.xread('BLOCK', 5000, 'STREAMS', STREAM_KEY, lastId);
      if (!result) continue;

      const [, messages] = result[0];
      for (const [id, fields] of messages) {
        lastId = id;
        const entry = streamFieldsToObject(fields);
        const sessionId = entry.session_id;
        const eventData = JSON.parse(entry.data);

        console.log(`[Worker] Processing event for session ${sessionId}:`, eventData.type);
        await handleEvent(sessionId, eventData);
      }
    } catch (err) {
      console.error('[Worker] Error:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

processStream();
