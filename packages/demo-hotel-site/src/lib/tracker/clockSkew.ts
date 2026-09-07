// worker.js:287 은 hidden_for_seconds 를 "서버 Date.now() − 클라이언트 event.ts" 로 계산한다.
// Docker Desktop 은 절전/복귀 후 수 초~수 분 드리프트가 흔하고, 그러면 S1 이
// 영영 안 뜨거나 즉시 떠버리는데 아무 데도 에러가 남지 않는다.
// 첫 성공 응답의 HTTP Date 헤더로 스큐를 재서 패널에 노출한다.

let skewMs: number | null = null;

export function recordServerDate(header: string | null, clientNow: number) {
  if (!header) return;
  const serverMs = Date.parse(header);
  if (Number.isNaN(serverMs)) return;
  // Date 헤더는 초 단위라 ±1초 오차는 원래 있다.
  skewMs = serverMs - clientNow;
}

export function getSkewMs(): number | null {
  return skewMs;
}

export function isSkewDangerous(): boolean {
  return skewMs !== null && Math.abs(skewMs) > 3000;
}
