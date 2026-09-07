'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SearchIcon, CalendarIcon, UserIcon } from '@/components/icons';
import { track } from '@/lib/tracker';
import { hydrateCart, setStay, useCart } from '@/lib/cart';
import { cn } from '@/lib/cn';

// hero: 홈의 큰 검색 카드 / compact: 검색 결과 상단의 슬림 바
export function SearchBar({ variant = 'hero' }: { variant?: 'hero' | 'compact' }) {
  const router = useRouter();
  const params = useSearchParams();
  const cart = useCart();
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    hydrateCart();
    setMounted(true);
    setQ(params.get('q') ?? '');
  }, [params]);

  // 서버 렌더와 값이 어긋나지 않도록 마운트 전에는 빈 값으로 그린다.
  const checkin = mounted ? cart.checkin : '';
  const checkout = mounted ? cart.checkout : '';
  const guests = mounted ? cart.guests : 2;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    track('search_query', {
      query: q,
      destination: q,
      checkin,
      checkout,
      guests,
      source: variant,
    });
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    router.push(`/search${next.toString() ? `?${next}` : ''}`);
  }

  const compact = variant === 'compact';

  return (
    <form
      onSubmit={submit}
      className={cn(
        'grid items-end gap-3',
        compact
          ? 'grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_auto]'
          : 'grid-cols-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg md:grid-cols-2 lg:grid-cols-[1.6fr_1.4fr_1fr_auto] lg:p-6',
      )}
    >
      <Field label="목적지 · 숙소명" compact={compact}>
        <SearchIcon size={16} className="shrink-0 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="서울, 제주, 신라 호텔..."
          data-field="destination"
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </Field>

      <Field label="체크인 · 체크아웃" compact={compact}>
        <CalendarIcon size={16} className="shrink-0 text-slate-400" />
        <input
          type="date"
          value={checkin}
          onChange={(e) => setStay({ checkin: e.target.value })}
          data-field="checkin"
          className="w-full bg-transparent text-sm text-slate-900 outline-none"
        />
        <span className="text-slate-300">–</span>
        <input
          type="date"
          value={checkout}
          onChange={(e) => setStay({ checkout: e.target.value })}
          data-field="checkout"
          className="w-full bg-transparent text-sm text-slate-900 outline-none"
        />
      </Field>

      <Field label="인원" compact={compact}>
        <UserIcon size={16} className="shrink-0 text-slate-400" />
        <select
          value={guests}
          onChange={(e) => setStay({ guests: Number(e.target.value) })}
          data-field="guests"
          className="w-full bg-transparent text-sm text-slate-900 outline-none"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              성인 {n}명
            </option>
          ))}
        </select>
      </Field>

      <button
        type="submit"
        data-track="search_submit"
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 font-bold text-white transition-colors hover:bg-brand-700',
          compact ? 'h-11 px-6 text-sm' : 'h-12 px-8 text-sm',
        )}
      >
        <SearchIcon size={17} />
        검색
      </button>
    </form>
  );
}

function Field({ label, compact, children }: { label: string; compact: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      {!compact && (
        <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      )}
      <span className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
        {children}
      </span>
    </label>
  );
}
