const fastify = require('fastify')({ logger: true });
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const PORT = parseInt(process.env.PORT || '4000', 10);

fastify.register(require('@fastify/cors'), { origin: '*' });

fastify.post('/events', async (request, reply) => {
  const { session_id, events } = request.body;

  if (!session_id || !Array.isArray(events) || events.length === 0) {
    return reply.status(400).send({ error: 'Missing session_id or events' });
  }

  for (const event of events) {
    await redis.xadd(
      'events_stream', '*',
      'session_id', session_id,
      'data', JSON.stringify(event)
    );
  }

  return reply.status(202).send({ status: 'accepted' });
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
