// 이벤트 타입 목록은 packages/ingestion-api/src/index.js:9-26 의 enum 을 그대로 옮긴 것이다.
// 여기 없는 값을 하나라도 보내면 Fastify 스키마가 배치 전체를 400 으로 거절한다.
export const EVENT_TYPES = [
  'visibility_change',
  'window_focus',
  'idle',
  'scroll',
  'scroll_depth',
  'form_field',
  'clipboard_copy',
  'broadcast_channel',
  'page_lifecycle',
  'cart_change',
  'add_to_cart',
  'page_view',
  'click',
  'external_link',
  'search_query',
  'wishlist_add',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_SET: ReadonlySet<string> = new Set(EVENT_TYPES);

export function isEventType(v: unknown): v is EventType {
  return typeof v === 'string' && EVENT_TYPE_SET.has(v);
}

export type Device = 'desktop' | 'mobile' | 'tablet';

export interface TrackedEvent {
  event_id: string;
  ts: number;
  type: EventType;
  payload: Record<string, unknown>;
  page_url: string;
  referrer?: string;
}

export interface EventEnvelope {
  session_id: string;
  user_id?: string;
  device: Device;
  events: TrackedEvent[];
}

// 부스터 이름과 설정 타입은 runtimeConfig 가 단일 출처다.
export type { BoosterName, BoosterConfig, RuntimeConfig } from './runtimeConfig';
import type { BoosterName, RuntimeConfig } from './runtimeConfig';

export interface InterventionCopy {
  title: string;
  body: string;
  cta: string;
}

/** decision-api 가 돌려주는 개입 페이로드. packages/decision-api/src/index.js:19-33 */
export interface DecisionPayload {
  intervention_id: string;
  session_id: string;
  scenario_id: 'S1' | 'S2';
  ab_group: 'control' | 'treatment';
  component: 'coupon_modal' | 'price_match_banner';
  copy: InterventionCopy;
  context: { hotel_name?: string; discount_percent?: number; coupon_code?: string };
  ttl_seconds: number;
  intent_score: number;
  active_boosters: string[];
  /** 꺼진 신호를 뺀 실제 채점 대상 */
  scored_boosters: string[];
  config_version: number;
  copy_source: string;
}

export type LogLevel = 'sent' | 'queued' | 'error' | 'info' | 'decision';

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  type: string;
  detail?: string;
}

export type ConnState = 'unknown' | 'ok' | 'down';

/** 디버그 패널이 구독하는 스냅샷. 서버 렌더에서는 고정 상수를 쓴다. */
export interface TrackerSnapshot {
  ready: boolean;
  sessionId: string;
  abGroup: 'control' | 'treatment';
  referrer: string;
  referrerMatched: boolean;
  device: Device;
  sessionStartedAt: number;
  /** 클라이언트 미러 — 워커 상태의 추정치 */
  cartCount: number;
  hiddenAt: number;
  hiddenCount: number;
  boosters: BoosterName[];
  intentScore: number;
  hotelName: string;
  tabCount: number;
  searchCount: number;
  /** 워커가 발행한 유효 설정. 서버 렌더에서는 DEFAULT_CONFIG 고정. */
  config: RuntimeConfig;
  /** 전송 상태 */
  ingestion: ConnState;
  decision: ConnState;
  queued: number;
  paused: boolean;
  clockSkewMs: number | null;
  /** 신호별 누적 카운트 */
  counts: Record<string, number>;
  log: LogEntry[];
  decisions: DecisionPayload[];
  /** 마지막으로 받은 개입의 권위 값 */
  lastAuthoritative: { intentScore: number; boosters: string[] } | null;
}
