'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { META } from '@/lib/hotels';
import { StarRating } from '@/components/hotel/StarRating';
import { SlidersIcon, ChevronDownIcon } from '@/components/icons';
import { track } from '@/lib/tracker';
import { cn } from '@/lib/cn';

// 필터 상태는 전부 URL searchParams 가 단일 출처다.
// 뒤로가기·새로고침·링크 공유가 그대로 동작하고, 서버 컴포넌트가 필터링을 담당할 수 있다.
export function FilterSidebar({ counts }: { counts: { region: Record<string, number>; star: Record<number, number>; category: Record<string, number> } }) {
  const router = useRouter();
  const params = useSearchParams();

  const list = useCallback((key: string) => params.getAll(key), [params]);

  const update = useCallback(
    (mutate: (p: URLSearchParams) => void, label: string) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      track('search_query', {
        query: next.get('q') ?? '',
        filters: Object.fromEntries(next.entries()),
        changed: label,
        source: 'filter',
      });
      router.replace(`/search${next.toString() ? `?${next}` : ''}`, { scroll: false });
    },
    [params, router],
  );

  const toggle = (key: string, value: string) =>
    update((p) => {
      const cur = p.getAll(key);
      p.delete(key);
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : cur.concat(value);
      next.forEach((v) => p.append(key, v));
    }, `${key}:${value}`);

  const setSingle = (key: string, value: string | null) =>
    update((p) => {
      p.delete(key);
      if (value) p.set(key, value);
    }, `${key}:${value ?? 'off'}`);

  const activeCount = ['region', 'star', 'category', 'amenities', 'price', 'rating'].reduce(
    (n, k) => n + params.getAll(k).length,
    0,
  );

  return (
    <aside className="lg:sticky lg:top-[144px] lg:self-start">
      {/*
        모바일에서는 접힌 <details> 로, lg 이상에서는 항상 펼쳐진 사이드바로 동작한다.
        group-open 으로 여닫고 lg:block 으로 데스크톱에서는 open 상태와 무관하게 보인다.
      */}
      <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-200 px-4 py-3 marker:hidden lg:cursor-default">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <SlidersIcon size={16} className="text-slate-400" />
            필터
            {activeCount > 0 && (
              <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold tabular-nums text-white">
                {activeCount}
              </span>
            )}
          </span>
          <ChevronDownIcon
            size={16}
            className="text-slate-400 transition-transform group-open:rotate-180 lg:hidden"
          />
        </summary>

        <div className="hidden max-h-[70vh] divide-y divide-slate-200 overflow-y-auto overscroll-contain group-open:block lg:block lg:max-h-[calc(100vh-264px)]">
          {activeCount > 0 && (
            <div className="flex justify-end px-4 py-2">
              <button
                type="button"
                data-track="filter_reset"
                onClick={() =>
                  update((p) => {
                    const q = p.get('q');
                    const sort = p.get('sort');
                    Array.from(p.keys()).forEach((k) => p.delete(k));
                    if (q) p.set('q', q);
                    if (sort) p.set('sort', sort);
                  }, 'reset')
                }
                className="text-xs font-semibold text-brand-600 hover:underline"
              >
                필터 초기화
              </button>
            </div>
          )}
          <Group title="가격">
            <div className="space-y-1.5">
              {META.price_presets.map((p) => (
                <Row
                  key={p.id}
                  checked={params.get('price') === p.id}
                  onChange={() => setSingle('price', params.get('price') === p.id ? null : p.id)}
                  label={p.label}
                />
              ))}
            </div>
          </Group>

          <Group title="성급">
            <div className="space-y-1.5">
              {[5, 4, 3].map((s) => (
                <Row
                  key={s}
                  checked={list('star').includes(String(s))}
                  onChange={() => toggle('star', String(s))}
                  label={<StarRating star={s} size={13} />}
                  count={counts.star[s] ?? 0}
                />
              ))}
            </div>
          </Group>

          <Group title="지역">
            <div className="space-y-1.5">
              {META.regions.map((r) => (
                <Row
                  key={r}
                  checked={list('region').includes(r)}
                  onChange={() => toggle('region', r)}
                  label={r}
                  count={counts.region[r] ?? 0}
                />
              ))}
            </div>
          </Group>

          <Group title="숙소 유형">
            <div className="space-y-1.5">
              {META.categories.map((c) => (
                <Row
                  key={c}
                  checked={list('category').includes(c)}
                  onChange={() => toggle('category', c)}
                  label={c}
                  count={counts.category[c] ?? 0}
                />
              ))}
            </div>
          </Group>

          <Group title="편의시설">
            <div className="space-y-1.5">
              {META.amenities.map((a) => (
                <Row
                  key={a.id}
                  checked={list('amenities').includes(a.id)}
                  onChange={() => toggle('amenities', a.id)}
                  label={a.label}
                />
              ))}
            </div>
          </Group>

          <Group title="평점">
            <div className="space-y-1.5">
              {[
                { v: '4.5', label: '4.5 이상' },
                { v: '4.0', label: '4.0 이상' },
              ].map((o) => (
                <Row
                  key={o.v}
                  checked={params.get('rating') === o.v}
                  onChange={() => setSingle('rating', params.get('rating') === o.v ? null : o.v)}
                  label={o.label}
                />
              ))}
            </div>
          </Group>
        </div>
      </details>
    </aside>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4">
      <p className="mb-2.5 text-xs font-bold text-slate-600">{title}</p>
      {children}
    </div>
  );
}

function Row({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
  count?: number;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors',
        checked ? 'text-slate-900' : 'text-slate-600 hover:bg-slate-50',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span className="flex-1 truncate">{label}</span>
      {typeof count === 'number' && <span className="text-xs tabular-nums text-slate-400">{count}</span>}
    </label>
  );
}
