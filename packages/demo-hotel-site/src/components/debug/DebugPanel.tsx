'use client';

import { useEffect, useState } from 'react';
import { useTrackerSnapshot } from '@/lib/tracker/useTracker';
import { evaluateMirror, S1, type Mirror } from '@/lib/tracker/rules';
import { getMirror, restartSession, requestPoll } from '@/lib/tracker';
import { setPaused } from '@/lib/tracker/queue';
import { clearCart } from '@/lib/cart';
import { EVENT_TYPES } from '@/lib/tracker/types';
import { IntentGauge } from './IntentGauge';
import { ScenarioChecklist } from './ScenarioChecklist';
import { cn } from '@/lib/cn';

const OPEN_KEY = 'hover_demo_panel_open';

const LEVEL_COLOR: Record<string, string> = {
  sent: 'border-sky-500 text-sky-300',
  queued: 'border-slate-700 text-slate-400',
  error: 'border-rose-500 text-rose-300',
  info: 'border-slate-700 text-slate-400',
  decision: 'border-emerald-500 text-emerald-300',
};

export function DebugPanel() {
  const snap = useTrackerSnapshot();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // 탭이 숨겨진 시간은 이벤트 없이도 흘러가므로 별도로 초를 돌린다.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      setOpen(localStorage.getItem(OPEN_KEY) === '1');
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setOpen((v) => {
          try {
            localStorage.setItem(OPEN_KEY, v ? '0' : '1');
          } catch {
            /* noop */
          }
          return !v;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem(OPEN_KEY, v ? '0' : '1');
      } catch {
        /* noop */
      }
      return !v;
    });

  // 미러는 모듈 상태라 tick 마다 다시 읽어 숨김 초를 갱신한다.
  const mirror: Mirror = mounted ? getMirror() : { sessionStartedAt: 0, cartCount: 0, hiddenAt: 0, hiddenCount: 0, boosters: [], hotelName: '', tabCount: 1 };
  const scenarios = mounted ? evaluateMirror(mirror, Date.now()) : [];
  void tick;

  const maxCount = Math.max(1, ...EVENT_TYPES.map((t) => snap.counts[t] ?? 0));
  const sessionAgeMin = snap.sessionStartedAt ? Math.floor((Date.now() - snap.sessionStartedAt) / 60000) : 0;
  const gap = Math.max(0, S1.intentScoreMin - snap.intentScore);
  const hint = gap > 0 ? `S1 까지 ${gap.toFixed(2)} 부족` : null;

  return (
    <aside
      data-hover-ignore
      data-open={open}
      className={cn(
        'fixed right-0 top-0 z-panel flex h-screen supports-[height:100dvh]:h-[100dvh] w-[min(360px,calc(100vw-2.5rem))] translate-x-full flex-col',
        'border-l border-slate-800 bg-slate-950 text-slate-200 shadow-2xl',
        'transition-transform duration-300 ease-out data-[open=true]:translate-x-0',
      )}
    >
      {/* 손잡이는 패널 바깥에 둔다. 접혀 있어도 항상 보인다. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="absolute left-0 top-28 -translate-x-full rounded-l-lg border border-r-0 border-slate-800 bg-slate-950 px-2 py-5 text-[11px] font-bold tracking-[0.2em] text-slate-300 [writing-mode:vertical-rl] hover:text-white"
      >
        SIGNAL
      </button>

      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <span
          className={cn(
            'h-2 w-2 shrink-0 animate-pulse-dot rounded-full',
            snap.ingestion === 'down' ? 'bg-rose-500' : snap.ingestion === 'ok' ? 'bg-emerald-500' : 'bg-slate-600',
          )}
        />
        <span
          className={cn(
            'text-[11px] font-bold',
            snap.ingestion === 'down' ? 'text-rose-400' : snap.ingestion === 'ok' ? 'text-emerald-400' : 'text-slate-500',
          )}
        >
          {snap.ingestion === 'down' ? 'OFFLINE' : snap.ingestion === 'ok' ? 'LIVE' : '대기'}
        </span>
        <span className="ml-auto truncate font-mono text-[10px] text-slate-500" title={snap.sessionId}>
          {mounted && snap.sessionId ? snap.sessionId : '—'}
        </span>
      </div>

      <div className="panel-scroll flex-1 divide-y divide-slate-800 overflow-y-auto overscroll-contain">
        <Section title="Intent Score">
          <IntentGauge score={snap.intentScore} active={snap.boosters} />
          {snap.lastAuthoritative && (
            <p className="mt-4 rounded bg-slate-900 px-2 py-1.5 text-[10px] text-slate-500">
              위 값은 클라이언트 추정입니다. 마지막 개입의 서버 값:{' '}
              <span className="font-mono text-slate-300">{snap.lastAuthoritative.intentScore.toFixed(2)}</span>
              {Math.abs(snap.lastAuthoritative.intentScore - snap.intentScore) > 0.001 && (
                <span className="ml-1 rounded bg-amber-500/20 px-1 text-amber-400">불일치</span>
              )}
            </p>
          )}
        </Section>

        <Section title="시나리오 조건">
          <ScenarioChecklist scenarios={scenarios} hint={hint} />
        </Section>

        <Section title="세션">
          <dl className="space-y-1.5 text-[11px]">
            <Row k="A/B 그룹" v={mounted ? snap.abGroup : '—'} tone={snap.abGroup === 'treatment' ? 'good' : 'warn'} />
            <Row k="장바구니" v={`${snap.cartCount}개`} />
            <Row k="탭 수" v={`${snap.tabCount}개`} />
            <Row
              k="유입 referrer"
              v={snap.referrer ? `${snap.referrer.slice(0, 24)} ${snap.referrerMatched ? '(매치)' : '(불일치)'}` : '없음'}
              tone={snap.referrerMatched ? 'good' : undefined}
            />
            <Row k="세션 경과" v={`${sessionAgeMin}분`} tone={sessionAgeMin >= 25 ? 'warn' : undefined} />
            <Row k="대기 큐" v={`${snap.queued}건`} />
            {snap.clockSkewMs !== null && Math.abs(snap.clockSkewMs) > 3000 && (
              <Row k="서버 시계 차이" v={`${(snap.clockSkewMs / 1000).toFixed(1)}초`} tone="bad" />
            )}
          </dl>
          {snap.clockSkewMs !== null && Math.abs(snap.clockSkewMs) > 3000 && (
            <p className="mt-2 rounded bg-rose-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-rose-300">
              서버와 시계가 {(snap.clockSkewMs / 1000).toFixed(1)}초 어긋나 있습니다. 워커가 탭 숨김 시간을 잘못 계산해
              S1 이 안 뜨거나 즉시 뜹니다. Docker Desktop 을 재시작하세요.
            </p>
          )}
        </Section>

        <Section title={`신호 커버리지 (${EVENT_TYPES.filter((t) => (snap.counts[t] ?? 0) > 0).length}/16)`}>
          <ul className="space-y-0.5">
            {EVENT_TYPES.map((t) => {
              const c = snap.counts[t] ?? 0;
              return (
                <li key={t} className="relative grid grid-cols-[1fr_auto] items-center px-1.5 py-0.5">
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm bg-sky-500/15"
                    style={{ width: `${(c / maxCount) * 100}%` }}
                  />
                  <span className={cn('relative truncate font-mono text-[10px]', c > 0 ? 'text-slate-300' : 'text-slate-700')}>
                    {t}
                  </span>
                  <span className={cn('relative tabular-nums text-[10px]', c > 0 ? 'text-slate-400' : 'text-slate-700')}>
                    {c}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="이벤트 로그">
          {snap.log.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-slate-600">아직 기록된 이벤트가 없습니다</p>
          ) : (
            <ul className="space-y-1">
              {snap.log.slice(0, 30).map((e, i) => (
                <li
                  key={e.id}
                  className={cn(
                    'border-l-2 py-1 pl-2 font-mono text-[10px]',
                    LEVEL_COLOR[e.level] ?? 'border-slate-700 text-slate-400',
                    i === 0 && 'animate-log-in',
                  )}
                >
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{e.type}</span>
                    <span className="shrink-0 text-slate-600">
                      {new Date(e.ts).toLocaleTimeString('ko-KR', { hour12: false })}
                    </span>
                  </div>
                  {e.detail && <div className="truncate text-slate-600">{e.detail}</div>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-800 p-3">
        <PanelButton onClick={() => restartSession('treatment')}>새 세션 시작</PanelButton>
        <PanelButton onClick={() => requestPoll('manual')}>Decision 폴링</PanelButton>
        <PanelButton onClick={() => setPaused(!snap.paused)}>
          {snap.paused ? '전송 재개' : '전송 일시정지'}
        </PanelButton>
        <PanelButton onClick={() => clearCart()}>장바구니 비우기</PanelButton>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 py-4">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{title}</p>
      {children}
    </section>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="shrink-0 text-slate-500">{k}</dt>
      <dd
        className={cn(
          'truncate font-mono',
          tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'bad' ? 'text-rose-400' : 'text-slate-300',
        )}
      >
        {v}
      </dd>
    </div>
  );
}

function PanelButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-800 bg-slate-900 px-2 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
    >
      {children}
    </button>
  );
}
