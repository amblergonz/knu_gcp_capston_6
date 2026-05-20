const fastify = require('fastify')({ logger: true });
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const PORT = parseInt(process.env.PORT || '4000', 10);

fastify.register(require('@fastify/cors'), { origin: '*' });

const eventTypes = [
  'visibility_change',
  'window_focus',
  'idle',
  'scroll',
  'scroll_depth',
  'form_field',
  'clipboard_copy',
  'broadcast_channel',
  'page_lifecycle',
  'cart_change',
  'add_to_cart',
  'page_view',
  'click',
  'external_link',
  'search_query',
  'wishlist_add',
];

const eventSchema = {
  body: {
    type: 'object',
    required: ['session_id', 'events', 'device'],
    additionalProperties: true,
    properties: {
      session_id: { type: 'string', minLength: 1, maxLength: 128 },
      user_id: { type: 'string', maxLength: 128 },
      device: { type: 'string', enum: ['desktop', 'mobile', 'tablet'] },
      events: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: {
          type: 'object',
          required: ['event_id', 'ts', 'type', 'payload', 'page_url'],
          additionalProperties: true,
          properties: {
            event_id: { type: 'string', minLength: 1, maxLength: 128 },
            ts: { type: 'number' },
            type: { type: 'string', enum: eventTypes },
            payload: { type: 'object' },
            page_url: { type: 'string', minLength: 1, maxLength: 2048 },
            referrer: { type: 'string', maxLength: 2048 },
          },
        },
      },
    },
  },
};

fastify.setErrorHandler((err, request, reply) => {
  if (err.validation) {
    return reply.status(400).send({
      error: 'Invalid event payload',
      details: err.validation.map((issue) => ({
        path: issue.instancePath || issue.schemaPath,
        message: issue.message,
      })),
    });
  }

  request.log.error(err);
  return reply.status(500).send({ error: 'Internal server error' });
});

fastify.post('/events', { schema: eventSchema }, async (request, reply) => {
  const { session_id, events } = request.body;

  for (const event of events) {
    await redis.xadd(
      'events_stream', '*',
      'session_id', session_id,
      'device', request.body.device,
      'user_id', request.body.user_id || '',
      'data', JSON.stringify(event)
    );
  }

  return reply.status(202).send({ status: 'accepted', accepted: events.length });
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
