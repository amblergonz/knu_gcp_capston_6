import { TRACKER_CONFIG } from './config';
import { EVENT_TYPES, type DecisionPayload, type LogEntry, type LogLevel, type TrackerSnapshot } from './types';

// 디버그 패널이 구독하는 모듈 싱글턴.
// useSyncExternalStore 의 getServerSnapshot 이 이 고정 객체를 그대로 돌려주기 때문에
// 서버 렌더와 첫 클라이언트 렌더의 참조가 같아 하이드레이션이 절대 어긋나지 않는다.

const zeroCounts: Record<string, number> = {};
for (const t of EVENT_TYPES) zeroCounts[t] = 0;

export const INITIAL_SNAPSHOT: TrackerSnapshot = Object.freeze({
  ready: false,
  sessionId: '',
  abGroup: 'treatment',
  referrer: '',
  referrerMatched: false,
  device: 'desktop',
  sessionStartedAt: 0,
  cartCount: 0,
  hiddenAt: 0,
  hiddenCount: 0,
  boosters: [],
  intentScore: 0,
  hotelName: '',
  tabCount: 1,
  ingestion: 'unknown',
  decision: 'unknown',
  queued: 0,
  paused: false,
  clockSkewMs: null,
  counts: Object.freeze({ ...zeroCounts }) as Record<string, number>,
  log: Object.freeze([]) as unknown as LogEntry[],
  decisions: Object.freeze([]) as unknown as DecisionPayload[],
  lastAuthoritative: null,
}) as TrackerSnapshot;

let snapshot: TrackerSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();
let logSeq = 0;
let frame: number | null = null;

function notify() {
  // rAF 로 합쳐서 스크롤 폭주 때 패널이 프레임을 잡아먹지 않게 한다.
  if (frame !== null) return;
  const run = () => {
    frame = null;
    for (const l of listeners) l();
  };
  if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(run);
  else {
    frame = 1;
    setTimeout(run, 16);
  }
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSnapshot(): TrackerSnapshot {
  return snapshot;
}

export function getServerSnapshot(): TrackerSnapshot {
  return INITIAL_SNAPSHOT;
}

export function patch(partial: Partial<TrackerSnapshot>) {
  snapshot = { ...snapshot, ...partial };
  notify();
}

export function pushLog(level: LogLevel, type: string, detail?: string) {
  const entry: LogEntry = { id: ++logSeq, ts: Date.now(), level, type, detail };
  const log = [entry, ...snapshot.log].slice(0, TRACKER_CONFIG.maxLogEntries);
  snapshot = { ...snapshot, log };
  notify();
}

export function bumpCount(type: string) {
  const counts = { ...snapshot.counts, [type]: (snapshot.counts[type] ?? 0) + 1 };
  snapshot = { ...snapshot, counts };
  notify();
}

export function pushDecision(d: DecisionPayload) {
  snapshot = {
    ...snapshot,
    decisions: [d, ...snapshot.decisions].slice(0, 10),
    lastAuthoritative: { intentScore: d.intent_score, boosters: d.active_boosters },
  };
  notify();
}

export function resetCounts() {
  snapshot = {
    ...snapshot,
    counts: { ...zeroCounts },
    log: [],
    decisions: [],
    lastAuthoritative: null,
  };
  notify();
}
