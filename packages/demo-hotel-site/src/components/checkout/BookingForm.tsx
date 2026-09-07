'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { InfoIcon } from '@/components/icons';
import { cartTotal, clearCart, hydrateCart, useCart } from '@/lib/cart';
import { won, nights } from '@/lib/format';
import { cn } from '@/lib/cn';

const PAYMENTS = [
  { id: 'card', label: '신용카드' },
  { id: 'transfer', label: '계좌이체' },
  { id: 'easy', label: '간편결제' },
];

const REQUESTS = ['금연실 요청', '고층 요청', '늦은 체크인 (22시 이후)', '트윈 베드 요청'];

export function BookingForm() {
  const router = useRouter();
  const cart = useCart();
  const [mounted, setMounted] = useState(false);
  const [payment, setPayment] = useState('card');
  const [sameAsBooker, setSameAsBooker] = useState(true);
  const [agreeAll, setAgreeAll] = useState(false);
  const [agree, setAgree] = useState([false, false, false]);
  const [request, setRequest] = useState('');

  useEffect(() => {
    hydrateCart();
    setMounted(true);
  }, []);

  const canSubmit = mounted && cart.lines.length > 0 && agree.every(Boolean);
  const n = mounted ? nights(cart.checkin, cart.checkout) : 1;
  const total = mounted ? cartTotal(cart, n) * (1 - cart.couponPercent / 100) : 0;

  const toggleAll = (v: boolean) => {
    setAgreeAll(v);
    setAgree([v, v, v]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const bookingId = `HS${Date.now().toString(36).toUpperCase()}`;
    try {
      sessionStorage.setItem(
        'hover_demo_booking',
        JSON.stringify({
          booking_id: bookingId,
          lines: cart.lines,
          checkin: cart.checkin,
          checkout: cart.checkout,
          guests: cart.guests,
          payment,
          total: Math.round(total),
          coupon: cart.coupon,
        }),
      );
    } catch {
      /* noop */
    }
    clearCart();
    router.push('/confirmation');
  };

  return (
    <form onSubmit={submit} data-form="checkout" className="min-w-0 space-y-5">
      <Card title="예약자 정보">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="이름 (한글)" field="booker_name" placeholder="홍길동" required />
          <Input label="영문 이름 (여권과 동일)" field="booker_name_en" placeholder="HONG GILDONG" />
          <Input label="휴대폰" field="phone" type="tel" placeholder="010-0000-0000" required />
          <Input label="이메일" field="email" type="email" placeholder="you@example.com" required />
        </div>
      </Card>

      <Card title="투숙객 정보">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={sameAsBooker}
            data-track="same_as_booker"
            onChange={(e) => setSameAsBooker(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          예약자와 동일
        </label>
        {!sameAsBooker && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="투숙객 이름" field="guest_name" placeholder="홍길동" />
            <Input label="투숙객 연락처" field="guest_phone" type="tel" placeholder="010-0000-0000" />
          </div>
        )}
      </Card>

      <Card title="요청사항">
        <div className="flex flex-wrap gap-2">
          {REQUESTS.map((r) => (
            <button
              key={r}
              type="button"
              data-track="request_chip"
              data-label={r}
              onClick={() => setRequest((prev) => (prev ? `${prev}, ${r}` : r))}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={request}
          data-field="request"
          onChange={(e) => setRequest(e.target.value)}
          rows={3}
          placeholder="숙소에 전달할 요청사항을 적어주세요. 요청은 숙소 사정에 따라 반영되지 않을 수 있습니다."
          className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </Card>

      <Card title="결제 수단">
        <div className="grid grid-cols-3 gap-3">
          {PAYMENTS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-track="payment_method"
              data-label={p.label}
              onClick={() => setPayment(p.id)}
              className={cn(
                'rounded-lg border px-3 py-3 text-sm font-semibold transition-colors',
                payment === p.id
                  ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {payment === 'card' && (
          <div className="mt-4 space-y-4">
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">카드 번호</span>
              <div className="grid grid-cols-4 gap-2">
                {['card1', 'card2', 'card3', 'card4'].map((f) => (
                  <input
                    key={f}
                    data-field={f}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    className="h-10 rounded-lg border border-slate-200 px-3 text-center text-sm tabular-nums outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="유효기간 (MM/YY)" field="card_expiry" placeholder="12/28" />
              <Input label="생년월일 6자리" field="card_birth" placeholder="990101" />
            </div>
          </div>
        )}

        <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          <InfoIcon size={15} className="mt-px shrink-0" />
          데모 사이트입니다. 실제 결제가 이루어지지 않으며 입력하신 정보는 어디에도 전송되지 않습니다.
        </p>
      </Card>

      <Card title="약관 동의">
        <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">
          <input
            type="checkbox"
            checked={agreeAll}
            data-track="agree_all"
            onChange={(e) => toggleAll(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          전체 동의
        </label>
        <div className="mt-3 space-y-2">
          {['숙소 이용약관 (필수)', '개인정보 수집·이용 동의 (필수)', '취소·환불 규정 확인 (필수)'].map((t, i) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={agree[i]}
                data-track="agree_item"
                data-label={t}
                onChange={(e) => {
                  const next = agree.slice();
                  next[i] = e.target.checked;
                  setAgree(next);
                  setAgreeAll(next.every(Boolean));
                }}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              {t}
            </label>
          ))}
        </div>
      </Card>

      <Button type="submit" size="lg" disabled={!canSubmit} data-track="submit_booking" className="h-14 w-full text-base">
        {mounted && cart.lines.length === 0 ? '선택한 객실이 없습니다' : `${won(Math.round(total))} 결제하기`}
      </Button>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-base font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Input({
  label,
  field,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  field: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {/*
        data-field 가 form_field 이벤트의 트리거다.
        체류 시간·수정 여부·길이만 보내고 값은 절대 전송하지 않는다.
      */}
      <input
        type={type}
        data-field={field}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
