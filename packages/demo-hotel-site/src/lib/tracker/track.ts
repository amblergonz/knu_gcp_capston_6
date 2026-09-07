import { enqueue } from './queue';
import { getSession, touchSession } from './session';
import { applyEventToMirror, computeIntentScore, emptyMirror, type Mirror } from './rules';
import { getSnapshot } from './store';
import { bumpCount, patch, pushLog } from './store';
import { isEventType, type EventType, type TrackedEvent } from './types';

let mirror: Mirror = emptyMirror(Date.now());

export function getMirror(): Mirror {
  return mirror;
}

export function resetMirror(now = Date.now()) {
  mirror = emptyMirror(now);
  syncMirror();
}

export function syncMirror() {
  const cfg = getSnapshot().config;
  patch({
    cartCount: mirror.cartCount,
    hiddenAt: mirror.hiddenAt,
    hiddenCount: mirror.hiddenCount,
    searchCount: mirror.searchCount,
    boosters: mirror.boosters.slice(),
    intentScore: computeIntentScore(mirror.boosters, cfg),
    hotelName: mirror.hotelName,
    tabCount: mirror.tabCount,
  });
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* 비보안 오리진에서는 randomUUID 가 없다 */
  }
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** ingestion 스키마를 통과하도록 안전하게 정규화한다. 이벤트 하나가 배치 전체를 400 낸다. */
function buildEvent(type: EventType, payload: Record<string, unknown>, ts?: number): TrackedEvent | null {
  const session = getSession();
  if (!session) return null;

  let safePayload: Record<string, unknown> = {};
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    try {
      // 직렬화 불가능한 값이 섞이면 여기서 걸러 이벤트 하나만 버린다.
      safePayload = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    } catch {
      safePayload = {};
      pushLog('error', type, 'payload 직렬화 실패 — 빈 객체로 대체');
    }
  }

  const url = typeof window !== 'undefined' ? window.location.href : '/';

  return {
    event_id: randomId().slice(0, 128),
    ts: Number(ts ?? Date.now()),
    type,
    payload: safePayload,
    page_url: (url || '/').slice(0, 2048),
    referrer: session.referrer ? session.referrer.slice(0, 2048) : undefined,
  };
}

export interface TrackOptions {
  /** 과거 시각으로 보내야 하는 경우 (탭 숨김 구제 재전송) */
  ts?: number;
  /** 큐에 넣지 않고 이벤트 객체만 만든다 */
  buildOnly?: boolean;
}

export function track(
  type: EventType,
  payload: Record<string, unknown> = {},
  opts: TrackOptions = {},
): TrackedEvent | null {
  if (typeof window === 'undefined') return null;

  if (!isEventType(type)) {
    // enum 밖의 타입은 보내면 배치 전체가 400 이므로 여기서 끊는다.
    pushLog('error', String(type), 'ingestion enum 에 없는 이벤트 타입');
    if (process.env.NODE_ENV === 'development') {
      console.error('[hover] 허용되지 않은 이벤트 타입:', type);
    }
    return null;
  }

  const ev = buildEvent(type, payload, opts.ts);
  if (!ev) return null;

  const now = Date.now();
  applyEventToMirror(mirror, ev, now, getSnapshot().config);
  syncMirror();
  touchSession();
  bumpCount(type);

  if (!opts.buildOnly) enqueue(ev);
  return ev;
}

/** 이미 만들어 둔 이벤트를 그대로 큐에 넣는다 (구제 재전송용). */
export function enqueueRaw(ev: TrackedEvent) {
  enqueue(ev);
}
