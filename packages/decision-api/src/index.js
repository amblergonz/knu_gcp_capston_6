const fastify = require('fastify')({ logger: true });
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const PORT = parseInt(process.env.PORT || '4001', 10);

fastify.register(require('@fastify/cors'), { origin: '*' });

// GET /decision/:session_id — 준비된 개입 조회 (1회 전달 후 삭제)
fastify.get('/decision/:session_id', async (request, reply) => {
  const { session_id } = request.params;
  const raw = await redis.get(`pending:${session_id}`);

  if (!raw) {
    return reply.status(204).send();
  }

  await redis.del(`pending:${session_id}`);
  return reply.status(200).send(JSON.parse(raw));
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
