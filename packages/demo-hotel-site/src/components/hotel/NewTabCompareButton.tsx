'use client';

import { ExternalLinkIcon } from '@/components/icons';

// 같은 데모 사이트를 새 탭으로 연다.
// 외부 사이트는 BroadcastChannel 을 공유하지 않으므로, 멀티탭 부스터(+0.4)를
// 만들려면 반드시 이쪽 오리진의 두 번째 탭이어야 한다.
// "여러 숙소를 새 탭에 띄워 비교" 는 실제 예약 행동이기도 하다.
export function NewTabCompareButton({ hotelId }: { hotelId: string }) {
  return (
    <button
      type="button"
      data-track="new_tab_compare"
      data-hotel-id={hotelId}
      onClick={() => window.open(`/hotel/${hotelId}?src=compare`, '_blank', 'noopener')}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-brand-600 bg-white px-4 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
    >
      새 탭에서 비교하기
      <ExternalLinkIcon size={14} />
    </button>
  );
}
