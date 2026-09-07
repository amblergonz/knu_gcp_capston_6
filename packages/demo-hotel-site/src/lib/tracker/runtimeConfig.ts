import { TRACKER_CONFIG } from './config';

// 워커가 발행한 유효 설정(hover:config:effective)을 dashboard-api 경유로 읽고,
// 조정값을 hover:config:runtime 으로 쓴다.
// 부스터 집합은 코드가 정하고, enabled 와 weight 만 런타임에 바뀐다.

export type BoosterName =
  | 'clipboard_copy_match'
  | 'broadcast_channel_multi_tab'
  | 'external_compare'
  | 'hidden_repeated'
  | 'checkout_form_dwell'
  | 'referrer_price_compare'
  | 'search_repeated'
  | 'wishlist_added'
  | 'session_length_5min'
  | 'scroll_depth_deep'
  | 'idle_entered'
  | 'focus_lost'
  | 'xgboost_intent_proba';

export type BoosterTier = 'high' | 'mid' | 'ambient' | 'reserved';

export interface BoosterConfig {
  label: string;
  tier: BoosterTier;
  event_type: string | null;
  s2_base: boolean;
  reserved: boolean;
  enabled: boolean;
  weight: number;
  default_weight: number;
  source: 'baseline' | 'override';
}

export interface RejectedEntry {
  path: string;
  reason: string;
  value?: unknown;
}

export interface RuntimeConfig {
  version: number;
  workerSeen: boolean;
  writeEnabled: boolean;
  updatedAt: number | null;
  updatedBy: string | null;
  boosters: Record<BoosterName, BoosterConfig>;
  scenarios: {
    S1: { enabled: boolean; cart_min_count: number; tab_hidden_seconds: number; intent_score_min: number };
    S2: { enabled: boolean; intent_score_min: number; base_boosters: BoosterName[] };
  };
  discount: {
    tier1_percent: number;
    tier2_min_score: number;
    tier2_percent: number;
    tier3_min_score: number;
    tier3_percent: number;
  };
  triggers: { form_dwell_ms: number; scroll_depth_percent: number; search_query_count: number };
  matchers: { hotel_text: string; price_compare: string };
  rejected: RejectedEntry[];
}

// 티어 순으로 정렬된 표시 순서. 패널과 게이지가 공유한다.
export const BOOSTER_ORDER: readonly BoosterName[] = [
  'clipboard_copy_match',
  'broadcast_channel_multi_tab',
  'external_compare',
  'hidden_repeated',
  'checkout_form_dwell',
  'referrer_price_compare',
  'search_repeated',
  'wishlist_added',
  'session_length_5min',
  'scroll_depth_deep',
  'idle_entered',
  'focus_lost',
  'xgboost_intent_proba',
];

// packages/shared/config/thresholds.yml 의 기준값과 같아야 한다.
// 대시보드 API 가 없을 때의 오프라인 폴백이자, 서버 렌더용 고정 스냅샷이다.
const DEFAULT_BOOSTERS: Array<[BoosterName, string, BoosterTier, string | null, boolean, number, boolean]> = [
  ['clipboard_copy_match', '호텔명 복사', 'high', 'clipboard_copy', true, 0.3, false],
  ['broadcast_channel_multi_tab', '멀티탭 비교', 'high', 'broadcast_channel', true, 0.3, false],
  ['external_compare', '외부 예약사이트 비교', 'high', 'external_link', true, 0.3, false],
  ['hidden_repeated', '탭 반복 이탈', 'high', 'visibility_change', false, 0.25, false],
  ['checkout_form_dwell', '결제 폼 체류 이상', 'mid', 'form_field', false, 0.2, false],
  ['referrer_price_compare', '가격비교 유입', 'mid', '*', false, 0.15, false],
  ['search_repeated', '반복 검색', 'mid', 'search_query', false, 0.15, false],
  ['wishlist_added', '찜하기', 'mid', 'wishlist_add', false, 0.15, false],
  ['session_length_5min', '5분 이상 체류', 'ambient', '*', false, 0.1, false],
  ['scroll_depth_deep', '깊은 스크롤', 'ambient', 'scroll_depth', false, 0.05, false],
  ['idle_entered', '유휴 진입', 'ambient', 'idle', false, 0.05, false],
  ['focus_lost', '포커스 이탈', 'ambient', 'window_focus', false, 0.05, false],
  ['xgboost_intent_proba', '모델 예측 (미사용)', 'reserved', null, false, 0, true],
];

function buildDefaultBoosters(): Record<BoosterName, BoosterConfig> {
  const out = {} as Record<BoosterName, BoosterConfig>;
  for (const [name, label, tier, eventType, s2Base, weight, reserved] of DEFAULT_BOOSTERS) {
    out[name] = {
      label,
      tier,
      event_type: eventType,
      s2_base: s2Base,
      reserved,
      enabled: !reserved,
      weight,
      default_weight: weight,
      source: 'baseline',
    };
  }
  return out;
}

export const DEFAULT_CONFIG: RuntimeConfig = Object.freeze({
  version: 0,
  workerSeen: false,
  writeEnabled: true,
  updatedAt: null,
  updatedBy: null,
  boosters: buildDefaultBoosters(),
  scenarios: {
    S1: { enabled: true, cart_min_count: 2, tab_hidden_seconds: 20, intent_score_min: 0.52 },
    S2: {
      enabled: true,
      intent_score_min: 0.42,
      base_boosters: ['clipboard_copy_match', 'broadcast_channel_multi_tab', 'external_compare'],
    },
  },
  discount: { tier1_percent: 5, tier2_min_score: 0.63, tier2_percent: 10, tier3_min_score: 0.78, tier3_percent: 15 },
  triggers: { form_dwell_ms: 8000, scroll_depth_percent: 75, search_query_count: 3 },
  matchers: {
    hotel_text:
      '(\\bhotel\\b|\\broom\\b|\\bresort\\b|\\bsuite\\b|\\binn\\b|\\bmotel\\b|\\bhostel\\b|펜션|호텔|객실|리조트|신라|롯데|숙소|힐튼|하얏트|메리어트|인터컨티넨탈|노보텔|쉐라톤|웨스틴|포시즌|그랜드 (호텔|리조트|하얏트))',
    price_compare: '(google|naver|trivago|booking|agoda|hotels|kayak|skyscanner)',
  },
  rejected: [],
}) as RuntimeConfig;

const KNOWN = new Set<string>(BOOSTER_ORDER);

interface ServerConfigResponse {
  effective: Record<string, unknown> | null;
  override: Record<string, unknown> | null;
  version: number;
  updated_at: number | null;
  updated_by: string | null;
  worker_seen: boolean;
  write_enabled: boolean;
  rejected: RejectedEntry[];
}

function fromServer(body: ServerConfigResponse): RuntimeConfig {
  const eff = body.effective as
    | (Omit<RuntimeConfig, 'version' | 'workerSeen' | 'writeEnabled' | 'updatedAt' | 'updatedBy'> & {
        boosters: Record<string, BoosterConfig>;
      })
    | null;

  if (!eff) {
    return { ...DEFAULT_CONFIG, version: body.version, workerSeen: false, writeEnabled: body.write_enabled };
  }

  // 서버가 모르는 이름이 오면 무시한다. 부스터 집합은 코드가 정한다.
  const boosters = { ...DEFAULT_CONFIG.boosters };
  for (const [name, cfg] of Object.entries(eff.boosters ?? {})) {
    if (!KNOWN.has(name)) continue;
    boosters[name as BoosterName] = cfg;
  }

  return {
    version: body.version,
    workerSeen: true,
    writeEnabled: body.write_enabled,
    updatedAt: body.updated_at,
    updatedBy: body.updated_by,
    boosters,
    scenarios: eff.scenarios ?? DEFAULT_CONFIG.scenarios,
    discount: eff.discount ?? DEFAULT_CONFIG.discount,
    triggers: eff.triggers ?? DEFAULT_CONFIG.triggers,
    matchers: eff.matchers ?? DEFAULT_CONFIG.matchers,
    rejected: body.rejected ?? [],
  };
}

export async function fetchConfig(): Promise<RuntimeConfig | null> {
  try {
    const res = await fetch(`${TRACKER_CONFIG.dashboardUrl}/config`, { cache: 'no-store' });
    if (!res.ok) return null;
    return fromServer((await res.json()) as ServerConfigResponse);
  } catch {
    return null;
  }
}

export interface ConfigDraft {
  boosters?: Partial<Record<BoosterName, { enabled?: boolean; weight?: number }>>;
  scenarios?: {
    S1?: Partial<{ enabled: boolean; cart_min_count: number; tab_hidden_seconds: number; intent_score_min: number }>;
    S2?: Partial<{ enabled: boolean; intent_score_min: number }>;
  };
  discount?: Partial<RuntimeConfig['discount']>;
}

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; status: number; error: string; current?: number; unknown?: string[]; details?: unknown };

export async function saveConfig(draft: ConfigDraft, expectedVersion: number): Promise<SaveResult> {
  try {
    const res = await fetch(`${TRACKER_CONFIG.dashboardUrl}/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...draft, expected_version: expectedVersion, updated_by: 'debug-panel' }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, version: body.version };
    return {
      ok: false,
      status: res.status,
      error: body.error ?? `HTTP ${res.status}`,
      current: body.current,
      unknown: body.unknown,
      details: body.details,
    };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : 'network error' };
  }
}

export async function resetConfig(): Promise<SaveResult> {
  try {
    const res = await fetch(`${TRACKER_CONFIG.dashboardUrl}/config`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, version: body.version ?? 0 };
    return { ok: false, status: res.status, error: body.error ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : 'network error' };
  }
}

/** intent 점수가 속한 할인 구간. 워커의 discountFor 와 같은 규칙. */
export function discountFor(score: number, d: RuntimeConfig['discount']): number {
  if (score >= d.tier3_min_score) return d.tier3_percent;
  if (score >= d.tier2_min_score) return d.tier2_percent;
  return d.tier1_percent;
}
