const fastify = require('fastify')({ logger: true });
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const PORT = parseInt(process.env.PORT || '4002', 10);

fastify.register(require('@fastify/cors'), { origin: '*' });

fastify.get('/', async () => ({ message: 'Dashboard API is running' }));
fastify.get('/health', async () => ({ status: 'ok' }));

// SSE: 실시간 이벤트 스트리밍
fastify.get('/stream/live', (request, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');

  const send = (data) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

  // heartbeat 5초마다
  const heartbeat = setInterval(() => send({ ts: Date.now(), event: 'heartbeat' }), 5000);

  // Redis Streams 구독: 새 이벤트 실시간 브로드캐스트
  const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  let lastId = '$';

  const poll = async () => {
    try {
      const result = await subscriber.xread('BLOCK', 4000, 'STREAMS', 'events_stream', lastId);
      if (result) {
        const [, messages] = result[0];
        for (const [id, fields] of messages) {
          lastId = id;
          send({ ts: Date.now(), event: 'new_event', session_id: fields[1] });
        }
      }
    } catch (_) {}
    if (!reply.raw.writableEnded) poll();
  };

  poll();

  request.raw.on('close', () => {
    clearInterval(heartbeat);
    subscriber.quit();
  });
});

// ─────────────────────────────────────────────────────────────
// 집계
//
// 두 지표 모두 Redis 스트림을 직접 훑는다. 데모 규모(수천 건)에서는
// 전체 스캔이 충분히 빠르고, 별도 집계 저장소를 두지 않아도 된다.
// 스트림이 커지면 MAX_SCAN 이 상한을 잡는다.
// ─────────────────────────────────────────────────────────────

const EVENT_STREAM_KEY = process.env.EVENT_STREAM_KEY || 'events_stream';
const INTERVENTION_STREAM_KEY = process.env.INTERVENTION_STREAM_KEY || 'interventions_stream';
const MAX_SCAN = parseInt(process.env.AGGREGATE_MAX_SCAN || '20000', 10);

// ingestion-api 의 열거형과 같은 순서. 한 건도 없는 타입도 0 으로 보여야
// "아직 안 잡힌 신호"가 대시보드에서 눈에 띈다.
const EVENT_TYPES = [
  'visibility_change', 'window_focus', 'idle', 'scroll', 'scroll_depth',
  'form_field', 'clipboard_copy', 'broadcast_channel', 'page_lifecycle',
  'cart_change', 'add_to_cart', 'page_view', 'click', 'external_link',
  'search_query', 'wishlist_add',
];

function fieldsToObject(fields) {
  const out = {};
  for (let i = 0; i < fields.length; i += 2) out[fields[i]] = fields[i + 1];
  return out;
}

fastify.get('/signals/coverage', async () => {
  const counts = {};
  for (const type of EVENT_TYPES) counts[type] = 0;

  let sessions = new Set();
  let total = 0;

  try {
    const entries = await redis.xrevrange(EVENT_STREAM_KEY, '+', '-', 'COUNT', MAX_SCAN);
    for (const [, fields] of entries) {
      const row = fieldsToObject(fields);
      if (row.session_id) sessions.add(row.session_id);
      let event;
      try {
        event = JSON.parse(row.data);
      } catch (_) {
        continue;
      }
      if (event && typeof event.type === 'string' && counts[event.type] !== undefined) {
        counts[event.type] += 1;
        total += 1;
      }
    }
  } catch (err) {
    fastify.log.error({ err }, 'signals/coverage aggregation failed');
  }

  return { counts, total_events: total, sessions: sessions.size, scanned_at: Date.now() };
});

fastify.get('/scenarios/firings', async () => {
  // interventions_stream 은 워커가 개입을 만들 때마다 XADD 한다.
  // 여기가 그 스트림의 첫 소비처다.
  const byScenario = {
    S1: { scenario_id: 'S1', fired: 0, control: 0, treatment: 0 },
    S2: { scenario_id: 'S2', fired: 0, control: 0, treatment: 0 },
  };
  const bySource = { gemini: 0, fallback: 0 };
  const boosterCounts = {};
  let scoreSum = 0;

  try {
    const entries = await redis.xrevrange(INTERVENTION_STREAM_KEY, '+', '-', 'COUNT', MAX_SCAN);
    for (const [, fields] of entries) {
      const row = fieldsToObject(fields);
      const bucket = byScenario[row.scenario_id];
      if (!bucket) continue;

      bucket.fired += 1;
      if (row.ab_group === 'control') bucket.control += 1;
      else bucket.treatment += 1;

      const score = Number(row.intent_score);
      if (Number.isFinite(score)) scoreSum += score;

      if (bySource[row.copy_source] !== undefined) bySource[row.copy_source] += 1;

      try {
        for (const b of JSON.parse(row.scored_boosters || row.active_boosters || '[]')) {
          boosterCounts[b] = (boosterCounts[b] || 0) + 1;
        }
      } catch (_) {
        /* 손상된 항목은 건너뛴다 */
      }
    }
  } catch (err) {
    fastify.log.error({ err }, 'scenarios/firings aggregation failed');
  }

  const scenarios = Object.values(byScenario);
  const totalFired = scenarios.reduce((sum, x) => sum + x.fired, 0);

  return {
    scenarios,
    total_fired: totalFired,
    // control 은 개입이 만들어졌지만 프론트가 표시하지 않은 건수다.
    // 전환 추적이 없으므로 CTR 대신 노출 비율을 그대로 보여준다.
    ab_split: {
      control: scenarios.reduce((sum, x) => sum + x.control, 0),
      treatment: scenarios.reduce((sum, x) => sum + x.treatment, 0),
    },
    copy_source: bySource,
    booster_counts: boosterCounts,
    avg_intent_score: totalFired > 0 ? Math.round((scoreSum / totalFired) * 100) / 100 : 0,
    scanned_at: Date.now(),
  };
});

// ─────────────────────────────────────────────────────────────
// 신호 튜닝 설정 (SIGNAL 콘솔)
//
// hover:config:runtime   운영자 조정값. 희소해도 된다 (건드린 항목만)
// hover:config:effective 워커가 발행하는 병합 결과. 이름 검증의 기준
// hover:config:runtime:prev  1단계 undo
//
// 주의: 4002 는 인증 없는 데모 전용 컨트롤 플레인이다. localhost 밖으로
// 노출하지 말 것. CONFIG_WRITE_TOKEN / CONFIG_WRITE_ENABLED 로 잠글 수 있다.
// ─────────────────────────────────────────────────────────────

const RUNTIME_CONFIG_KEY = 'hover:config:runtime';
const EFFECTIVE_CONFIG_KEY = 'hover:config:effective';
const PREV_CONFIG_KEY = 'hover:config:runtime:prev';

const CONFIG_WRITE_ENABLED = process.env.CONFIG_WRITE_ENABLED !== 'false';
const CONFIG_WRITE_TOKEN = process.env.CONFIG_WRITE_TOKEN || '';

function parseJsonSafe(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

const boosterEntrySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean' },
    weight: { type: 'number', minimum: 0, maximum: 1 },
  },
};

const configBodySchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      expected_version: { type: 'integer', minimum: 0 },
      updated_by: { type: 'string', maxLength: 64 },
      boosters: { type: 'object', additionalProperties: boosterEntrySchema },
      scenarios: {
        type: 'object',
        additionalProperties: false,
        properties: {
          S1: {
            type: 'object',
            additionalProperties: false,
            properties: {
              enabled: { type: 'boolean' },
              cart_min_count: { type: 'integer', minimum: 1, maximum: 10 },
              tab_hidden_seconds: { type: 'integer', minimum: 3, maximum: 300 },
              intent_score_min: { type: 'number', minimum: 0.01, maximum: 2.05 },
            },
          },
          S2: {
            type: 'object',
            additionalProperties: false,
            properties: {
              enabled: { type: 'boolean' },
              intent_score_min: { type: 'number', minimum: 0.01, maximum: 2.05 },
            },
          },
        },
      },
      discount: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tier1_percent: { type: 'integer', minimum: 0, maximum: 90 },
          tier2_min_score: { type: 'number', minimum: 0.01, maximum: 2.05 },
          tier2_percent: { type: 'integer', minimum: 0, maximum: 90 },
          tier3_min_score: { type: 'number', minimum: 0.01, maximum: 2.05 },
          tier3_percent: { type: 'integer', minimum: 0, maximum: 90 },
        },
      },
    },
  },
};

// 슬라이더가 0.30000000000000004 를 주므로 거부하지 않고 2dp 로 스냅한다.
// 워커의 intentScore 도 같은 자리에서 반올림하므로 비교가 정확히 맞는다.
function snap2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeDraft(body) {
  const out = {};
  if (body.boosters) {
    out.boosters = {};
    for (const [name, entry] of Object.entries(body.boosters)) {
      const next = {};
      if (typeof entry.enabled === 'boolean') next.enabled = entry.enabled;
      if (entry.weight !== undefined) next.weight = snap2(entry.weight);
      out.boosters[name] = next;
    }
  }
  if (body.scenarios) {
    out.scenarios = {};
    for (const [id, sc] of Object.entries(body.scenarios)) {
      const next = { ...sc };
      if (next.intent_score_min !== undefined) next.intent_score_min = snap2(next.intent_score_min);
      out.scenarios[id] = next;
    }
  }
  if (body.discount) {
    out.discount = { ...body.discount };
    for (const k of ['tier2_min_score', 'tier3_min_score']) {
      if (out.discount[k] !== undefined) out.discount[k] = snap2(out.discount[k]);
    }
  }
  return out;
}

function writeGuard(request, reply) {
  if (!CONFIG_WRITE_ENABLED) {
    reply.status(403).send({ error: 'config_write_disabled' });
    return false;
  }
  if (CONFIG_WRITE_TOKEN && request.headers['x-hover-config-token'] !== CONFIG_WRITE_TOKEN) {
    reply.status(401).send({ error: 'invalid_config_token' });
    return false;
  }
  return true;
}

async function readConfigState() {
  const [runtimeRaw, effectiveRaw] = await redis.mget(RUNTIME_CONFIG_KEY, EFFECTIVE_CONFIG_KEY);
  const override = parseJsonSafe(runtimeRaw);
  const effective = parseJsonSafe(effectiveRaw);
  return { override, effective };
}

fastify.get('/config', async () => {
  const { override, effective } = await readConfigState();
  return {
    effective,
    override,
    version: override?.version ?? 0,
    updated_at: override?.updated_at ?? null,
    updated_by: override?.updated_by ?? null,
    worker_seen: !!effective,
    write_enabled: CONFIG_WRITE_ENABLED,
    rejected: effective?.rejected ?? [],
  };
});

fastify.put('/config', { schema: configBodySchema }, async (request, reply) => {
  if (!writeGuard(request, reply)) return reply;

  const { override, effective } = await readConfigState();
  const currentVersion = override?.version ?? 0;

  if (request.body.expected_version !== undefined && request.body.expected_version !== currentVersion) {
    // 데모 자체가 멀티탭이라 두 패널이 서로 덮어쓰는 건 현실적인 시나리오다.
    return reply.status(409).send({ error: 'version_conflict', current: currentVersion, override });
  }

  // 워커가 아직 발행하지 않았으면 이름 검증을 건너뛴다 (콜드 스타트 데드락 방지).
  if (effective?.boosters && request.body.boosters) {
    const unknown = Object.keys(request.body.boosters).filter((name) => !effective.boosters[name]);
    if (unknown.length > 0) {
      return reply.status(422).send({ error: 'unknown_booster', unknown });
    }
  }

  const next = {
    ...normalizeDraft(request.body),
    version: currentVersion + 1,
    updated_at: Date.now(),
    updated_by: String(request.body.updated_by || 'debug-panel').slice(0, 64),
  };

  const multi = redis.multi();
  if (override) multi.set(PREV_CONFIG_KEY, JSON.stringify(override));
  multi.set(RUNTIME_CONFIG_KEY, JSON.stringify(next));
  await multi.exec();

  return { version: next.version, override: next, applied_at: next.updated_at };
});

fastify.delete('/config', async (request, reply) => {
  if (!writeGuard(request, reply)) return reply;
  const raw = await redis.get(RUNTIME_CONFIG_KEY);
  const multi = redis.multi();
  if (raw) multi.set(PREV_CONFIG_KEY, raw);
  multi.del(RUNTIME_CONFIG_KEY);
  await multi.exec();
  return { version: 0, override: null };
});

fastify.post('/config/rollback', async (request, reply) => {
  if (!writeGuard(request, reply)) return reply;
  const prevRaw = await redis.get(PREV_CONFIG_KEY);
  const prev = parseJsonSafe(prevRaw);
  if (!prev) return reply.status(404).send({ error: 'no_previous_config' });

  const current = parseJsonSafe(await redis.get(RUNTIME_CONFIG_KEY));
  const restored = { ...prev, version: (current?.version ?? prev.version ?? 0) + 1, updated_at: Date.now() };
  await redis.set(RUNTIME_CONFIG_KEY, JSON.stringify(restored));
  return { version: restored.version, override: restored };
});

fastify.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return reply.status(400).send({
      error: 'invalid_config_payload',
      details: error.validation.map((v) => ({ path: v.instancePath, message: v.message })),
    });
  }
  request.log.error(error);
  return reply.status(500).send({ error: 'Internal server error' });
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
