'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Hotel } from '@/lib/hotels';
import { Button } from '@/components/ui/Button';
import { WishlistButton } from '@/components/ui/WishlistButton';
import { CheckIcon } from '@/components/icons';
import { addRoom, hydrateCart, setStay, useCart } from '@/lib/cart';
import { won, nights } from '@/lib/format';

export function BookingSidebar({ hotel }: { hotel: Hotel }) {
  const router = useRouter();
  const cart = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrateCart();
    setMounted(true);
  }, []);

  const room = hotel.rooms[0];
  const n = mounted ? nights(cart.checkin, cart.checkout) : 1;
  const total = room.price * n;

  const add = () => {
    addRoom({
      hotel_id: hotel.id,
      hotel_name: hotel.name,
      room_id: room.id,
      room_name: room.name,
      price: room.price,
      options: [],
    });
  };

  return (
    <aside className="lg:sticky lg:top-[96px] lg:self-start">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500">1박 요금부터</span>
          <span className="text-2xl font-bold tabular-nums text-rose-600">{won(room.price)}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Field label="체크인">
            <input
              type="date"
              data-field="checkin"
              value={mounted ? cart.checkin : ''}
              onChange={(e) => setStay({ checkin: e.target.value })}
              className="w-full bg-transparent text-sm text-slate-900 outline-none"
            />
          </Field>
          <Field label="체크아웃">
            <input
              type="date"
              data-field="checkout"
              value={mounted ? cart.checkout : ''}
              onChange={(e) => setStay({ checkout: e.target.value })}
              className="w-full bg-transparent text-sm text-slate-900 outline-none"
            />
          </Field>
        </div>

        <div className="mt-2">
          <Field label="인원">
            <select
              data-field="guests"
              value={mounted ? cart.guests : 2}
              onChange={(e) => setStay({ guests: Number(e.target.value) })}
              className="w-full bg-transparent text-sm text-slate-900 outline-none"
            >
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>
                  성인 {g}명
                </option>
              ))}
            </select>
          </Field>
        </div>

        <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
          <Row k={`${won(room.price)} × ${n}박`} v={won(total)} />
          <Row k="세금·봉사료" v="포함" muted />
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
            <dt className="text-sm font-bold text-slate-900">합계</dt>
            <dd className="text-xl font-bold tabular-nums text-rose-600">{won(total)}</dd>
          </div>
        </dl>

        <div className="mt-4 space-y-2">
          <Button
            size="lg"
            className="w-full"
            data-track="detail_select_room"
            data-hotel-id={hotel.id}
            onClick={() => router.push(`/rooms?hotel=${hotel.id}`)}
          >
            객실 선택하기
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            data-track="detail_add_cart"
            data-hotel-id={hotel.id}
            onClick={add}
          >
            예약 담기
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <CheckIcon size={14} />
            무료 취소 가능
          </span>
          <WishlistButton hotelId={hotel.id} hotelName={hotel.name} source="detail_sidebar" variant="inline" />
        </div>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>
      <span className="flex h-10 items-center rounded-lg border border-slate-200 px-2.5 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
        {children}
      </span>
    </label>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-600">{k}</dt>
      <dd className={muted ? 'text-slate-400' : 'tabular-nums text-slate-800'}>{v}</dd>
    </div>
  );
}
