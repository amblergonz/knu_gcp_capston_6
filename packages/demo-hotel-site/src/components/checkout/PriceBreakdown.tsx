'use client';

import { useEffect, useState } from 'react';
import { applyCoupon, cartTotal, clearCoupon, hydrateCart, useCart } from '@/lib/cart';
import { CheckIcon } from '@/components/icons';
import { won, nights, shortDate } from '@/lib/format';
import { cn } from '@/lib/cn';

// S1 쿠폰 모달의 CTA 가 여기로 착지한다.
// 위젯이 hover:apply-coupon 커스텀 이벤트를 쏘면 코드가 채워지고 실제로 할인이 적용된다.
export const COUPON_EVENT = 'hover:apply-coupon';

// 워커의 discountFor 가 만들어내는 코드들. 손으로 입력해도 동작해야 한다.
const COUPON_CODES: Record<string, number> = {
  HOVER5: 5,
  HOVER10: 10,
  HOVER15: 15,
};

export function PriceBreakdown() {
  const cart = useCart();
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState('');
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    hydrateCart();
    setMounted(true);
  }, []);

  useEffect(() => {
    const onApply = (e: Event) => {
      const detail = (e as CustomEvent<{ code: string; percent: number }>).detail;
      if (!detail) return;
      setCode(detail.code);
      applyCoupon(detail.code, detail.percent);
      setError('');
      setFlash(true);
      window.setTimeout(() => setFlash(false), 2200);
    };
    window.addEventListener(COUPON_EVENT, onApply);
    return () => window.removeEventListener(COUPON_EVENT, onApply);
  }, []);

  const n = mounted ? nights(cart.checkin, cart.checkout) : 1;
  const rooms = mounted ? cartTotal(cart, n) : 0;
  const optionTotal = mounted
    ? cart.lines.reduce((s, l) => s + l.options.reduce((o, x) => o + x.price, 0) * l.qty, 0)
    : 0;
  const discount = Math.round((rooms * (mounted ? cart.couponPercent : 0)) / 100);
  const total = rooms - discount;

  const submitCoupon = () => {
    const c = code.trim().toUpperCase();
    if (COUPON_CODES[c] !== undefined) {
      applyCoupon(c, COUPON_CODES[c]);
      setError('');
    } else if (c === '') {
      clearCoupon();
      setError('');
    } else {
      setError('사용할 수 없는 쿠폰 코드입니다');
    }
  };

  return (
    <aside className="lg:sticky lg:top-[96px] lg:self-start">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-base font-bold text-slate-900">결제 내역</h2>

        {mounted && cart.lines.length > 0 && (
          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
            {/* 망설임이 가장 큰 지점에 또 한 번의 복사 기회를 둔다 */}
            <p className="select-all text-sm font-semibold text-slate-900">{cart.lines[0].hotel_name}</p>
            <p className="select-all mt-0.5 text-xs text-slate-500">{cart.lines[0].room_name}</p>
            <p className="mt-2 text-xs tabular-nums text-slate-500">
              {shortDate(cart.checkin)} – {shortDate(cart.checkout)} · {n}박 · 성인 {cart.guests}명
            </p>
          </div>
        )}

        <dl className="mt-4 space-y-2 text-sm">
          <Row k={`객실 요금 (${n}박)`} v={won(rooms - optionTotal)} />
          {optionTotal > 0 && <Row k="추가 옵션" v={won(optionTotal)} />}
          <Row k="세금·봉사료" v="포함" muted />
          {discount > 0 && (
            <div className="flex items-center justify-between text-rose-600">
              <dt className="font-semibold">쿠폰 할인 ({cart.couponPercent}%)</dt>
              <dd className="font-semibold tabular-nums">−{won(discount)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">쿠폰 코드</label>
          <div className="flex gap-2">
            <input
              value={code}
              data-field="coupon"
              placeholder="쿠폰 코드 입력"
              onChange={(e) => setCode(e.target.value)}
              className={cn(
                'h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none transition-shadow',
                flash
                  ? 'border-brand-500 ring-2 ring-brand-500'
                  : 'border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
              )}
            />
            <button
              type="button"
              data-track="coupon_apply"
              onClick={submitCoupon}
              className="h-10 shrink-0 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              적용
            </button>
          </div>
          {error && <p className="mt-1.5 text-[11px] text-rose-600">{error}</p>}
          {mounted && cart.coupon && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <CheckIcon size={12} />
              {cart.coupon} 적용됨
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-sm font-bold text-slate-900">총 결제금액</span>
          <span className="text-2xl font-bold tabular-nums text-rose-600">{won(total)}</span>
        </div>
      </div>
    </aside>
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
