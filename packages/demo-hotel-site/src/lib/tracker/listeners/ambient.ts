import { TRACKER_CONFIG } from '../config';
import { track } from '../track';
import { flushWithBeacon } from '../queue';

// 페이지 전체에 걸쳐 상시 도는 리스너들.
// 마우스 좌표는 어디서도 수집하지 않는다 — 프로젝트의 핵심 규칙이다.

/** window focus/blur. 다른 "앱"으로 전환하면 blur 만 오고 visibilitychange 는 안 온다. */
export function installFocus(): () => void {
  let focused = typeof document !== 'undefined' ? document.hasFocus() : true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let blurredAt = 0;

  const emit = (next: boolean) => {
    if (next === focused) return;
    focused = next;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      if (next) {
        track('window_focus', { focused: true, path: location.pathname, blurred_ms: blurredAt ? Date.now() - blurredAt : 0 });
        blurredAt = 0;
      } else {
        blurredAt = Date.now();
        track('window_focus', { focused: false, path: location.pathname });
      }
    }, 150);
  };

  const onFocus = () => emit(true);
  const onBlur = () => emit(false);
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  return () => {
    if (timer !== null) clearTimeout(timer);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
  };
}

/** 30초 무입력 → idle:true, 다음 상호작용 → idle:false */
export function installIdle(): () => void {
  let idle = false;
  let idleAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const arm = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      idle = true;
      idleAt = Date.now();
      track('idle', { idle: true, threshold_ms: TRACKER_CONFIG.idleThresholdMs, path: location.pathname });
    }, TRACKER_CONFIG.idleThresholdMs);
  };

  const reset = () => {
    if (idle) {
      idle = false;
      track('idle', { idle: false, idle_ms: Date.now() - idleAt, path: location.pathname });
    }
    arm();
  };

  // mousemove 는 절대 넣지 않는다.
  const events = ['keydown', 'click', 'scroll', 'wheel', 'focusin', 'touchstart'] as const;
  events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
  arm();

  return () => {
    if (timer !== null) clearTimeout(timer);
    events.forEach((e) => window.removeEventListener(e, reset));
  };
}

/** 스크롤 활동(스로틀) + 25/50/75/100% 마일스톤(라우트당 1회) */
let reachedMilestones = new Set<number>();
let routeEnteredAt = Date.now();

export function resetScrollDepth() {
  reachedMilestones = new Set();
  routeEnteredAt = Date.now();
}

export function installScroll(): () => void {
  let ticking = false;
  let lastY = 0;
  let lastEmit = 0;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    setTimeout(() => {
      ticking = false;
      const y = window.scrollY;
      const docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const pct = Math.min(100, Math.round((y / docH) * 100));

      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !reachedMilestones.has(m)) {
          reachedMilestones.add(m);
          track('scroll_depth', {
            percent: m,
            path: location.pathname,
            time_to_depth_ms: Date.now() - routeEnteredAt,
          });
        }
      }

      // 원시 스크롤은 배치를 잠식하지 않도록 2초에 한 번으로 제한한다.
      const now = Date.now();
      if (now - lastEmit >= TRACKER_CONFIG.scrollMinIntervalMs) {
        lastEmit = now;
        track('scroll', {
          y,
          direction: y >= lastY ? 'down' : 'up',
          viewport_h: window.innerHeight,
          doc_h: document.documentElement.scrollHeight,
        });
      }
      lastY = y;
    }, TRACKER_CONFIG.scrollThrottleMs);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}

/** 사용자가 직접 선택 후 Ctrl+C 한 경우. 버튼 복사는 CopyNameButton 이 따로 보낸다. */
export function installClipboard(): () => void {
  const onCopy = () => {
    const sel = window.getSelection?.()?.toString() ?? '';
    const text = sel.trim();
    if (!text) return;
    track('clipboard_copy', { selected_text: text.slice(0, 200), length: text.length, path: location.pathname, source: 'selection' });
  };
  document.addEventListener('copy', onCopy);
  return () => document.removeEventListener('copy', onCopy);
}

/** [data-field] 요소의 체류 시간. 값은 절대 보내지 않는다. */
export function installFormField(): () => void {
  const enteredAt = new Map<Element, number>();
  const initial = new Map<Element, string>();

  const onIn = (e: Event) => {
    const el = e.target as HTMLElement | null;
    if (!el?.matches?.('[data-field]')) return;
    enteredAt.set(el, Date.now());
    initial.set(el, (el as HTMLInputElement).value ?? '');
  };

  const onOut = (e: Event) => {
    const el = e.target as HTMLElement | null;
    if (!el?.matches?.('[data-field]')) return;
    const start = enteredAt.get(el);
    if (!start) return;
    enteredAt.delete(el);

    const value = (el as HTMLInputElement).value ?? '';
    const before = initial.get(el) ?? '';
    initial.delete(el);

    track('form_field', {
      form: el.closest('[data-form]')?.getAttribute('data-form') ?? 'unknown',
      field: el.getAttribute('data-field'),
      dwell_ms: Date.now() - start,
      changed: value !== before,
      filled: value.length > 0,
      length: value.length,
    });
  };

  document.addEventListener('focusin', onIn);
  document.addEventListener('focusout', onOut);
  return () => {
    document.removeEventListener('focusin', onIn);
    document.removeEventListener('focusout', onOut);
  };
}

/** 위임 클릭 — click 과 external_link 를 함께 만든다. 좌표는 담지 않는다. */
export function installClicks(): () => void {
  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest) return;
    // 발표용 패널·위젯은 신호 스트림을 오염시키지 않는다.
    if (target.closest('[data-hover-ignore]')) return;

    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (anchor?.href) {
      try {
        const url = new URL(anchor.href, location.href);
        if (url.host && url.host !== location.host) {
          // ExternalLink 컴포넌트가 이미 보냈으면 중복하지 않는다.
          if (!anchor.hasAttribute('data-external')) {
            track('external_link', {
              href: url.href,
              hostname: url.hostname,
              label: anchor.textContent?.trim().slice(0, 60) ?? '',
              path: location.pathname,
            });
          }
          return;
        }
      } catch {
        /* 잘못된 href 는 무시 */
      }
    }

    const tracked = target.closest('[data-track]') as HTMLElement | null;
    const el = tracked ?? (target.closest('button, [role="button"], a') as HTMLElement | null);
    if (!el) return;

    track('click', {
      action: tracked?.getAttribute('data-track') ?? el.tagName.toLowerCase(),
      label: el.getAttribute('data-label') ?? el.textContent?.trim().slice(0, 60) ?? '',
      hotel_id: el.getAttribute('data-hotel-id') ?? undefined,
      source: el.getAttribute('data-source') ?? undefined,
      path: location.pathname,
    });
  };

  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

/**
 * page_lifecycle 은 'hide'/'show' phase 를 쓰지 않는다.
 * 워커는 그 두 값을 visibility_change 의 별칭으로 처리하므로, 둘 다 보내면
 * hidden_at 에 기록자가 둘이 되어 S1 타이밍이 깨진다.
 */
export function installLifecycle(): () => void {
  const onPageHide = () => {
    track('page_lifecycle', { phase: 'pagehide', path: location.pathname }, { buildOnly: false });
    flushWithBeacon();
  };
  const onPageShow = (e: PageTransitionEvent) => {
    track('page_lifecycle', { phase: e.persisted ? 'bfcache_restore' : 'pageshow', path: location.pathname });
  };
  const onFreeze = () => track('page_lifecycle', { phase: 'freeze', path: location.pathname });
  const onResume = () => track('page_lifecycle', { phase: 'resume', path: location.pathname });

  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  document.addEventListener('freeze', onFreeze);
  document.addEventListener('resume', onResume);

  return () => {
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    document.removeEventListener('freeze', onFreeze);
    document.removeEventListener('resume', onResume);
  };
}
