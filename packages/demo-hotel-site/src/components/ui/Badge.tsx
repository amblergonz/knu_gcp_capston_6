import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'blue' | 'rose' | 'emerald' | 'slate' | 'amber';

const TONE: Record<Tone, string> = {
  blue: 'bg-brand-50 text-brand-700 ring-brand-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
};

export function Badge({ tone = 'slate', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
