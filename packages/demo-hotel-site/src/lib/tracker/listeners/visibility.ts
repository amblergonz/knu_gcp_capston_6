import { track, enqueueRaw } from '../track';
import { flush, flushWithBeacon } from '../queue';
import { requestPoll, startHeartbeat, stopHeartbeat, stopPolling } from '../decisionPoller';
import { pushLog } from '../store';
import { getSnapshot } from '../store';
import type { TrackedEvent } from '../types';

// 이 레이어에서 가장 하중이 큰 파일. S1 시나리오 전체가 여기 타이밍에 달려 있다.
//
// 워커는 이벤트가 도착할 때만 룰을 평가한다(타이머 없음). 그리고 worker.js:564-573 의
// preUpdateDecision 이 "다시 보이게 된" 이벤트에서 hidden_at 을 지우기 전에 먼저 평가한다.
// 따라서 정규 경로는: 숨김 → 10초 이상 대기 → 복귀 → 복귀 이벤트가 S1 을 발화 → 폴링.

let lastHideEvent: TrackedEvent | null = null;
let hiddenSince = 0;

export function installVisibility(): () => void {
  const onChange = () => {
    const hidden = document.visibilityState === 'hidden';

    if (hidden) {
      stopPolling();
      stopHeartbeat();

      const ev = track('visibility_change', { hidden: true, path: location.pathname }, { buildOnly: true });
      if (ev) {
        lastHideEvent = ev;
        hiddenSince = ev.ts;
        // 큐에 쌓인 것까지 한 번에, 동기 beacon 으로 내보낸다.
        // 이 시점부터 setTimeout 은 브라우저에 의해 최소 1분까지 늘어날 수 있다.
        flushWithBeacon(ev);
      }
      return;
    }

    const hiddenMs = hiddenSince ? Date.now() - hiddenSince : 0;

    // 구제 재전송.
    // beacon 은 실패해도 아무 신호가 없다(프리플라이트 실패든 뭐든 조용하다).
    // 숨김이 10초를 넘겼는데 그 hide 가 유실됐다면 S1 이 통째로 죽으므로 같은 event_id 로 다시 보낸다.
    // - beacon 이 도착했었다면: worker.js:250 의 `if (hidden && !state.hidden_at)` 때문에 no-op.
    // - 유실됐다면: 과거 ts 로 hidden_at 이 잡혀 워커가 이 이벤트 자체에서 S1 을 발화한다
    //   (smoke-be-c.js:127-160 이 쓰는 바로 그 경로).
    const hideThresholdMs = getSnapshot().config.scenarios.S1.tab_hidden_seconds * 1000;
    if (lastHideEvent && hiddenMs >= hideThresholdMs) {
      enqueueRaw(lastHideEvent);
      pushLog('info', 'visibility_change', `hide 구제 재전송 (${Math.round(hiddenMs / 1000)}초)`);
    }
    lastHideEvent = null;

    track('visibility_change', {
      hidden: false,
      path: location.pathname,
      hidden_ms: hiddenMs,
    });
    hiddenSince = 0;

    // 순서가 보장된 하나의 POST 가 끝난 뒤에 폴링을 시작한다.
    void flush('visibility_return').then(() => {
      requestPoll('visibility_return');
      startHeartbeat();
    });
  };

  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}
