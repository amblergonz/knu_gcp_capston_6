'use client';

import { useState } from 'react';
import type { Hotel, Room } from '@/lib/hotels';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { CopyNameButton } from '@/components/ui/CopyNameButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { addRoom, setQty, useCart } from '@/lib/cart';
import { won } from '@/lib/format';
import { cn } from '@/lib/cn';

export function RoomCard({ hotel, room }: { hotel: Hotel; room: Room }) {
  const cart = useCart();
  const [options, setOptions] = useState<string[]>([]);

  const line = cart.lines.find((l) => l.room_id === room.id);
  const qty = line?.qty ?? 0;
  const selectedOptions = room.options.filter((o) => options.includes(o.id));
  const optionTotal = selectedOptions.reduce((s, o) => s + o.price, 0);

  const add = () =>
    addRoom({
      hotel_id: hotel.id,
      hotel_name: hotel.name,
      room_id: room.id,
      room_name: room.name,
      price: room.price,
      options: selectedOptions,
    });

  return (
    <li
      className={cn(
        'grid grid-cols-1 gap-5 overflow-hidden rounded-xl border bg-white p-4 transition-colors sm:grid-cols-[180px_1fr]',
        'lg:grid-cols-[220px_1fr_190px]',
        qty > 0 ? 'border-brand-600 bg-brand-50/40 ring-1 ring-brand-600' : 'border-slate-200',
      )}
    >
      <RemoteImage
        photoId={room.photo_id}
        alt={`${hotel.name} ${room.name}`}
        width={440}
        height={330}
        sizes="220px"
        className="aspect-[4/3] w-full rounded-lg"
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          <h3 className="select-all text-base font-bold text-slate-900">{room.name}</h3>
          {/* 호텔명 + 객실명을 함께 복사시키면 워커의 호텔명 정규식에 확실히 걸린다. */}
          <CopyNameButton value={`${hotel.name} ${room.name}`} />
        </div>

        <p className="mt-1.5 text-xs text-slate-500">
          {room.size_m2}㎡ · {room.bed} · 기준 {room.capacity.standard}인 / 최대 {room.capacity.max}인 · {room.view}
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {room.breakfast && <Badge tone="emerald">조식 포함</Badge>}
          <Badge tone={room.refundable ? 'blue' : 'slate'}>{room.refundable ? '무료 취소' : '환불 불가'}</Badge>
          {room.remaining <= 3 && <Badge tone="rose">잔여 {room.remaining}실</Badge>}
        </div>

        {room.options.length > 0 && (
          <fieldset className="mt-3 space-y-1.5">
            <legend className="text-[11px] font-semibold text-slate-500">추가 옵션</legend>
            {room.options.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={options.includes(o.id)}
                  data-track="room_option"
                  data-label={o.label}
                  onChange={(e) =>
                    setOptions((prev) => (e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id)))
                  }
                  className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {o.label}
                <span className="tabular-nums text-slate-400">+{won(o.price)}</span>
              </label>
            ))}
          </fieldset>
        )}
      </div>

      <div className="flex flex-row items-end justify-between gap-3 border-t border-slate-100 pt-4 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-end lg:justify-center lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <div className="text-right">
          {room.original_price && (
            <p className="text-xs tabular-nums text-slate-400 line-through">{won(room.original_price)}</p>
          )}
          <p className="text-lg font-bold tabular-nums text-slate-900">{won(room.price + optionTotal)}</p>
          <p className="text-[11px] text-slate-400">1박 · 세금 포함</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {qty > 0 ? (
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white">
              <StepButton onClick={() => setQty(room.id, qty - 1)} label="수량 감소">
                −
              </StepButton>
              <span className="w-7 text-center text-sm font-bold tabular-nums text-slate-900">{qty}</span>
              <StepButton onClick={() => setQty(room.id, qty + 1)} label="수량 증가">
                +
              </StepButton>
            </div>
          ) : (
            <Button variant="outline" size="sm" data-track="room_add_cart" data-hotel-id={hotel.id} onClick={add}>
              장바구니 담기
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function StepButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      data-track="room_qty"
      onClick={onClick}
      className="h-8 w-8 text-base font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </button>
  );
}
