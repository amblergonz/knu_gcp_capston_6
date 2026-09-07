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

// 16개 신호별 수집 카운트 (stub — ClickHouse 연동 전 mock, 고정값)
fastify.get('/signals/coverage', async () => {
  return {
    page_view:               2847,
    visibility_change:       1923,
    click:                   1654,
    scroll_depth:            1432,
    idle_timeout:             891,
    session_duration:        1203,
    add_to_cart:              743,
    form_focus:               612,
    referrer_price_compare:   387,
    external_link:            431,
    search_query:             512,
    mouse_leave:              934,
    back_button:              289,
    clipboard_copy:           264,
    broadcast_multi_tab:      198,
    wishlist_add:             178,
  };
});

// 시나리오별 발화 통계 (stub — ClickHouse 연동 전 mock)
fastify.get('/scenarios/firings', async (request) => {
  const { from, to } = request.query;
  return {
    from: from || null,
    to: to || null,
    scenarios: [
      { scenario_id: 'S1', fired: 42, converted: 7, ctr: 0.167 },
      { scenario_id: 'S2', fired: 18, converted: 3, ctr: 0.167 },
    ],
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
