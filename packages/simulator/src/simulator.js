const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const INGESTION_URL = process.env.INGESTION_URL || 'http://localhost:4000/events';
const USER_COUNT = parseInt(process.env.USER_COUNT || '10', 10);

const EVENT_TYPES = ['page_view', 'scroll_depth', 'click', 'visibility_change', 'add_to_cart'];

function randomEvent(type) {
  const base = { event_id: uuidv4(), ts: Date.now(), type, page_url: 'https://demo-hotel.local/room/101' };
  if (type === 'visibility_change') return { ...base, payload: { hidden: true } };
  if (type === 'scroll_depth') return { ...base, payload: { depth_pct: Math.floor(Math.random() * 100) } };
  return { ...base, payload: {} };
}

async function simulateUser(userId) {
  const session_id = `sim-${userId}-${uuidv4()}`;
  // 랜덤 3~6개 이벤트 발송, 마지막은 항상 visibility_change(이탈)
  const count = 3 + Math.floor(Math.random() * 4);
  const events = Array.from({ length: count - 1 }, () =>
    randomEvent(EVENT_TYPES[Math.floor(Math.random() * (EVENT_TYPES.length - 1))])
  );
  events.push(randomEvent('visibility_change'));

  try {
    const res = await axios.post(INGESTION_URL, { session_id, events, device: 'desktop' });
    console.log(`[Simulator] User ${userId} (${session_id}): ${res.status}`);
  } catch (err) {
    console.error(`[Simulator] User ${userId} failed:`, err.message);
  }

  return session_id;
}

async function run() {
  console.log(`[Simulator] Starting simulation for ${USER_COUNT} users → ${INGESTION_URL}`);
  const sessions = [];
  for (let i = 0; i < USER_COUNT; i++) {
    sessions.push(await simulateUser(i));
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log('[Simulator] Done. Sessions:', sessions);
}

run();
