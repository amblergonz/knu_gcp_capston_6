'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from '@/components/icons';
import { CopyNameButton } from '@/components/ui/CopyNameButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { won, shortDate, nights } from '@/lib/format';
import type { CartLine } from '@/lib/cart';

interface Booking {
  booking_id: string;
  lines: CartLine[];
  checkin: string;
  checkout: string;
  guests: number;
  payment: string;
  total: number;
  coupon: string | null;
}

const PAYMENT_LABEL: Record<string, string> = {
  card: '신용카드',
  transfer: '계좌이체',
  easy: '간편결제',
};

export function SuccessCard() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = sessionStorage.getItem('hover_demo_booking');
      if (raw) setBooking(JSON.parse(raw) as Booking);
    } catch {
      /* noop */
    }
  }, []);

  if (!mounted) return <div className="h-96 rounded-2xl border border-slate-200 bg-white" />;

  if (!booking) {
    return (
      <EmptyState
        title="예약 내역이 없습니다"
        description="예약을 완료하면 이 화면에서 확인할 수 있습니다."
        action={
          <Link
            href="/search"
            className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white"
          >
            숙소 둘러보기
          </Link>
        }
      />
    );
  }

  const line = booking.lines[0];
  const n = nights(booking.checkin, booking.checkout);
  // 호텔명이 들어간 한 덩어리 — "일행에게 공유" 라는 자연스러운 복사 동기를 만든다.
  const summary = line
    ? `${line.hotel_name} / ${line.room_name} / ${booking.checkin} ~ ${booking.checkout} / ${n}박`
    : '';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-600 text-white">
          <CheckIcon size={32} />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">예약이 확정되었습니다</h1>
        <p className="mt-1.5 text-sm text-slate-500">예약 확인 메일을 보내드렸습니다</p>

        <div className="mt-6 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <span className="text-xs text-slate-500">예약 번호</span>
          <span className="flex items-center gap-1">
            <span className="font-mono text-sm font-bold text-slate-900">{booking.booking_id}</span>
            <CopyNameButton value={booking.booking_id} label="복사" />
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">예약 상세</h2>
          <CopyNameButton value={summary} label="예약 정보 복사" />
        </div>

        <dl className="divide-y divide-slate-100 text-sm">
          <Row k="숙소" v={line?.hotel_name ?? '-'} selectable />
          <Row k="객실" v={line ? `${line.room_name} × ${line.qty}실` : '-'} selectable />
          <Row k="체크인" v={`${shortDate(booking.checkin)} 15:00`} />
          <Row k="체크아웃" v={`${shortDate(booking.checkout)} 11:00`} />
          <Row k="인원" v={`성인 ${booking.guests}명 · ${n}박`} />
          <Row k="결제 수단" v={PAYMENT_LABEL[booking.payment] ?? booking.payment} />
          {booking.coupon && <Row k="적용 쿠폰" v={booking.coupon} />}
          <div className="flex items-center justify-between py-3">
            <dt className="font-bold text-slate-900">결제 금액</dt>
            <dd className="text-lg font-bold tabular-nums text-rose-600">{won(booking.total)}</dd>
          </div>
        </dl>
      </div>

      <details className="group rounded-2xl border border-slate-200 bg-white px-6 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800 marker:hidden">
          취소 · 환불 규정
          <ChevronDownIcon size={16} className="text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <p className="prose-ko mt-3 text-sm leading-relaxed text-slate-600">
          체크인 3일 전까지 무료 취소가 가능합니다. 이후 취소 시 첫 1박 요금이 부과되며, 노쇼의 경우 전액이 부과됩니다.
        </p>
      </details>

      <div className="flex gap-3">
        <Link
          href="/"
          data-track="confirmation_home"
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          홈으로
        </Link>
        <Link
          href="/search"
          data-track="confirmation_more"
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          다른 숙소 둘러보기
        </Link>
      </div>
    </div>
  );
}

function Row({ k, v, selectable }: { k: string; v: string; selectable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="shrink-0 text-slate-500">{k}</dt>
      <dd className={selectable ? 'select-all truncate font-semibold text-slate-900' : 'truncate text-slate-700'}>{v}</dd>
    </div>
  );
}
