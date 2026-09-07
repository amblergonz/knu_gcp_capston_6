const { spawn } = require('child_process');
const path = require('path');
const Redis = require('ioredis');

const repoRoot = path.resolve(__dirname, '../../..');
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const ingestionPort = process.env.SMOKE_INGESTION_PORT || '4100';
const decisionPort = process.env.SMOKE_DECISION_PORT || '4101';
const children = [];

function startService(name, script, env) {
  const child = spawn(process.execPath, [script], {
    cwd: repoRoot,
    env: { ...process.env, REDIS_URL: redisUrl, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      process.stderr.write(`[${name}] exited with code ${code}\n`);
    }
    if (signal) {
      process.stderr.write(`[${name}] stopped by ${signal}\n`);
    }
  });

  children.push(child);
  return child;
}

async function waitForHealth(url, name) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_) {
      // Retry until service is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`${name} did not become healthy: ${url}`);
}

async function postEvents(sessionId, events) {
  const response = await fetch(`http://localhost:${ingestionPort}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      user_id: 'smoke-user',
      device: 'desktop',
      events,
    }),
  });

  const body = await response.json();
  if (response.status !== 202 || body.accepted !== events.length) {
    throw new Error(`Expected ingestion 202 for ${sessionId}, got ${response.status}: ${JSON.stringify(body)}`);
  }
}

async function waitForDecision(sessionId) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const response = await fetch(`http://localhost:${decisionPort}/decision/${sessionId}`);
    if (response.status === 200) return response.json();
    if (response.status !== 204) {
      throw new Error(`Unexpected decision status ${response.status} for ${sessionId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`No decision created for ${sessionId}`);
}

// 부스터 12종을 각각 단독으로 발동시키는 이벤트.
// worker.js 의 updateStateFromEvent 와 데모 사이트의 applyEventToMirror 는
// 같은 분기를 손으로 두 번 쓴 코드라, 여기서 한 종이라도 빠지면 두 구현이
// 조용히 어긋난 채로 지나간다. 그 드리프트를 잡는 것이 이 검사의 목적이다.
function boosterProbes(sessionId, baseTs) {
  const at = (offset) => baseTs - offset;
  const url = 'https://example.test/probe';
  const mk = (suffix, type, payload, extra = {}) => ({
    event_id: `${sessionId}-${suffix}`,
    ts: at(extra.offset ?? 0),
    type,
    page_url: url,
    referrer: extra.referrer || '',
    payload,
  });

  return [
    // 기대 부스터 이름 → 그것을 켜는 이벤트들
    ['referrer_price_compare', [mk('ref', 'page_view', {}, { offset: 90000, referrer: 'https://google.com/search?q=hotel' })]],
    ['clipboard_copy_match', [mk('copy', 'clipboard_copy', { selected_text: 'Shilla Hotel room' }, { offset: 88000 })]],
    ['broadcast_channel_multi_tab', [mk('tabs', 'broadcast_channel', { tab_count: 2 }, { offset: 86000 })]],
    ['external_compare', [mk('ext', 'external_link', { hostname: 'www.agoda.com' }, { offset: 84000 })]],
    ['checkout_form_dwell', [mk('form', 'form_field', { form: 'checkout', field: 'phone', dwell_ms: 9000 }, { offset: 82000 })]],
    ['scroll_depth_deep', [mk('scroll', 'scroll_depth', { percent: 100 }, { offset: 80000 })]],
    ['idle_entered', [mk('idle', 'idle', { idle: true }, { offset: 78000 })]],
    ['focus_lost', [mk('focus', 'window_focus', { focused: false }, { offset: 76000 })]],
    ['wishlist_added', [mk('wish', 'wishlist_add', { hotel_id: 'h01', action: 'add' }, { offset: 74000 })]],
    ['search_repeated', [
      mk('q1', 'search_query', { q: 'a' }, { offset: 72000 }),
      mk('q2', 'search_query', { q: 'b' }, { offset: 71000 }),
      mk('q3', 'search_query', { q: 'c' }, { offset: 70000 }),
    ]],
    ['hidden_repeated', [
      mk('h1', 'visibility_change', { hidden: true }, { offset: 68000 }),
      mk('v1', 'visibility_change', { hidden: false }, { offset: 66000 }),
      mk('h2', 'visibility_change', { hidden: true }, { offset: 64000 }),
    ]],
  ];
}

// session_length_5min 은 이벤트가 아니라 경과 시간으로 붙으므로 별도 검사한다.
async function assertAllBoostersReachable(redis, sessionId) {
  const probes = boosterProbes(sessionId, Date.now());
  await postEvents(sessionId, probes.flatMap(([, events]) => events));

  // 워커가 배치를 다 소화할 때까지 기다린다.
  const deadline = Date.now() + 8000;
  let state = {};
  let active = [];
  const expected = probes.map(([name]) => name);

  while (Date.now() < deadline) {
    state = await redis.hgetall(`session:${sessionId}`);
    try {
      active = JSON.parse(state.active_boosters || '[]');
    } catch (_) {
      active = [];
    }
    if (expected.every((name) => active.includes(name))) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const missing = expected.filter((name) => !active.includes(name));
  if (missing.length > 0) {
    throw new Error(`부스터가 발동하지 않았습니다: ${missing.join(', ')} (관측: ${active.join(', ') || '없음'})`);
  }
  console.log(`  부스터 ${expected.length}종 전부 발동 확인`);
}

async function assertSecondReadIsEmpty(sessionId) {
  const response = await fetch(`http://localhost:${decisionPort}/decision/${sessionId}`);
  if (response.status !== 204) {
    throw new Error(`Expected second decision read to be 204 for ${sessionId}, got ${response.status}`);
  }
}

function streamFieldsToObject(fields) {
  const object = {};
  for (let i = 0; i < fields.length; i += 2) {
    object[fields[i]] = fields[i + 1];
  }
  return object;
}

async function assertInterventionStream(redis, sessionId) {
  const entries = await redis.xrevrange('interventions_stream', '+', '-', 'COUNT', 50);
  const found = entries.find(([, fields]) => streamFieldsToObject(fields).session_id === sessionId);
  if (!found) {
    throw new Error(`No intervention stream entry found for ${sessionId}`);
  }
}

async function main() {
  const redis = new Redis(redisUrl);
  const suffix = Date.now();
  const s1Session = `smoke-s1-${suffix}`;
  const s2Session = `smoke-s2-${suffix}`;
  const probeSession = `smoke-probe-${suffix}`;

  startService('ingestion-api', path.join(repoRoot, 'packages/ingestion-api/src/index.js'), { PORT: ingestionPort });
  startService('decision-api', path.join(repoRoot, 'packages/decision-api/src/index.js'), { PORT: decisionPort });
  startService('stream-worker', path.join(repoRoot, 'packages/stream-worker/src/worker.js'), {});

  try {
    await waitForHealth(`http://localhost:${ingestionPort}/health`, 'ingestion-api');
    await waitForHealth(`http://localhost:${decisionPort}/health`, 'decision-api');

    const invalid = await fetch(`http://localhost:${ingestionPort}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: 'invalid', events: [] }),
    });
    if (invalid.status !== 400) {
      throw new Error(`Expected invalid ingestion payload to return 400, got ${invalid.status}`);
    }

    const now = Date.now();
    // S1 은 독립 신호 두 개 이상을 요구한다 (thresholds.yml 참고).
    // 유입 0.15 + 폼 체류 0.20 + 찜 0.15 + 깊은 스크롤 0.05 = 0.55 >= 0.52
    // 여기에 cart_count >= 2, hidden_for_seconds >= 20 을 함께 만족시킨다.
    //
    // 주의: S2 기본조건 부스터(복사/멀티탭/외부링크)를 섞으면 탭 이탈 전에
    // S2 가 먼저 발화해 S1 이 오지 않는다.
    await postEvents(s1Session, [
      {
        event_id: `${s1Session}-cart-1`,
        ts: now - 45000,
        type: 'add_to_cart',
        page_url: 'https://example.test/hotel/lotte',
        referrer: 'https://google.com/search?q=hotel',
        payload: { product_id: 'hotel-lotte-deluxe' },
      },
      {
        event_id: `${s1Session}-cart-2`,
        ts: now - 43000,
        type: 'add_to_cart',
        page_url: 'https://example.test/hotel/lotte',
        referrer: '',
        payload: { product_id: 'hotel-lotte-suite' },
      },
      {
        event_id: `${s1Session}-scroll`,
        ts: now - 42000,
        type: 'scroll_depth',
        page_url: 'https://example.test/hotel/lotte',
        referrer: '',
        payload: { percent: 100 },
      },
      {
        event_id: `${s1Session}-wishlist`,
        ts: now - 41000,
        type: 'wishlist_add',
        page_url: 'https://example.test/hotel/lotte',
        referrer: '',
        payload: { hotel_id: 'hotel-lotte', action: 'add' },
      },
      {
        event_id: `${s1Session}-form`,
        ts: now - 40000,
        type: 'form_field',
        page_url: 'https://example.test/checkout',
        referrer: '',
        payload: { form: 'checkout', field: 'phone', dwell_ms: 9000 },
      },
      {
        event_id: `${s1Session}-hidden-1`,
        ts: now - 25000,
        type: 'visibility_change',
        page_url: 'https://example.test/hotel/lotte',
        referrer: '',
        payload: { hidden: true },
      },
    ]);

    const s1Decision = await waitForDecision(s1Session);
    if (s1Decision.scenario_id !== 'S1' || s1Decision.component !== 'coupon_modal') {
      throw new Error(`Expected S1 coupon_modal, got ${JSON.stringify(s1Decision)}`);
    }
    await assertSecondReadIsEmpty(s1Session);
    await assertInterventionStream(redis, s1Session);

    // S2 는 복사만으로는 0.35 라 발화하지 않는다.
    // 멀티탭이 더해져 0.70 >= 0.55 가 되는 두 번째 이벤트에서 발화한다.
    await postEvents(s2Session, [
      {
        event_id: `${s2Session}-copy`,
        ts: now,
        type: 'clipboard_copy',
        page_url: 'https://example.test/hotel/shilla',
        referrer: '',
        payload: { selected_text: 'Shilla Hotel room' },
      },
      {
        event_id: `${s2Session}-tabs`,
        ts: now + 1,
        type: 'broadcast_channel',
        page_url: 'https://example.test/hotel/shilla',
        referrer: '',
        payload: { tab_count: 2 },
      },
    ]);

    const s2Decision = await waitForDecision(s2Session);
    if (s2Decision.scenario_id !== 'S2' || s2Decision.component !== 'price_match_banner') {
      throw new Error(`Expected S2 price_match_banner, got ${JSON.stringify(s2Decision)}`);
    }
    await assertSecondReadIsEmpty(s2Session);
    await assertInterventionStream(redis, s2Session);

    await assertAllBoostersReachable(redis, probeSession);

    console.log('BE-C smoke passed: validation, S1, S2, one-shot decision, intervention stream, booster coverage');
  } finally {
    await redis.del(
      `session:${probeSession}`,
      `pending:${probeSession}`,
      `cooldown:${probeSession}:S1`,
      `cooldown:${probeSession}:S2`,
      `session:${s1Session}`,
      `pending:${s1Session}`,
      `cooldown:${s1Session}:S1`,
      `cooldown:${s1Session}:S2`,
      `session:${s2Session}`,
      `pending:${s2Session}`,
      `cooldown:${s2Session}:S1`,
      `cooldown:${s2Session}:S2`
    );
    redis.disconnect();
    for (const child of children) {
      child.kill();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
