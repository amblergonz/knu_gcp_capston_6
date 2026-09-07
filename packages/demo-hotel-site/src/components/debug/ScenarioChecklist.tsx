'use client';

import { CheckIcon } from '@/components/icons';
import type { ScenarioStatus } from '@/lib/tracker/rules';
import { cn } from '@/lib/cn';

// 체크 상태는 글리프가 아니라 14px 사각형으로 그린다 (이모지 금지).
function Box({ state }: { state: 'off' | 'partial' | 'on' }) {
  if (state === 'on') {
    return (
      <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] bg-emerald-500 text-white">
        <CheckIcon size={10} />
      </span>
    );
  }
  if (state === 'partial') {
    return (
      <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] bg-amber-400">
        <span className="h-1.5 w-1.5 rounded-[1px] bg-slate-900" />
      </span>
    );
  }
  return <span className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-slate-600" />;
}

export function ScenarioChecklist({ scenarios, hint }: { scenarios: ScenarioStatus[]; hint: string | null }) {
  const next = scenarios.find((s) => s.wouldFire);

  return (
    <div className="space-y-4">
      {scenarios.map((s) => (
        <div key={s.id}>
          <p className="mb-2 flex items-center justify-between text-[11px] font-bold text-slate-300">
            {s.title}
            {s.wouldFire && (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                조건 충족
              </span>
            )}
          </p>
          <ul className="space-y-1.5">
            {s.rows.map((r) => (
              <li key={r.label} className="flex items-center gap-2 text-[11px]">
                <Box state={r.met ? 'on' : r.current !== '0개' && r.current !== '0초' && r.current !== '없음' ? 'partial' : 'off'} />
                <span className={cn('flex-1 truncate', r.met ? 'text-slate-200' : 'text-slate-400')}>{r.label}</span>
                <span className="shrink-0 font-mono tabular-nums text-slate-500">{r.current}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="border-t border-slate-800 pt-3 text-[11px]">
        {next ? (
          <span className="font-semibold text-emerald-400">다음 발화 예상: {next.id}</span>
        ) : (
          <span className="text-slate-500">조건 미충족{hint ? ` — ${hint}` : ''}</span>
        )}
      </p>
    </div>
  );
}
