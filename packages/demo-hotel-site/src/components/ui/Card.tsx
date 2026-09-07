import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// 밝은 캔버스 위에서는 그림자가 아니라 1px 보더가 카드 분리를 담당한다.
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-card', className)}>{children}</div>
  );
}
