import type { BoosterName, TrackedEvent } from './types';

// ─────────────────────────────────────────────────────────────
// 워커 룰의 클라이언트 미러.
// 오직 디버그 패널 표시용이며, 실제 개입 판정은 언제나 백엔드가 한다.
// 값은 packages/shared/config/thresholds.yml 과
// packages/stream-worker/src/worker.js:215-346 에서 그대로 옮겼다.
// 둘이 어긋나면 패널이 임계선 근처에서 백엔드와 다른 말을 하게 되므로,
// thresholds.yml 을 고칠 때 여기도 같이 고쳐야 한다.
// ─────────────────────────────────────────────────────────────

export const BOOSTER_WEIGHTS: Record<BoosterName, number> = {
  clipboard_copy_match: 0.35,
  broadcast_channel_multi_tab: 0.35,
  referrer_price_compare: 0.15,
  session_length_5min: 0.25,
  hidden_repeated: 0.35,
};

export const BOOSTER_LABELS: Record<BoosterName, string> = {
  clipboard_copy_match: '호텔명 복사',
  broadcast_channel_multi_tab: '멀티탭 비교',
  referrer_price_compare: '가격비교 유입',
  session_length_5min: '5분 이상 체류',
  hidden_repeated: '탭 반복 이탈',
};

// 단일 부스터(최대 0.35)는 어느 임계치도 넘지 못한다. 최소 두 개의 독립 신호가 필요하다.
export const S1 = { cartMinCount: 2, tabHiddenSeconds: 20, intentScoreMin: 0.65 } as const;
export const S2 = { intentScoreMin: 0.55 } as const;

// worker.js:217 — looksLikeHotelText
export const HOTEL_TEXT_RE =
  /(\bhotel\b|\broom\b|\bresort\b|\bsuite\b|\binn\b|\bmotel\b|\bhostel\b|펜션|호텔|객실|리조트|신라|롯데|숙소|힐튼|하얏트|메리어트|인터컨티넨탈|노보텔|쉐라톤|웨스틴|포시즌|그랜드 (호텔|리조트|하얏트))/i;

// worker.js:222 — 가격비교 유입 판정
export const PRICE_COMPARE_RE = /(google|naver|trivago|booking|agoda|hotels|kayak|skyscanner)/i;

export interface Mirror {
  sessionStartedAt: number;
  cartCount: number;
  hiddenAt: number;
  hiddenCount: number;
  boosters: BoosterName[];
  hotelName: string;
  tabCount: number;
}

export function emptyMirror(now: number): Mirror {
  return {
    sessionStartedAt: now,
    cartCount: 0,
    hiddenAt: 0,
    hiddenCount: 0,
    boosters: [],
    hotelName: '',
    tabCount: 1,
  };
}

function addBooster(m: Mirror, b: BoosterName) {
  if (!m.boosters.includes(b)) m.boosters.push(b);
}

/** worker.js:225-277 의 updateStateFromEvent 와 같은 순서로 상태를 갱신한다. */
export function applyEventToMirror(m: Mirror, ev: TrackedEvent, now: number): void {
  if (ev.referrer && PRICE_COMPARE_RE.test(ev.referrer)) {
    addBooster(m, 'referrer_price_compare');
  }
  if (now - m.sessionStartedAt >= 5 * 60 * 1000) {
    addBooster(m, 'session_length_5min');
  }

  const p = ev.payload as Record<string, unknown>;

  switch (ev.type) {
    case 'add_to_cart':
      m.cartCount += 1;
      break;

    case 'cart_change':
      m.cartCount = Math.max(0, Number(p.count) || 0);
      break;

    case 'visibility_change':
    case 'page_lifecycle': {
      const hidden = p.hidden === true || p.phase === 'hide';
      const visible = p.hidden === false || p.phase === 'show';
      // worker.js:250 — hidden_at 이 이미 있으면 재진입은 no-op 이다.
      if (hidden && !m.hiddenAt) {
        m.hiddenAt = Number(ev.ts) || now;
        m.hiddenCount += 1;
        if (m.hiddenCount >= 2) addBooster(m, 'hidden_repeated');
      }
      if (visible) m.hiddenAt = 0;
      break;
    }

    case 'clipboard_copy': {
      const text = typeof p.selected_text === 'string' ? p.selected_text : '';
      if (text && HOTEL_TEXT_RE.test(text)) {
        addBooster(m, 'clipboard_copy_match');
        m.hotelName = text.slice(0, 80);
      }
      break;
    }

    case 'broadcast_channel': {
      const n = Number(p.tab_count) || 0;
      m.tabCount = n || m.tabCount;
      if (n >= 2) addBooster(m, 'broadcast_channel_multi_tab');
      break;
    }

    default:
      break;
  }
}

/** worker.js:279-283 — 활성 부스터 가중치의 단순 합. 카트와 숨김 시간은 0 기여. */
export function computeIntentScore(boosters: BoosterName[]): number {
  return Number(boosters.reduce((s, b) => s + (BOOSTER_WEIGHTS[b] ?? 0), 0).toFixed(3));
}

export function hiddenForSeconds(m: Mirror, now: number): number {
  if (!m.hiddenAt) return 0;
  return Math.max(0, Math.floor((now - m.hiddenAt) / 1000));
}

export interface ConditionRow {
  label: string;
  met: boolean;
  current: string;
}

export interface ScenarioStatus {
  id: 'S1' | 'S2';
  title: string;
  rows: ConditionRow[];
  wouldFire: boolean;
}

export function evaluateMirror(m: Mirror, now: number): ScenarioStatus[] {
  const score = computeIntentScore(m.boosters);
  const hiddenSec = hiddenForSeconds(m, now);
  const clip = m.boosters.includes('clipboard_copy_match');
  const multi = m.boosters.includes('broadcast_channel_multi_tab');

  const s1Rows: ConditionRow[] = [
    { label: `장바구니 ${S1.cartMinCount}개 이상`, met: m.cartCount >= S1.cartMinCount, current: `${m.cartCount}개` },
    { label: `탭 숨김 ${S1.tabHiddenSeconds}초 이상`, met: hiddenSec >= S1.tabHiddenSeconds, current: `${hiddenSec}초` },
    { label: `intent ${S1.intentScoreMin.toFixed(2)} 이상`, met: score >= S1.intentScoreMin, current: score.toFixed(2) },
  ];

  const s2Rows: ConditionRow[] = [
    { label: '호텔명 복사 또는 멀티탭', met: clip || multi, current: clip ? '복사됨' : multi ? `탭 ${m.tabCount}개` : '없음' },
    { label: `intent ${S2.intentScoreMin.toFixed(2)} 이상`, met: score >= S2.intentScoreMin, current: score.toFixed(2) },
  ];

  return [
    { id: 'S1', title: 'S1 — 쿠폰 모달', rows: s1Rows, wouldFire: s1Rows.every((r) => r.met) },
    { id: 'S2', title: 'S2 — 가격비교 배너', rows: s2Rows, wouldFire: s2Rows.every((r) => r.met) },
  ];
}
