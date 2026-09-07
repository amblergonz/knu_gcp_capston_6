import { sha256Bytes } from './sha256';

// packages/stream-worker/src/worker.js:182-185 의 hashAbGroup 을 그대로 미러한다.
//   const hash = crypto.createHash('sha256').update(sessionId).digest();
//   return hash[0] % 2 === 0 ? 'control' : 'treatment';
export function abGroupFor(sessionId: string): 'control' | 'treatment' {
  return sha256Bytes(sessionId)[0] % 2 === 0 ? 'control' : 'treatment';
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(buf);
  } else {
    // 비보안 오리진 폴백
    for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** URL 경로에 그대로 넣을 수 있고 128자를 넘지 않는 세션 ID */
export function generateSessionId(): string {
  return `demo-${Date.now().toString(36)}-${randomHex(6)}`;
}

/**
 * 목표 A/B 그룹으로 해싱되는 세션 ID가 나올 때까지 재생성한다.
 * 기대 반복 2회. 발표 중 50% 확률로 아무 일도 안 일어나는 사고를 막는 장치다.
 */
export function generateSessionIdForGroup(
  target: 'control' | 'treatment',
  maxAttempts = 200,
): string {
  let id = generateSessionId();
  for (let i = 0; i < maxAttempts && abGroupFor(id) !== target; i++) {
    id = generateSessionId();
  }
  return id;
}
