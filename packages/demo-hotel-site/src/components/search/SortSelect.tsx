'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { META } from '@/lib/hotels';
import { track } from '@/lib/tracker';

export function SortSelect() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get('sort') ?? 'recommend';

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">정렬</span>
      <select
        value={current}
        data-field="sort"
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set('sort', e.target.value);
          track('search_query', {
            query: next.get('q') ?? '',
            sort: e.target.value,
            changed: 'sort',
            source: 'sort',
          });
          router.replace(`/search?${next}`, { scroll: false });
        }}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        {META.sorts.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
