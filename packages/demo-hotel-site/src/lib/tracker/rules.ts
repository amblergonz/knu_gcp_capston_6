import type { TrackedEvent } from './types';
import {
  DEFAULT_CONFIG,
  type BoosterName,
  type RuntimeConfig,
} from './runtimeConfig';

// ─────────────────────────────────────────────────────────────
// 워커 룰의 클라이언트 미러.
// 오직 디버그 패널 표시용이며, 실제 개입 판정은 언제나 백엔드가 한다.
//
// 가중치·임계치·트리거·정규식은 전부 워커가 발행한 설정(RuntimeConfig)에서
// 읽는다. 손으로 맞춰야 하는 건 아래 applyEventToMirror 의 분기 로직뿐이고,
// 그건 packages/stream-worker/src/worker.js 의 updateStateFromEvent 와
// 같은 순서·조건을 유지해야 한다.
//
// 워커와 똑같이 "점수 시점"에만 enabled 를 거른다. applyEventToMirror 는
// enabled 를 전혀 모른다 — 그래야 두 구현이 수치만 같은 게 아니라 구조가 같다.
// ─────────────────────────────────────────────────────────────

export { DEFAULT_CONFIG, BOOSTER_ORDER, discountFor } from './runtimeConfig';
export type { BoosterName, BoosterConfig, RuntimeConfig, BoosterTier } from './runtimeConfig';

/** 설정에서 정규식을 만들되, 깨져 있으면 기본값으로 되돌린다. */
function makeRe(source: string, fallback: RegExp): RegExp {
  try {
    return new RegExp(source, 'i');
  } catch {
    return fallback;
  }
}

const FALLBACK_HOTEL_RE = new RegExp(DEFAULT_CONFIG.matchers.hotel_text, 'i');
const FALLBACK_PRICE_RE = new RegExp(DEFAULT_CONFIG.matchers.price_compare, 'i');

export interface Mirror {
  sessionStartedAt: number;
  cartCount: number;
  hiddenAt: number;
  hiddenCount: number;
  searchCount: number;
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
    searchCount: 0,
    boosters: [],
    hotelName: '',
    tabCount: 1,
  };
}

function addBooster(m: Mirror, b: BoosterName) {
  if (!m.boosters.includes(b)) m.boosters.push(b);
}

/** worker.js 의 updateStateFromEvent 와 같은 순서로 상태를 갱신한다. */
export function applyEventToMirror(m: Mirror, ev: TrackedEvent, now: number, cfg: RuntimeConfig): void {
  const priceRe = makeRe(cfg.matchers.price_compare, FALLBACK_PRICE_RE);
  const hotelRe = makeRe(cfg.matchers.hotel_text, FALLBACK_HOTEL_RE);

  if (ev.referrer && priceRe.test(ev.referrer)) {
    addBooster(m, 'referrer_price_compare');
  }
  if (now - m.sessionStartedAt >= 5 * 60 * 1000) {
    addBooster(m, 'session_length_5min');
  }

  const p = ev.payload as Record<string, unknown>;

  if (ev.type === 'cart_change') {
    const count = Number(p.count);
    if (Number.isFinite(count)) m.cartCount = Math.max(0, count);
  }

  if (ev.type === 'add_to_cart') {
    m.cartCount += 1;
  }

  if (ev.type === 'visibility_change' || ev.type === 'page_lifecycle') {
    const hidden = p.hidden === true || p.phase === 'hide';
    const visible = p.hidden === false || p.phase === 'show';
    // worker.js:253 — hidden_at 이 이미 있으면 재진입은 no-op 이다.
    if (hidden && !m.hiddenAt) {
      m.hiddenAt = Number(ev.ts) || now;
      m.hiddenCount += 1;
      if (m.hiddenCount >= 2) addBooster(m, 'hidden_repeated');
    }
    if (visible) m.hiddenAt = 0;
  }

  if (ev.type === 'clipboard_copy') {
    const text = typeof p.selected_text === 'string' ? p.selected_text : '';
    if (text && hotelRe.test(text)) {
      addBooster(m, 'clipboard_copy_match');
      if (!m.hotelName) m.hotelName = text.slice(0, 80);
    }
  }

  if (ev.type === 'broadcast_channel') {
    const n = Number(p.tab_count) || 0;
    m.tabCount = n || m.tabCount;
    if (n >= 2) addBooster(m, 'broadcast_channel_multi_tab');
  }

  // ── 아래 7개는 worker.js 의 같은 순서 분기와 1:1 대응해야 한다.

  if (ev.type === 'form_field') {
    const dwell = Number(p.dwell_ms || 0);
    if (p.form === 'checkout' && dwell >= cfg.triggers.form_dwell_ms) {
      addBooster(m, 'checkout_form_dwell');
    }
  }

  if (ev.type === 'scroll_depth') {
    if (Number(p.percent || 0) >= cfg.triggers.scroll_depth_percent) {
      addBooster(m, 'scroll_depth_deep');
    }
  }

  if (ev.type === 'idle' && p.idle === true) {
    addBooster(m, 'idle_entered');
  }

  if (ev.type === 'window_focus' && p.focused === false) {
    addBooster(m, 'focus_lost');
  }

  if (ev.type === 'external_link') {
    const host = String(p.hostname || p.href || '');
    if (priceRe.test(host)) addBooster(m, 'external_compare');
  }

  if (ev.type === 'search_query') {
    m.searchCount += 1;
    if (m.searchCount >= cfg.triggers.search_query_count) {
      addBooster(m, 'search_repeated');
    }
  }

  if (ev.type === 'wishlist_add' && p.action === 'add') {
    addBooster(m, 'wishlist_added');
  }
}

/** 꺼진 부스터를 뺀 실제 채점 대상. worker.js 의 scoredBoosters 와 같다. */
export function scoredBoosters(boosters: BoosterName[], cfg: RuntimeConfig): BoosterName[] {
  return boosters.filter((b) => cfg.boosters[b]?.enabled === true);
}

/** 활성 부스터 가중치의 단순 합. 2dp 반올림까지 워커와 동일해야 한다. */
export function computeIntentScore(boosters: BoosterName[], cfg: RuntimeConfig): number {
  const sum = scoredBoosters(boosters, cfg).reduce((acc, b) => acc + (cfg.boosters[b]?.weight ?? 0), 0);
  return Math.round(sum * 100) / 100;
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
  disabled: boolean;
}

export function evaluateMirror(m: Mirror, now: number, cfg: RuntimeConfig): ScenarioStatus[] {
  const score = computeIntentScore(m.boosters, cfg);
  const hiddenSec = hiddenForSeconds(m, now);
  const scored = scoredBoosters(m.boosters, cfg);
  const s1 = cfg.scenarios.S1;
  const s2 = cfg.scenarios.S2;

  const activeBase = s2.base_boosters.filter((b) => cfg.boosters[b]?.enabled === true);
  const baseHit = activeBase.filter((b) => scored.includes(b));

  const s1Rows: ConditionRow[] = [
    { label: `장바구니 ${s1.cart_min_count}개 이상`, met: m.cartCount >= s1.cart_min_count, current: `${m.cartCount}개` },
    {
      label: `탭 숨김 ${s1.tab_hidden_seconds}초 이상`,
      met: hiddenSec >= s1.tab_hidden_seconds,
      current: `${hiddenSec}초`,
    },
    { label: `intent ${s1.intent_score_min.toFixed(2)} 이상`, met: score >= s1.intent_score_min, current: score.toFixed(2) },
  ];

  const s2Rows: ConditionRow[] = [
    {
      label: '비교 신호 1개 이상',
      met: baseHit.length > 0,
      current: baseHit.length > 0 ? cfg.boosters[baseHit[0]].label : activeBase.length === 0 ? '전부 OFF' : '없음',
    },
    { label: `intent ${s2.intent_score_min.toFixed(2)} 이상`, met: score >= s2.intent_score_min, current: score.toFixed(2) },
  ];

  return [
    {
      id: 'S1',
      title: 'S1 — 쿠폰 모달',
      rows: s1Rows,
      wouldFire: s1.enabled && s1Rows.every((r) => r.met),
      disabled: !s1.enabled,
    },
    {
      id: 'S2',
      title: 'S2 — 가격비교 배너',
      rows: s2Rows,
      wouldFire: s2.enabled && activeBase.length > 0 && s2Rows.every((r) => r.met),
      disabled: !s2.enabled || activeBase.length === 0,
    },
  ];
}
