'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Hotel } from '@/lib/hotels';
import { addRoom, hydrateCart, useCart } from '@/lib/cart';
import { won, nights } from '@/lib/format';

// 모바일에서는 예약 사이드바가 리뷰 아래로 밀려 CTA 가 화면 밖으로 나간다.
// 실제 예약 사이트처럼 하단 고정 바를 둔다. lg 이상에서는 사이드바가 그 역할을 하므로 숨긴다.
export function MobileBookingBar({ hotel }: { hotel: Hotel }) {
  const router = useRouter();
  const cart = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrateCart();
    setMounted(true);
  }, []);

  const room = hotel.rooms[0];
  const n = mounted ? nights(cart.checkin, cart.checkout) : 1;

  return (
    <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-container items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-slate-500">{n}박 기준 · 1박부터</p>
          <p className="text-lg font-bold tabular-nums leading-tight text-rose-600">{won(room.price)}</p>
        </div>
        <button
          type="button"
          data-track="mobile_add_cart"
          data-hotel-id={hotel.id}
          onClick={() =>
            addRoom({
              hotel_id: hotel.id,
              hotel_name: hotel.name,
              room_id: room.id,
              room_name: room.name,
              price: room.price,
              options: [],
            })
          }
          className="h-11 shrink-0 rounded-lg border border-brand-600 px-4 text-sm font-semibold text-brand-700"
        >
          담기
        </button>
        <button
          type="button"
          data-track="mobile_select_room"
          data-hotel-id={hotel.id}
          onClick={() => router.push(`/rooms?hotel=${hotel.id}`)}
          className="h-11 shrink-0 rounded-lg bg-brand-600 px-5 text-sm font-bold text-white"
        >
          객실 선택
        </button>
      </div>
    </div>
  );
}
