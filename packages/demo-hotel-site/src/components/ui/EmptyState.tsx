import type { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
      <div className="mx-auto mb-5 h-20 w-32 rounded-xl border-2 border-dashed border-slate-200" />
      <p className="text-base font-bold text-slate-900">{title}</p>
      {description ? <p className="prose-ko mt-1.5 text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
