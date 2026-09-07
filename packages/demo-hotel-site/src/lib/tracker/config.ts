// NEXT_PUBLIC_* 는 빌드 타임에 인라인된다. 값을 바꾸면 dev 서버를 재시작해야 한다.
export const TRACKER_CONFIG = {
  ingestionUrl: process.env.NEXT_PUBLIC_INGESTION_URL || 'http://localhost:4000',
  decisionUrl: process.env.NEXT_PUBLIC_DECISION_URL || 'http://localhost:4001',
  dashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_API || 'http://localhost:4002',
  enabled: process.env.NEXT_PUBLIC_TRACKING_ENABLED !== 'false',

  // 배치
  flushDebounceMs: 400,
  flushMaxWaitMs: 2000,
  maxBatchSize: 20,
  hardBatchCap: 100, // ingestion 스키마의 maxItems
  maxQueueLength: 200,

  // 개입 폴링 — packages/stream-worker/scripts/smoke-be-c.js:66-78 과 같은 리듬
  decisionPollIntervalMs: 300,
  decisionPollWindowMs: 8000,
  heartbeatPollMs: 15000,

  // 리스너
  idleThresholdMs: 30_000,
  scrollThrottleMs: 250,
  scrollMinIntervalMs: 2000,

  // 세션 — 워커의 SESSION_TTL_SECONDS(1800) 와 맞춘다
  sessionMaxAgeMs: 30 * 60 * 1000,

  // 설정 콘솔
  configPollMs: 1000,
  configSyncTimeoutMs: 8000,

  // 로그
  maxLogEntries: 200,
} as const;
