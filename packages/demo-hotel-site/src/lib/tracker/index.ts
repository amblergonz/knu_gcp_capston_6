import { TRACKER_CONFIG } from './config';
import { detectDevice, loadOrCreateSession, referrerMatches, resetSession, getSession } from './session';
import { setEnvelope, flush, setPaused, isPaused, drain } from './queue';
import { track, resetMirror, syncMirror, getMirror } from './track';
import { patch, pushLog, resetCounts } from './store';
import { getSkewMs } from './clockSkew';
import { startTabCensus, type TabCensus } from './broadcastTabs';
import { requestPoll, setTabCountGetter, startHeartbeat, stopHeartbeat, stopPolling } from './decisionPoller';
import { installVisibility } from './listeners/visibility';
import {
  installClicks,
  installClipboard,
  installFocus,
  installFormField,
  installIdle,
  installLifecycle,
  installScroll,
  resetScrollDepth,
} from './listeners/ambient';
import { cartCount, getCart, setCartMutationHook, type CartChangeReason, type CartState } from '@/lib/cart';
import { setWishlistHook } from '@/lib/wishlist';
import { fetchConfig, saveConfig, resetConfig, type ConfigDraft, type SaveResult } from './runtimeConfig';

export { track } from './track';
export type { EventType } from './types';
export { requestPoll, pollOnce, setDecisionSink } from './decisionPoller';
export { setPaused, isPaused } from './queue';
export * from './types';
export { DEFAULT_CONFIG, BOOSTER_ORDER, discountFor } from './runtimeConfig';
export type { RuntimeConfig, BoosterConfig, ConfigDraft, SaveResult } from './runtimeConfig';

// StrictMode 는 effect 를 mount → unmount → mount 로 두 번 돌린다.
// ref 카운트 + 지연 teardown 으로 그 사이에 리스너·채널·폴러가 찢어지지 않게 한다.
// 저장 → 워커 반영까지의 3상태. 워커 전파 지연(최대 ~5초)을 숨기지 않고 드러낸다.
export type SyncState = 'idle' | 'pending' | 'synced' | 'stale' | 'error';

let syncState: SyncState = 'idle';
const syncListeners = new Set<(s: SyncState) => void>();

export function getSyncState(): SyncState {
  return syncState;
}

export function subscribeSyncState(cb: (s: SyncState) => void) {
  syncListeners.add(cb);
  return () => {
    syncListeners.delete(cb);
  };
}

function setSyncState(next: SyncState) {
  syncState = next;
  for (const cb of syncListeners) cb(next);
}

/** 워커가 발행한 유효 설정을 다시 읽어 스토어에 반영한다. */
export async function refreshRuntimeConfig() {
  const cfg = await fetchConfig();
  if (!cfg) {
    pushLog('info', 'config', '대시보드 미연결 — 기본값 사용');
    return null;
  }
  patch({ config: cfg });
  syncMirror();
  return cfg;
}

/** 저장 후 워커가 그 버전을 발행할 때까지 폴링한다. */
export async function saveRuntimeConfig(draft: ConfigDraft, expectedVersion: number): Promise<SaveResult> {
  const res = await saveConfig(draft, expectedVersion);
  if (!res.ok) {
    setSyncState('error');
    return res;
  }

  setSyncState('pending');
  const deadline = Date.now() + TRACKER_CONFIG.configSyncTimeoutMs;
  while (Date.now() < deadline) {
    const cfg = await refreshRuntimeConfig();
    if (cfg && cfg.version === res.version) {
      setSyncState('synced');
      pushLog('info', 'config', `v${cfg.version} 워커 반영 완료`);
      return res;
    }
    await new Promise((r) => setTimeout(r, TRACKER_CONFIG.configPollMs));
  }
  setSyncState('stale');
  return res;
}

export async function resetRuntimeConfig(): Promise<SaveResult> {
  const res = await resetConfig();
  if (res.ok) {
    setSyncState('pending');
    const deadline = Date.now() + TRACKER_CONFIG.configSyncTimeoutMs;
    while (Date.now() < deadline) {
      const cfg = await refreshRuntimeConfig();
      if (cfg && cfg.version === 0) {
        setSyncState('synced');
        return res;
      }
      await new Promise((r) => setTimeout(r, TRACKER_CONFIG.configPollMs));
    }
    setSyncState('stale');
  } else {
    setSyncState('error');
  }
  return res;
}

let refCount = 0;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;
let cleanups: Array<() => void> = [];
let census: TabCensus | null = null;
let started = false;

export function isTrackerStarted() {
  return started;
}

function syncSessionToStore() {
  const s = getSession();
  if (!s) return;
  patch({
    ready: true,
    sessionId: s.session_id,
    abGroup: s.ab_group,
    referrer: s.referrer,
    referrerMatched: referrerMatches(s.referrer),
    device: detectDevice(),
    sessionStartedAt: s.started_at,
    clockSkewMs: getSkewMs(),
  });
}

function onCartMutation(next: CartState, reason: CartChangeReason, line?: { room_id: string; hotel_id: string; hotel_name: string; room_name: string; price: number }) {
  const count = cartCount(next);

  // add_to_cart 는 워커에서 cart_count += 1 이고, cart_change 는 절대값 대입이다.
  // 담기는 두 이벤트를 같이 보내 유실·TTL 만료를 스스로 복구하게 한다.
  if (reason === 'add' && line) {
    track('add_to_cart', {
      hotel_id: line.hotel_id,
      hotel_name: line.hotel_name,
      room_id: line.room_id,
      room_name: line.room_name,
      product_id: line.room_id,
      price: line.price,
    });
  }

  track('cart_change', {
    count,
    reason,
    room_id: line?.room_id,
    hotel_id: line?.hotel_id,
  });
}

function start() {
  if (started) return;
  started = true;

  const session = loadOrCreateSession();
  setEnvelope({ session_id: session.session_id, user_id: session.user_id, device: detectDevice() });
  resetMirror(session.started_at);
  syncSessionToStore();

  if (!TRACKER_CONFIG.enabled) {
    pushLog('info', 'tracker', 'NEXT_PUBLIC_TRACKING_ENABLED=false — 전송 비활성');
    setPaused(true);
  }

  cleanups = [
    installVisibility(),
    installFocus(),
    installIdle(),
    installScroll(),
    installClipboard(),
    installFormField(),
    installClicks(),
    installLifecycle(),
  ];

  census = startTabCensus((count) => {
    track('broadcast_channel', { tab_count: count, tab_id: census?.tabId });
    if (count >= 2) {
      void flush('multi_tab').then(() => requestPoll('multi_tab'));
    }
  });
  setTabCountGetter(() => census?.getCount() ?? 1);

  setCartMutationHook(onCartMutation);
  setWishlistHook((hotelId, action, size) => {
    track('wishlist_add', { hotel_id: hotelId, action, wishlist_size: size });
  });

  startHeartbeat();
  // 패널이 닫혀 있어도 미러가 올바른 가중치로 채점하도록 여기서 먼저 가져온다.
  void refreshRuntimeConfig();
  pushLog('info', 'tracker', `세션 ${session.session_id} · ${session.ab_group}`);
}

function stop() {
  if (!started) return;
  started = false;
  cleanups.forEach((fn) => fn());
  cleanups = [];
  census?.stop();
  census = null;
  setCartMutationHook(null);
  setWishlistHook(null);
  stopPolling();
  stopHeartbeat();
}

/** 멱등 + ref 카운트. 반환값은 teardown. */
export function initTracker(): () => void {
  if (typeof window === 'undefined') return () => {};

  refCount += 1;
  if (teardownTimer !== null) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  start();

  return () => {
    refCount -= 1;
    if (refCount > 0) return;
    // StrictMode 의 동기 unmount → remount 사이에 실제로 정리하지 않도록 한 틱 미룬다.
    teardownTimer = setTimeout(() => {
      teardownTimer = null;
      if (refCount === 0) stop();
    }, 0);
  };
}

/** 라우트 진입 시 호출. page_view + 스크롤 깊이 초기화 + 장바구니 재동기화 + 폴링. */
export function onRouteChange(path: string) {
  resetScrollDepth();
  track('page_view', { path, title: document.title, cart_count: cartCount(getCart()) });

  // Redis 세션 TTL(1800초)이 만료되면 워커의 cart_count 가 0 으로 리셋된다.
  // 장바구니가 비어 있지 않으면 절대값을 다시 보내 스스로 복구한다.
  const count = cartCount(getCart());
  if (count > 0) track('cart_change', { count, reason: 'resync' });

  requestPoll('route_change');
}

/** 디버그 패널의 "새 세션 시작" */
export function restartSession(target: 'control' | 'treatment' = 'treatment') {
  stopPolling();
  drain();
  const s = resetSession(target);
  setEnvelope({ session_id: s.session_id, user_id: s.user_id, device: detectDevice() });
  resetMirror(s.started_at);
  resetCounts();
  syncSessionToStore();
  syncMirror();
  pushLog('info', 'session', `새 세션 ${s.session_id} · ${s.ab_group}`);
  track('page_view', { path: location.pathname, title: document.title, is_initial: true });
}

export { getMirror, syncMirror };
export { getSession } from './session';
