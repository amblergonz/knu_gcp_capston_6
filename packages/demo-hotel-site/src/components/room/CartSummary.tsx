'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CloseIcon } from '@/components/icons';
import { cartTotal, hydrateCart, removeRoom, useCart } from '@/lib/cart';
import { won, nights } from '@/lib/format';

export function CartSummary() {
  const router = useRouter();
  const cart = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrateCart();
    setMounted(true);
  }, []);

  const n = mounted ? nights(cart.checkin, cart.checkout) : 1;
  const total = mounted ? cartTotal(cart, n) : 0;
  const lines = mounted ? cart.lines : [];

  return (
    <aside className="lg:sticky lg:top-[152px] lg:self-start">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-base font-bold text-slate-900">선택한 객실</h2>

        {lines.length === 0 ? (
          <p className="prose-ko mt-6 rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            객실을 선택해 주세요
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {lines.map((l) => (
              <li key={l.room_id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{l.room_name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {won(l.price)} × {n}박 × {l.qty}실
                    </p>
                    {l.options.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {l.options.map((o) => o.label).join(', ')}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`${l.room_name} 삭제`}
                    data-track="cart_remove"
                    onClick={() => removeRoom(l.room_id)}
                    className="shrink-0 rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
                <p className="mt-1 text-right text-sm font-bold tabular-nums text-slate-800">
                  {won((l.price * n + l.options.reduce((s, o) => s + o.price, 0)) * l.qty)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-sm font-bold text-slate-900">총 합계</span>
          <span className="text-xl font-bold tabular-nums text-rose-600">{won(total)}</span>
        </div>

        <Button
          size="lg"
          className="mt-4 w-full"
          disabled={lines.length === 0}
          data-track="cart_to_checkout"
          onClick={() => router.push('/checkout')}
        >
          예약하기
        </Button>
      </div>
    </aside>
  );
}
