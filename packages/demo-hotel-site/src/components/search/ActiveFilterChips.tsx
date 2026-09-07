'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CloseIcon } from '@/components/icons';
import { META } from '@/lib/hotels';

const LABEL_KEYS = ['region', 'star', 'category', 'amenities', 'price', 'rating'] as const;

function labelFor(key: string, value: string): string {
  if (key === 'star') return `${value}성급`;
  if (key === 'rating') return `평점 ${value} 이상`;
  if (key === 'price') return META.price_presets.find((p) => p.id === value)?.label ?? value;
  if (key === 'amenities') return META.amenities.find((a) => a.id === value)?.label ?? value;
  return value;
}

export function ActiveFilterChips() {
  const router = useRouter();
  const params = useSearchParams();

  const chips: { key: string; value: string }[] = [];
  for (const key of LABEL_KEYS) {
    for (const value of params.getAll(key)) chips.push({ key, value });
  }
  if (chips.length === 0) return null;

  function remove(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const cur = next.getAll(key).filter((v) => v !== value);
    next.delete(key);
    cur.forEach((v) => next.append(key, v));
    router.replace(`/search${next.toString() ? `?${next}` : ''}`, { scroll: false });
  }

  return (
    <ul className="mb-4 flex flex-wrap gap-2">
      {chips.map((c) => (
        <li key={`${c.key}-${c.value}`}>
          <button
            type="button"
            data-track="filter_chip_remove"
            onClick={() => remove(c.key, c.value)}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-100 transition-colors hover:bg-brand-100"
          >
            {labelFor(c.key, c.value)}
            <CloseIcon size={12} />
          </button>
        </li>
      ))}
    </ul>
  );
}
