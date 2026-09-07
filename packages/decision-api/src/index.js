const fastify = require('fastify')({ logger: true });
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const PORT = parseInt(process.env.PORT || '4001', 10);

fastify.register(require('@fastify/cors'), { origin: '*' });

const decisionParamsSchema = {
  params: {
    type: 'object',
    required: ['session_id'],
    properties: {
      session_id: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
};

function sanitizeDecisionPayload(payload, session_id) {
  return {
    intervention_id: String(payload.intervention_id),
    session_id,
    scenario_id: payload.scenario_id,
    ab_group: payload.ab_group,
    component: payload.component,
    copy: payload.copy,
    context: payload.context || {},
    ttl_seconds: Number(payload.ttl_seconds || 600),
    intent_score: payload.intent_score,
    active_boosters: payload.active_boosters || [],
    // 꺼진 신호를 뺀 실제 채점 대상. 이게 없으면 패널의 서버-클라 비교가
    // 영구히 "불일치"로 표시된다.
    scored_boosters: payload.scored_boosters || payload.active_boosters || [],
    config_version: payload.config_version ?? 0,
    copy_source: payload.copy_source || 'fallback',
  };
}

fastify.setErrorHandler((err, request, reply) => {
  if (err.validation) {
    return reply.status(400).send({ error: 'Invalid session_id' });
  }

  request.log.error(err);
  return reply.status(500).send({ error: 'Internal server error' });
});

fastify.get('/decision/:session_id', { schema: decisionParamsSchema }, async (request, reply) => {
  const { session_id } = request.params;
  const raw = await redis.get(`pending:${session_id}`);

  if (!raw) {
    return reply.status(204).send();
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    request.log.error({ err, session_id }, 'Invalid pending intervention payload');
    await redis.del(`pending:${session_id}`);
    return reply.status(500).send({ error: 'Invalid pending intervention payload' });
  }

  await redis.del(`pending:${session_id}`);
  return reply.status(200).send(sanitizeDecisionPayload(payload, session_id));
});

fastify.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
