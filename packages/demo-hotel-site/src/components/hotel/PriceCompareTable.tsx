import type { Hotel } from '@/lib/hotels';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { NewTabCompareButton } from './NewTabCompareButton';
import { ExternalLinkIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { won } from '@/lib/format';

// 가격 비교 표는 두 가지 신호를 자연스럽게 만든다.
// - 경쟁사 링크 → external_link (새 탭이라 세션이 살아 있다)
// - "새 탭에서 비교하기" → 같은 데모 사이트를 새 탭으로 열어 broadcast_channel
//   (외부 사이트는 BroadcastChannel 을 공유하지 않으므로 멀티탭 부스터에는 쓸 수 없다)
export function PriceCompareTable({ hotel }: { hotel: Hotel }) {
  const rows = [
    ...hotel.competitors.map((c) => ({ site: c.site, price: c.price, url: c.url, ours: false })),
    { site: 'hover stay', price: hotel.base_price, url: '', ours: true },
  ].sort((a, b) => a.price - b.price);

  return (
    <section id="price-compare" className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">다른 사이트 가격 비교</h2>
          <p className="mt-1 text-sm text-slate-500">동일 객실 기준 1박 요금입니다. 사이트별로 가격이 다릅니다.</p>
        </div>
        <NewTabCompareButton hotelId={hotel.id} />
      </div>

      <ul className="mt-5 divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.site} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
            <span className="flex items-center gap-2">
              <span className={r.ours ? 'text-sm font-bold text-slate-900' : 'text-sm text-slate-700'}>{r.site}</span>
              {r.price === rows[0].price && <Badge tone="rose">최저가</Badge>}
            </span>

            <span className="flex items-center gap-4">
              <span
                className={
                  r.ours
                    ? 'text-base font-bold tabular-nums text-rose-600'
                    : 'text-base tabular-nums text-slate-600'
                }
              >
                {won(r.price)}
              </span>
              {r.ours ? (
                <span className="text-right text-xs font-semibold text-slate-400 sm:w-[112px]">현재 보는 중</span>
              ) : (
                <ExternalLink
                  href={r.url}
                  label={r.site}
                  className="justify-end text-xs font-semibold text-brand-600 hover:underline sm:w-[112px]"
                >
                  <span className="hidden sm:inline">사이트에서 </span>보기
                  <ExternalLinkIcon size={13} />
                </ExternalLink>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
