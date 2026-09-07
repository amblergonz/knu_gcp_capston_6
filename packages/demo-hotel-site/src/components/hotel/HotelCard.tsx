import Link from 'next/link';
import type { Hotel } from '@/lib/hotels';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { WishlistButton } from '@/components/ui/WishlistButton';
import { StarRating } from './StarRating';
import { ScorePill } from './ScorePill';
import { won, num } from '@/lib/format';

// 그리드형 카드 (홈). 인터랙티브한 부분은 WishlistButton 하나뿐이라
// 카드 자체는 서버 컴포넌트로 남는다.
export function HotelCard({ hotel, showDiscount = false }: { hotel: Hotel; showDiscount?: boolean }) {
  return (
    <Link
      href={`/hotel/${hotel.id}`}
      data-track="hotel_card"
      data-hotel-id={hotel.id}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <RemoteImage
          photoId={hotel.images[0].photo_id}
          alt={hotel.name}
          width={480}
          height={360}
          sizes="(max-width: 768px) 100vw, 300px"
          className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute right-2.5 top-2.5">
          <WishlistButton hotelId={hotel.id} hotelName={hotel.name} source="home_card" />
        </div>
        {showDiscount && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-bold text-white">
            할인 -{hotel.discount_percent}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <StarRating star={hotel.star} size={12} />
          <span className="text-[11px] text-slate-400">{hotel.category}</span>
        </div>

        {/* 숙소명은 선택 가능한 일반 텍스트여야 한다. 버튼으로 감싸면 Ctrl+C 가 빈 선택이 된다. */}
        <h3 className="prose-ko mt-1.5 select-all text-base font-bold leading-snug text-slate-900">
          {hotel.name}
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          {hotel.region} {hotel.district}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <ScorePill score={hotel.rating} size="sm" />
          <span className="text-[11px] text-slate-500">리뷰 {num(hotel.review_count)}개</span>
        </div>

        <div className="mt-auto pt-4 text-right">
          {showDiscount && (
            <p className="text-xs tabular-nums text-slate-400 line-through">{won(hotel.original_price)}</p>
          )}
          <p className="text-lg font-bold tabular-nums text-slate-900">{won(hotel.base_price)}</p>
          <p className="text-[11px] text-slate-400">1박 · 세금 포함</p>
        </div>
      </div>
    </Link>
  );
}
