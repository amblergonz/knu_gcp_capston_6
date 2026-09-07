import { getTabId } from './session';
import { pushLog } from './store';

// 같은 오리진의 열린 탭 수를 센다.
// 워커는 broadcast_channel { tab_count >= 2 } 를 보고 멀티탭 부스터(+0.4)를 켠다.

const CHANNEL = 'hover-demo-tabs';
const PING_MS = 5000;
const STALE_MS = 15000;
const SETTLE_MS = 500;
const MIN_EMIT_INTERVAL_MS = 2000;

type Msg = { type: 'hello' | 'here' | 'ping' | 'bye'; tabId: string; ts: number };

export interface TabCensus {
  stop(): void;
  getCount(): number;
  tabId: string;
}

export function startTabCensus(onCount: (count: number) => void): TabCensus {
  const tabId = getTabId();

  if (typeof BroadcastChannel === 'undefined') {
    pushLog('info', 'broadcast_channel', '브라우저 미지원 — 탭 수 1로 고정');
    onCount(1);
    return { stop() {}, getCount: () => 1, tabId };
  }

  const channel = new BroadcastChannel(CHANNEL);
  const peers = new Map<string, number>();

  let count = 1;
  let lastEmitted = 0;
  let lastEmitAt = 0;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const post = (type: Msg['type']) => {
    try {
      channel.postMessage({ type, tabId, ts: Date.now() } satisfies Msg);
    } catch {
      /* 채널이 닫혔으면 무시 */
    }
  };

  const settle = () => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      const next = peers.size + 1;
      count = next;
      const now = Date.now();
      // 카운트가 실제로 바뀐 순간에만, 그리고 2초에 한 번만 보고한다.
      if (next !== lastEmitted && now - lastEmitAt >= MIN_EMIT_INTERVAL_MS) {
        lastEmitted = next;
        lastEmitAt = now;
        onCount(next);
      }
    }, SETTLE_MS);
  };

  channel.onmessage = (e: MessageEvent<Msg>) => {
    const msg = e.data;
    if (!msg || typeof msg.tabId !== 'string' || msg.tabId === tabId) return;

    if (msg.type === 'bye') {
      peers.delete(msg.tabId);
      settle();
      return;
    }

    const known = peers.has(msg.tabId);
    peers.set(msg.tabId, Date.now());

    // 새로 등장한 탭에게는 즉시 응답해 한 번의 왕복으로 인구조사가 수렴하게 한다.
    if (msg.type === 'hello') post('here');
    if (!known) settle();
  };

  const sweep = setInterval(() => {
    const cutoff = Date.now() - STALE_MS;
    let changed = false;
    for (const [id, seen] of peers) {
      if (seen < cutoff) {
        peers.delete(id);
        changed = true;
      }
    }
    post('ping');
    if (changed) settle();
  }, PING_MS);

  const bye = () => post('bye');
  window.addEventListener('pagehide', bye);
  window.addEventListener('beforeunload', bye);

  post('hello');
  // 혼자여도 한 번은 보고해서 채널이 살아 있음을 패널에서 확인할 수 있게 한다.
  settle();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(sweep);
      if (settleTimer !== null) clearTimeout(settleTimer);
      window.removeEventListener('pagehide', bye);
      window.removeEventListener('beforeunload', bye);
      bye();
      try {
        channel.close();
      } catch {
        /* noop */
      }
    },
    getCount: () => count,
    tabId,
  };
}
