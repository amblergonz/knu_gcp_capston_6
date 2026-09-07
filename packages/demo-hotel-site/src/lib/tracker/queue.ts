import { TRACKER_CONFIG } from './config';
import { beaconEvents, postEvents } from './transport';
import { patch, pushLog } from './store';
import type { Device, EventEnvelope, EventType, TrackedEvent } from './types';

// 디바운스를 건너뛰고 즉시 전송해야 하는 타입.
// 전부 워커의 룰 상태를 직접 바꾸는 것들이라 도착 지연이 곧 시나리오 실패다.
const IMMEDIATE: ReadonlySet<EventType> = new Set<EventType>([
  'visibility_change',
  'page_lifecycle',
  'clipboard_copy',
  'broadcast_channel',
  'add_to_cart',
  'cart_change',
  'external_link',
]);

let queue: TrackedEvent[] = [];
let meta: { session_id: string; user_id?: string; device: Device } | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let paused = false;

// 단일 비행 체인.
// hidden 이 visible 보다 먼저 Redis 스트림에 들어가야 hidden_at 이 제대로 잡힌다.
// 두 POST 가 겹치면 순서가 뒤집힐 수 있으므로 절대 동시에 보내지 않는다.
let chain: Promise<void> = Promise.resolve();

export function setEnvelope(next: { session_id: string; user_id?: string; device: Device }) {
  meta = next;
}

export function setPaused(v: boolean) {
  paused = v;
  patch({ paused: v });
}

export function isPaused() {
  return paused;
}

export function queueLength() {
  return queue.length;
}

function clearTimers() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (maxWaitTimer !== null) {
    clearTimeout(maxWaitTimer);
    maxWaitTimer = null;
  }
}

function envelopeFor(events: TrackedEvent[]): EventEnvelope | null {
  if (!meta) return null;
  return {
    session_id: meta.session_id,
    user_id: meta.user_id,
    device: meta.device,
    events,
  };
}

export function enqueue(ev: TrackedEvent): void {
  if (paused) {
    pushLog('info', ev.type, '전송 일시정지 중');
    return;
  }

  queue.push(ev);
  if (queue.length > TRACKER_CONFIG.maxQueueLength) {
    queue = queue.slice(-TRACKER_CONFIG.maxQueueLength);
    pushLog('error', 'queue', '큐가 가득 차 오래된 이벤트를 버렸습니다');
  }
  patch({ queued: queue.length });

  if (IMMEDIATE.has(ev.type) || queue.length >= TRACKER_CONFIG.maxBatchSize) {
    void flush(IMMEDIATE.has(ev.type) ? `immediate:${ev.type}` : 'batch_full');
    return;
  }

  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void flush('debounce'), TRACKER_CONFIG.flushDebounceMs);

  // 스크롤처럼 계속 들어오는 이벤트가 디바운스를 무한히 미루지 못하게 하는 상한.
  if (maxWaitTimer === null) {
    maxWaitTimer = setTimeout(() => void flush('max_wait'), TRACKER_CONFIG.flushMaxWaitMs);
  }
}

async function doFlush(reason: string): Promise<void> {
  if (queue.length === 0) return;
  clearTimers();

  const batch = queue.splice(0, TRACKER_CONFIG.hardBatchCap);
  patch({ queued: queue.length });

  const env = envelopeFor(batch);
  if (!env) {
    queue.unshift(...batch);
    return;
  }

  let attempt = 0;
  for (;;) {
    const res = await postEvents(env);

    if (res.ok) {
      patch({ ingestion: 'ok', queued: queue.length });
      pushLog('sent', `${batch.length}건 전송`, reason);
      return;
    }

    if (!res.retriable) {
      // 400 — 계약 위반. 재시도하지 않고 눈에 띄게 남긴다.
      patch({ ingestion: 'ok' });
      pushLog('error', '계약 위반 400', res.detail);
      return;
    }

    attempt += 1;
    if (attempt >= 3) {
      // 순서를 지키려면 앞쪽에 되돌린다.
      queue.unshift(...batch);
      queue = queue.slice(0, TRACKER_CONFIG.maxQueueLength);
      patch({ ingestion: 'down', queued: queue.length });
      pushLog('error', '전송 실패', res.detail);
      return;
    }

    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
}

export function flush(reason: string): Promise<void> {
  chain = chain.then(() => doFlush(reason)).catch(() => {});
  return chain;
}

/** 탭이 숨겨지거나 페이지가 사라질 때. 동기 전송이라 타이머 throttle 을 타지 않는다. */
export function flushWithBeacon(extra?: TrackedEvent): boolean {
  const batch = queue.splice(0, TRACKER_CONFIG.hardBatchCap);
  if (extra) batch.push(extra);
  patch({ queued: queue.length });
  if (batch.length === 0) return true;

  const env = envelopeFor(batch);
  if (!env) return false;

  const ok = beaconEvents(env);
  pushLog(ok ? 'sent' : 'error', `${batch.length}건 beacon`, ok ? 'visibility_hidden' : 'beacon 실패');
  return ok;
}

export function drain(): TrackedEvent[] {
  const out = queue;
  queue = [];
  clearTimers();
  patch({ queued: 0 });
  return out;
}
