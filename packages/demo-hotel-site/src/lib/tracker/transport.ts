import { TRACKER_CONFIG } from './config';
import { recordServerDate } from './clockSkew';
import type { EventEnvelope } from './types';

export interface PostResult {
  ok: boolean;
  status: number;
  retriable: boolean;
  detail?: string;
}

const EVENTS_URL = () => `${TRACKER_CONFIG.ingestionUrl}/events`;

export async function postEvents(env: EventEnvelope): Promise<PostResult> {
  const body = JSON.stringify(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const sentAt = Date.now();

  try {
    const res = await fetch(EVENTS_URL(), {
      method: 'POST',
      // origin:'*' CORS 와 credentials 는 같이 쓸 수 없다. 절대 넣지 말 것.
      headers: { 'content-type': 'application/json' },
      body,
      signal: controller.signal,
    });

    recordServerDate(res.headers.get('date'), sentAt);

    if (res.ok) return { ok: true, status: res.status, retriable: false };

    // 400 은 스키마 위반이다. 재시도하면 영원히 같은 실패를 반복하므로 즉시 버린다.
    let detail = `HTTP ${res.status}`;
    if (res.status === 400) {
      try {
        const json = await res.json();
        detail = JSON.stringify(json).slice(0, 300);
      } catch {
        /* noop */
      }
    }
    return { ok: false, status: res.status, retriable: res.status !== 400, detail };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      retriable: true,
      detail: err instanceof Error ? err.message : 'network error',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 탭이 숨겨지는 순간에는 타이머가 throttle 되므로 동기 전송이어야 한다.
 * Blob 의 type 을 'application/json' 으로 지정하지 않으면 브라우저가 text/plain 으로 보내고
 * Fastify 의 content-type 파서가 조용히 거절한다 — 에러가 아무 데도 안 남는 실패 경로다.
 */
export function beaconEvents(env: EventEnvelope): boolean {
  const body = JSON.stringify(env);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(EVENTS_URL(), blob)) return true;
    }
  } catch {
    /* 아래 keepalive fetch 로 폴백 */
  }

  try {
    void fetch(EVENTS_URL(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export interface DecisionResult {
  status: number;
  json: unknown | null;
  error?: string;
}

/**
 * decision-api 는 원샷이다 (decision-api/src/index.js:61 이 응답 전에 Redis 키를 DEL 한다).
 * 그래서 AbortController 를 붙이지 않는다 — 중단된 요청도 서버에서는 이미 소비됐을 수 있고,
 * 그 경우 개입을 영구히 잃는다.
 */
export async function getDecision(sessionId: string): Promise<DecisionResult> {
  try {
    const res = await fetch(`${TRACKER_CONFIG.decisionUrl}/decision/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.status === 200) {
      const json = await res.json();
      return { status: 200, json };
    }
    return { status: res.status, json: null };
  } catch (err) {
    return { status: 0, json: null, error: err instanceof Error ? err.message : 'network error' };
  }
}
