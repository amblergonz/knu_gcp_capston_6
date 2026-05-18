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

// 16개 신호별 수집 카운트 (stub — ClickHouse 연동 전 mock)
fastify.get('/signals/coverage', async () => {
  const signals = [
    'visibility_change', 'clipboard_copy', 'scroll_depth', 'mouse_leave',
    'session_duration', 'referrer_price_compare', 'broadcast_multi_tab',
    'add_to_cart', 'page_view', 'click', 'form_focus', 'idle_timeout',
    'back_button', 'external_link', 'search_query', 'wishlist_add',
  ];
  const coverage = {};
  for (const sig of signals) {
    coverage[sig] = Math.floor(Math.random() * 500);
  }
  return coverage;
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

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
