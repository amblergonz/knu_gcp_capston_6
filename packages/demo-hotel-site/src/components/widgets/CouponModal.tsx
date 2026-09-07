'use client';

import { useEffect, useRef } from 'react';
import { CloseIcon } from '@/components/icons';
import type { DecisionPayload } from '@/lib/tracker/types';

export function CouponModal({
  decision,
  onDismiss,
  onCta,
}: {
  decision: DecisionPayload;
  onDismiss: (reason: string) => void;
  onCta: () => void;
}) {
  const ctaRef = useRef<HTMLButtonElement>(null);
  const { copy, context } = decision;

  useEffect(() => {
    ctaRef.current?.focus();
    document.documentElement.classList.add('overflow-hidden');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss('esc');
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('overflow-hidden');
      window.removeEventListener('keydown', onKey);
    };
  }, [onDismiss]);

  // 숙소명: 서버가 준 값(복사한 원문) → 없으면 아예 생략한다.
  // S1 은 보통 클립보드 복사 없이 발화하므로 hotel_name 이 없는 게 정상이다.
  const hotelName = context.hotel_name?.trim();

  return (
    <div data-hover-ignore>
      <div
        className="fixed inset-0 z-backdrop animate-fade-in bg-slate-900/50 backdrop-blur-[2px]"
        onClick={() => onDismiss('backdrop')}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-title"
        className="fixed left-1/2 top-1/2 z-modal w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 animate-pop-in overflow-hidden rounded-2xl bg-white shadow-widget"
      >
        {/* 할인율을 큰 타이포로 쓰는 것 자체가 그래픽이다. 일러스트도 이모지도 필요 없다. */}
        <div className="relative bg-gradient-to-br from-brand-600 to-sky-500 px-6 py-5 text-white">
          <button
            type="button"
            aria-label="닫기"
            onClick={() => onDismiss('close')}
            className="absolute right-3 top-3 rounded-full bg-white/15 p-1.5 transition-colors hover:bg-white/25"
          >
            <CloseIcon size={16} />
          </button>

          {typeof context.discount_percent === 'number' ? (
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold leading-none tabular-nums">{context.discount_percent}</span>
              <span className="pb-1 text-2xl font-bold">%</span>
              <span className="pb-1.5 text-xs text-brand-100">추가 할인 쿠폰</span>
            </div>
          ) : (
            <p className="text-2xl font-bold">특별 혜택</p>
          )}
        </div>

        <div className="px-6 pb-6 pt-5">
          <h2 id="coupon-title" className="prose-ko line-clamp-2 text-xl font-bold text-slate-900">
            {copy.title}
          </h2>
          <p className="prose-ko mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{copy.body}</p>

          {hotelName && (
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">선택하신 숙소</p>
              <p className="prose-ko mt-1 line-clamp-2 text-sm font-semibold text-slate-800">{hotelName}</p>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => onDismiss('later')}
              className="shrink-0 rounded-lg px-4 py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100"
            >
              나중에 할게요
            </button>
            {/* flex-1 + min-w-0 + truncate: 24자 CTA 도 줄바꿈 없이, 닫기 버튼을 밀어내지 않는다 */}
            <button
              ref={ctaRef}
              type="button"
              onClick={onCta}
              className="min-w-0 flex-1 rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700"
            >
              <span className="block truncate">{copy.cta}</span>
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-400">
            쿠폰은 {Math.round(decision.ttl_seconds / 60)}분 후 만료됩니다
            <span className="ml-1.5 text-slate-300">· {decision.copy_source}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
