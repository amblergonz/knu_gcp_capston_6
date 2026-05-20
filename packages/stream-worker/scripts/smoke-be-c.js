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
    await postEvents(s1Session, [
      {
        event_id: `${s1Session}-cart`,
        ts: now - 20000,
        type: 'add_to_cart',
        page_url: 'https://example.test/hotel/lotte',
        referrer: 'https://google.com/search?q=hotel',
        payload: { product_id: 'hotel-lotte' },
      },
      {
        event_id: `${s1Session}-hidden-1`,
        ts: now - 15000,
        type: 'visibility_change',
        page_url: 'https://example.test/hotel/lotte',
        referrer: '',
        payload: { hidden: true },
      },
      {
        event_id: `${s1Session}-visible`,
        ts: now - 12000,
        type: 'visibility_change',
        page_url: 'https://example.test/hotel/lotte',
        referrer: '',
        payload: { hidden: false },
      },
      {
        event_id: `${s1Session}-hidden-2`,
        ts: now - 11000,
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

    console.log('BE-C smoke passed: validation, S1, S2, one-shot decision, intervention stream');
  } finally {
    await redis.del(
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
