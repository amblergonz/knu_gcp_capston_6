'use client';

import { BOOSTER_ORDER, type BoosterName, type RuntimeConfig } from '@/lib/tracker/rules';
import { cn } from '@/lib/cn';

export function IntentGauge({
  score,
  active,
  cfg,
}: {
  score: number;
  active: BoosterName[];
  cfg: RuntimeConfig;
}) {
  const s1 = cfg.scenarios.S1.intent_score_min;
  const s2 = cfg.scenarios.S2.intent_score_min;

  // 게이지 상한은 켜져 있는 가중치의 합. 다 켜도 눈금이 화면 밖으로 나가지 않는다.
  const enabledSum = BOOSTER_ORDER.reduce((sum, b) => sum + (cfg.boosters[b]?.enabled ? cfg.boosters[b].weight : 0), 0);
  const max = Math.max(1, Math.ceil(Math.max(enabledSum, s1) * 10) / 10);

  const pct = Math.min(100, (score / max) * 100);
  const tone = score >= s1 ? 'text-emerald-400' : score >= s2 ? 'text-amber-400' : 'text-slate-400';

  const shown = BOOSTER_ORDER.filter((b) => !cfg.boosters[b]?.reserved);

  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-4xl font-bold tabular-nums leading-none', tone)}>{score.toFixed(2)}</span>
        <span className="text-sm tabular-nums text-slate-600">/ {max.toFixed(2)}</span>
      </div>

      <div className="relative mt-4 h-2.5 w-full rounded-full bg-slate-800">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 to-brand-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
        <Tick at={s2 / max} label="S2" />
        <Tick at={s1 / max} label="S1" />
      </div>

      <ul className="mt-7 space-y-1">
        {shown.map((b) => {
          const cfgB = cfg.boosters[b];
          const on = active.includes(b);
          const scored = on && cfgB?.enabled;
          return (
            <li
              key={b}
              className={cn(
                'flex items-center justify-between rounded px-2 py-1 font-mono text-[10px]',
                scored ? 'bg-slate-800 text-sky-300' : on ? 'bg-slate-900 text-slate-500' : 'text-slate-600',
              )}
            >
              <span className="truncate">
                {b}
                <span className={cn('ml-1.5 font-sans', scored ? 'text-slate-400' : 'text-slate-700')}>
                  {cfgB?.label}
                </span>
                {on && !cfgB?.enabled && <span className="ml-1.5 font-sans text-amber-500/70">OFF</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                {scored ? `+${cfgB.weight.toFixed(2)}` : '+0.00'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tick({ at, label }: { at: number; label: string }) {
  const left = Math.min(100, Math.max(0, at * 100));
  return (
    <span className="absolute -top-[3px] h-[17px] w-px bg-rose-400/80" style={{ left: `${left}%` }}>
      <span className="absolute left-1/2 top-[19px] -translate-x-1/2 text-[9px] font-bold text-rose-300">
        {label}
      </span>
    </span>
  );
}
