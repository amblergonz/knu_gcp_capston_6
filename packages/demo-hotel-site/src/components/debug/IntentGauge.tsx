'use client';

import { BOOSTER_LABELS, BOOSTER_WEIGHTS, S1, S2 } from '@/lib/tracker/rules';
import type { BoosterName } from '@/lib/tracker/types';
import { cn } from '@/lib/cn';

const ALL: BoosterName[] = [
  'clipboard_copy_match',
  'hidden_repeated',
  'session_length_5min',
  'broadcast_channel_multi_tab',
  'referrer_price_compare',
];

// 게이지 상한. 부스터 가중치 합의 최대치(1.9)를 다 그리면 임계선이 왼쪽에 몰려
// 0.5 / 0.6 구간의 차이가 안 보인다. 1.0 에서 자른다.
const MAX = 1.0;

export function IntentGauge({ score, active }: { score: number; active: BoosterName[] }) {
  const pct = Math.min(100, (score / MAX) * 100);
  const tone = score >= S1.intentScoreMin ? 'text-emerald-400' : score >= S2.intentScoreMin ? 'text-amber-400' : 'text-slate-400';

  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-4xl font-bold tabular-nums leading-none', tone)}>{score.toFixed(2)}</span>
        <span className="text-sm tabular-nums text-slate-600">/ {MAX.toFixed(2)}</span>
      </div>

      <div className="relative mt-4 h-2.5 w-full rounded-full bg-slate-800">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 to-brand-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
        <Tick at={S2.intentScoreMin / MAX} label="S2" />
        <Tick at={S1.intentScoreMin / MAX} label="S1" />
      </div>

      <ul className="mt-7 space-y-1">
        {ALL.map((b) => {
          const on = active.includes(b);
          return (
            <li
              key={b}
              className={cn(
                'flex items-center justify-between rounded px-2 py-1 font-mono text-[10px]',
                on ? 'bg-slate-800 text-sky-300' : 'text-slate-600',
              )}
            >
              <span className="truncate">
                {b}
                <span className={cn('ml-1.5 font-sans', on ? 'text-slate-400' : 'text-slate-700')}>
                  {BOOSTER_LABELS[b]}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                {on ? `+${BOOSTER_WEIGHTS[b].toFixed(2)}` : '+0.00'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tick({ at, label }: { at: number; label: string }) {
  return (
    <span className="absolute -top-[3px] h-[17px] w-px bg-rose-400/80" style={{ left: `${at * 100}%` }}>
      <span className="absolute left-1/2 top-[19px] -translate-x-1/2 text-[9px] font-bold text-rose-300">
        {label}
      </span>
    </span>
  );
}
