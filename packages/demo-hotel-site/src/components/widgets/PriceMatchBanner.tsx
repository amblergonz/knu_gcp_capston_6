'use client';

import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '@/components/icons';
import type { DecisionPayload } from '@/lib/tracker/types';

const AUTO_DISMISS_MS = 12000;

export function PriceMatchBanner({
  decision,
  onDismiss,
  onCta,
}: {
  decision: DecisionPayload;
  onDismiss: (reason: string) => void;
  onCta: () => void;
}) {
  const { copy, context } = decision;
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paused) {
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    timer.current = setTimeout(() => onDismiss('ttl'), AUTO_DISMISS_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [paused, onDismiss]);

  // context.hotel_name 은 사용자가 복사한 원문 그대로다 (최대 80자).
  // truncate 없이 넣으면 상단 줄이 통째로 터진다. 없으면 칩 자체를 생략한다.
  const hotelName = context.hotel_name?.trim();

  return (
    <div data-hover-ignore className="pointer-events-none fixed inset-x-0 top-0 z-banner flex justify-center px-4 pt-3">
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="pointer-events-auto relative flex w-full max-w-xl animate-slide-down overflow-hidden rounded-xl bg-white shadow-widget ring-1 ring-brand-100"
      >
        <span className="w-1 shrink-0 bg-gradient-to-b from-brand-600 to-sky-500" />

        <div className="min-w-0 flex-1 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              {hotelName ? '가격 비교' : '최저가 확인'}
            </span>
            {hotelName && (
              <strong className="max-w-[18ch] truncate text-xs font-semibold text-slate-700">{hotelName}</strong>
            )}
            <span className="ml-auto shrink-0 text-[10px] text-slate-300">{decision.copy_source}</span>
          </div>

          <p className="prose-ko mt-1 line-clamp-1 text-sm font-bold text-slate-900">{copy.title}</p>
          {/* Gemini 문구는 실측 43자까지 나온다. 2줄을 허용한다. */}
          <p className="prose-ko line-clamp-2 text-xs leading-relaxed text-slate-600">{copy.body}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 pr-3">
          <button
            type="button"
            onClick={onCta}
            className="max-w-[12rem] truncate rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-700"
          >
            {copy.cta}
          </button>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => onDismiss('close')}
            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        {/* 자동 해제까지 남은 시간. 호버하면 타이머와 함께 멈춘다. */}
        <span
          className="absolute bottom-0 left-0 h-0.5 w-full origin-left animate-shrink-x bg-brand-500"
          style={paused ? { animationPlayState: 'paused' } : undefined}
        />
      </div>
    </div>
  );
}
