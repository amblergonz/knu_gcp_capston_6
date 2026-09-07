import { TRACKER_CONFIG } from './config';
import { getDecision } from './transport';
import { getSession } from './session';
import { patch, pushDecision, pushLog } from './store';
import type { DecisionPayload } from './types';

// 폴러는 React 밖의 모듈 싱글턴이다.
// 컴포넌트 언마운트나 StrictMode 이중 실행이 진행 중인 요청을 취소하면
// 원샷 페이로드가 영구히 사라지기 때문에, React 는 구독만 하고 소유하지 않는다.

type Sink = (d: DecisionPayload) => void;

let sink: Sink | null = null;
let pollToken = 0;
let running = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let tabCountRef = () => 1;

export function setDecisionSink(fn: Sink | null) {
  sink = fn;
}

export function setTabCountGetter(fn: () => number) {
  tabCountRef = fn;
}

function canPoll(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.visibilityState !== 'visible') return false;
  // 탭이 두 개 이상이면 포커스된 탭만 폴링한다.
  // 배경 탭이 원샷 개입을 가로채면 발표자 화면에는 아무것도 안 뜬다.
  if (tabCountRef() > 1 && typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
  return true;
}

function isDecision(v: unknown): v is DecisionPayload {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return typeof d.intervention_id === 'string' && typeof d.component === 'string' && !!d.copy;
}

export async function pollOnce(): Promise<DecisionPayload | null> {
  const session = getSession();
  if (!session) return null;

  const res = await getDecision(session.session_id);

  if (res.status === 200 && isDecision(res.json)) {
    const d = res.json;
    // 렌더보다 먼저 보존한다. 위젯이 터져도 패널과 sessionStorage 에는 남는다.
    try {
      sessionStorage.setItem('hover_demo_last_decision', JSON.stringify(d));
    } catch {
      /* noop */
    }
    patch({ decision: 'ok' });
    pushDecision(d);
    pushLog('decision', `${d.scenario_id} ${d.component}`, `intent ${d.intent_score} · ${d.ab_group}`);
    sink?.(d);
    return d;
  }

  if (res.status === 204) {
    patch({ decision: 'ok' });
    return null;
  }

  patch({ decision: 'down' });
  if (res.error) pushLog('error', 'decision', res.error);
  return null;
}

/**
 * smoke-be-c.js:66-78 과 같은 리듬으로 300ms 간격, 최대 8초 폴링한다.
 * 워커가 XREAD BLOCK 으로 스트림을 소비하므로 이벤트 POST 직후에는
 * 아직 판정 전일 수 있고, 204 는 "아직" 이라는 뜻이다.
 */
export function requestPoll(reason: string) {
  if (running) return;
  if (!canPoll()) return;

  running = true;
  const token = ++pollToken;
  const deadline = Date.now() + TRACKER_CONFIG.decisionPollWindowMs;

  const step = async () => {
    if (token !== pollToken) {
      running = false;
      return;
    }
    const found = await pollOnce();
    if (found || Date.now() >= deadline) {
      running = false;
      return;
    }
    setTimeout(step, TRACKER_CONFIG.decisionPollIntervalMs);
  };

  pushLog('info', 'decision 폴링', reason);
  void step();
}

export function stopPolling() {
  pollToken += 1;
  running = false;
}

/**
 * 15초 하트비트.
 * session_length_5min 이 넘어가는 순간을 잡고, 아무도 소비하지 않아
 * 300초 동안 두 번째 시나리오를 막는 pending 키를 비워 준다.
 */
export function startHeartbeat() {
  if (heartbeat !== null) return;
  heartbeat = setInterval(() => {
    if (canPoll()) void pollOnce();
  }, TRACKER_CONFIG.heartbeatPollMs);
}

export function stopHeartbeat() {
  if (heartbeat !== null) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}
