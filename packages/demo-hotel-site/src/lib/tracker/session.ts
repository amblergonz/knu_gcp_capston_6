import { TRACKER_CONFIG } from './config';
import { abGroupFor, generateSessionIdForGroup } from './abGroup';
import { DEFAULT_CONFIG } from './runtimeConfig';

// 유입 판정은 세션 발급 시점(설정 fetch 이전)에도 필요하므로 기준값 패턴을 쓴다.
const PRICE_COMPARE_RE = new RegExp(DEFAULT_CONFIG.matchers.price_compare, 'i');
import type { Device } from './types';

const KEY = 'hover_demo_session';
const TAB_KEY = 'hover_demo_tab_id';

export interface SessionRecord {
  session_id: string;
  ab_group: 'control' | 'treatment';
  started_at: number;
  last_seen_at: number;
  referrer: string;
  user_id: string;
}

let current: SessionRecord | null = null;

export function detectDevice(): Device {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * localhost 에서는 document.referrer 가 항상 빈 문자열이라
 * referrer_price_compare 부스터(+0.2)가 영영 안 잡힌다.
 * ?ref= / ?utm_source= 로 진입하면 그 값을 세션에 저장해 모든 이벤트에 붙인다.
 * 시연 진입 URL: http://localhost:3000/?ref=google.com
 */
export function resolveReferrer(existing?: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const qs = new URLSearchParams(window.location.search);
    const fromQuery = qs.get('ref') || qs.get('utm_source');
    if (fromQuery) {
      return fromQuery.startsWith('http') ? fromQuery : `https://${fromQuery}/`;
    }
  } catch {
    /* noop */
  }
  if (existing) return existing;

  const doc = document.referrer;
  // 같은 오리진 내부 이동은 유입이 아니다.
  if (doc && !doc.startsWith(window.location.origin)) return doc;
  return '';
}

export function referrerMatches(ref: string): boolean {
  return !!ref && PRICE_COMPARE_RE.test(ref);
}

function persist(rec: SessionRecord) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* noop */
  }
}

/**
 * 세션은 localStorage 에 둔다 (sessionStorage 아님).
 * 두 번째 탭이 별도 세션을 만들면 broadcast_channel_multi_tab 부스터가
 * 장바구니가 빈 새 세션에 붙어 아무 의미가 없어진다.
 */
export function loadOrCreateSession(): SessionRecord {
  if (current) return current;

  const now = Date.now();
  let rec: SessionRecord | null = null;

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionRecord;
      const fresh = parsed && now - (parsed.last_seen_at ?? 0) < TRACKER_CONFIG.sessionMaxAgeMs;
      if (fresh && typeof parsed.session_id === 'string' && parsed.session_id) rec = parsed;
    }
  } catch {
    /* noop */
  }

  if (!rec) {
    // A/B 계약은 그대로 두되, 시연이 항상 성공하도록 treatment 로 해싱되는 ID 를 고른다.
    const id = generateSessionIdForGroup('treatment');
    rec = {
      session_id: id,
      ab_group: abGroupFor(id),
      started_at: now,
      last_seen_at: now,
      referrer: '',
      user_id: 'demo-user',
    };
  }

  rec.referrer = resolveReferrer(rec.referrer);
  rec.last_seen_at = now;
  persist(rec);
  current = rec;
  return rec;
}

export function getSession(): SessionRecord | null {
  return current;
}

export function touchSession() {
  if (!current) return;
  current.last_seen_at = Date.now();
  persist(current);
}

/** 쿨다운(86400초)과 세션당 2회 제한을 우회하려면 새 세션 ID 가 필요하다. */
export function resetSession(target: 'control' | 'treatment' = 'treatment'): SessionRecord {
  const now = Date.now();
  const id = generateSessionIdForGroup(target);
  const rec: SessionRecord = {
    session_id: id,
    ab_group: abGroupFor(id),
    started_at: now,
    last_seen_at: now,
    referrer: resolveReferrer(),
    user_id: 'demo-user',
  };
  persist(rec);
  current = rec;
  return rec;
}

export function getTabId(): string {
  try {
    const existing = sessionStorage.getItem(TAB_KEY);
    if (existing) return existing;
    const id = `t-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(TAB_KEY, id);
    return id;
  } catch {
    return `t-${Math.random().toString(36).slice(2, 10)}`;
  }
}
