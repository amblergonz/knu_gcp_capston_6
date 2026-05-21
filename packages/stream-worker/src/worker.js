const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
const { Engine } = require('json-rules-engine');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const SESSION_TTL_SECONDS = parseInt(process.env.SESSION_TTL_SECONDS || '1800', 10);
const STREAM_KEY = process.env.EVENT_STREAM_KEY || 'events_stream';
const INTERVENTION_STREAM_KEY = process.env.INTERVENTION_STREAM_KEY || 'interventions_stream';

const defaultThresholds = {
  scenarios: {
    S1: {
      base_match: {
        cart_min_count: 1,
        tab_hidden_seconds: 10,
      },
      intent_score_min: 0.6,
      cooldown_seconds: 86400,
    },
    S2: {
      intent_score_min: 0.5,
      cooldown_seconds: 86400,
    },
  },
  booster_weights: {
    clipboard_copy_match: 0.4,
    broadcast_channel_multi_tab: 0.4,
    referrer_price_compare: 0.2,
    session_length_5min: 0.4,
    hidden_repeated: 0.4,
    xgboost_intent_proba: 0,
  },
  global: {
    intervention_per_session_max: 2,
    pending_intervention_ttl_seconds: 300,
  },
};

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
  const parsed = parseThresholdYaml(content);
  const s1 = parsed.scenarios?.S1 || {};
  const s2 = parsed.scenarios?.S2 || {};
  const boosterWeights = parsed.booster_weights || {};
  const global = parsed.global || {};

  return {
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
    booster_weights: {
      clipboard_copy_match: numberValue(
        boosterWeights.clipboard_copy_match,
        defaultThresholds.booster_weights.clipboard_copy_match
      ),
      broadcast_channel_multi_tab: numberValue(
        boosterWeights.broadcast_channel_multi_tab,
        defaultThresholds.booster_weights.broadcast_channel_multi_tab
      ),
      referrer_price_compare: numberValue(
        boosterWeights.referrer_price_compare,
        defaultThresholds.booster_weights.referrer_price_compare
      ),
      session_length_5min: numberValue(
        boosterWeights.session_length_5min,
        defaultThresholds.booster_weights.session_length_5min
      ),
      hidden_repeated: numberValue(boosterWeights.hidden_repeated, defaultThresholds.booster_weights.hidden_repeated),
      xgboost_intent_proba: numberValue(
        boosterWeights.xgboost_intent_proba,
        defaultThresholds.booster_weights.xgboost_intent_proba
      ),
    },
    global: {
      intervention_per_session_max: numberValue(
        global.intervention_per_session_max,
        defaultThresholds.global.intervention_per_session_max
      ),
      pending_intervention_ttl_seconds: numberValue(
        global.pending_intervention_ttl_seconds,
        defaultThresholds.global.pending_intervention_ttl_seconds
      ),
    },
  };
}

let thresholds = loadThresholds();

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
    active_boosters: parseJson(raw.active_boosters, []),
    intervention_count: Number(raw.intervention_count || 0),
  };
}

function addBooster(state, name) {
  if (!state.active_boosters.includes(name)) {
    state.active_boosters.push(name);
  }
}

function looksLikeHotelText(text) {
  if (!text) return false;
  return /(hotel|room|resort|suite|inn|호텔|객실|리조트|신라|롯데|숙소)/i.test(text);
}

function isPriceCompareReferrer(referrer) {
  if (!referrer) return false;
  return /(google|naver|trivago|booking|agoda|hotels|kayak|skyscanner)/i.test(referrer);
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
}

function intentScore(state) {
  return state.active_boosters.reduce((sum, booster) => {
    return sum + Number(thresholds.booster_weights[booster] || 0);
  }, 0);
}

function hiddenForSeconds(state, now) {
  if (!state.hidden_at) return 0;
  return Math.max(0, Math.floor((now - state.hidden_at) / 1000));
}

async function evaluateScenario(state, now) {
  const score = intentScore(state);
  const s1 = thresholds.scenarios.S1;
  const s2 = thresholds.scenarios.S2;
  const engine = new Engine();

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

  engine.addRule({
    priority: 5,
    conditions: {
      all: [
        {
          any: [
            { fact: 'clipboard_copy_match', operator: 'equal', value: true },
            { fact: 'broadcast_channel_multi_tab', operator: 'equal', value: true },
          ],
        },
        { fact: 'intent_score', operator: 'greaterThanInclusive', value: s2.intent_score_min },
      ],
    },
    event: {
      type: 'scenario_matched',
      params: { scenario_id: 'S2', component: 'price_match_banner' },
    },
  });

  const result = await engine.run({
    cart_count: state.cart_count,
    hidden_for_seconds: hiddenForSeconds(state, now),
    intent_score: score,
    clipboard_copy_match: state.active_boosters.includes('clipboard_copy_match'),
    broadcast_channel_multi_tab: state.active_boosters.includes('broadcast_channel_multi_tab'),
  });

  const match =
    result.events.find((event) => event.params?.scenario_id === 'S1') ||
    result.events.find((event) => event.params?.scenario_id === 'S2');
  if (match) {
    return { ...match.params, score };
  }

  return null;
}

function fallbackCopy(scenarioId) {
  if (scenarioId === 'S2') {
    return {
      title: 'Compare before you leave',
      body: 'We found a limited room benefit for this stay.',
      cta: 'See offer',
    };
  }

  return {
    title: 'Before you go',
    body: 'Complete this booking now and keep the current benefit.',
    cta: 'Get coupon',
  };
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

  const intervention = {
    intervention_id: crypto.randomUUID(),
    session_id: sessionId,
    scenario_id: decision.scenario_id,
    ab_group: hashAbGroup(sessionId),
    component: decision.component,
    copy: fallbackCopy(decision.scenario_id),
    context: {
      hotel_name: state.hotel_name || undefined,
      discount_percent: decision.scenario_id === 'S1' ? 10 : undefined,
    },
    ttl_seconds: 600,
    intent_score: Number(decision.score.toFixed(3)),
    active_boosters: state.active_boosters,
    copy_source: 'fallback',
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

  updateStateFromEvent(state, event, now);
  await saveState(sessionId, state);

  const decision = await evaluateScenario(state, now);
  if (decision) {
    await createIntervention(sessionId, state, decision);
  }
}

async function processStream() {
  console.log('[Worker] Stream Worker started...');
  let lastId = '$';

  while (true) {
    try {
      thresholds = loadThresholds();
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
