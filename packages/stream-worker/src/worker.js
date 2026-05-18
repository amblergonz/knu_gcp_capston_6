const Redis = require('ioredis');
const { Engine } = require('json-rules-engine');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const engine = new Engine();

// 이탈 감지 룰: visibility_change(hidden=true) 이벤트 수신 시 개입 생성
engine.addRule({
  conditions: {
    all: [
      { fact: 'type', operator: 'equal', value: 'visibility_change' },
      { fact: 'hidden', operator: 'equal', value: true },
    ],
  },
  event: { type: 'exit_intent_detected' },
});

async function createIntervention(session_id) {
  const intervention = {
    intervention_id: `int-${Date.now()}`,
    scenario_id: 'S1',
    ab_group: Math.random() < 0.5 ? 'treatment' : 'control',
    component: 'coupon_modal',
    copy: {
      title: '떠나기 전 잠깐!',
      body: '지금 구매하시면 10% 추가 할인 쿠폰을 드려요.',
      cta: '쿠폰 받기',
    },
    context: { hotel_name: '신라호텔' },
    ttl_seconds: 300,
  };
  // pending key TTL = 5분 (300초)
  await redis.setex(`pending:${session_id}`, 300, JSON.stringify(intervention));
  console.log(`[Worker] Intervention created for session ${session_id}`);
}

async function processStream() {
  console.log('[Worker] Stream Worker started...');
  // 시작 시 기존 스트림 끝($)부터 읽기
  let lastId = '$';

  while (true) {
    try {
      const result = await redis.xread('BLOCK', 5000, 'STREAMS', 'events_stream', lastId);
      if (!result) continue;

      const [, messages] = result[0];
      for (const [id, fields] of messages) {
        lastId = id;
        const session_id = fields[1];
        const eventData = JSON.parse(fields[3]);

        console.log(`[Worker] Processing event for session ${session_id}:`, eventData.type);

        const facts = {
          type: eventData.type,
          hidden: eventData.payload?.hidden ?? false,
        };

        const { events } = await engine.run(facts);
        if (events.some((e) => e.type === 'exit_intent_detected')) {
          await createIntervention(session_id);
        }
      }
    } catch (err) {
      console.error('[Worker] Error:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

processStream();
