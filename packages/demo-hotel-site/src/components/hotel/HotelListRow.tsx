import Link from 'next/link';
import type { Hotel } from '@/lib/hotels';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { WishlistButton } from '@/components/ui/WishlistButton';
import { CopyNameButton } from '@/components/ui/CopyNameButton';
import { StarRating } from './StarRating';
import { ScorePill } from './ScorePill';
import { AmenityList } from './AmenityList';
import { Badge } from '@/components/ui/Badge';
import { MapPinIcon } from '@/components/icons';
import { won, num } from '@/lib/format';

// 검색 결과의 주력 컴포넌트. 이미지 / 정보 / 가격 3열.
export function HotelListRow({ hotel }: { hotel: Hotel }) {
  const minRemaining = Math.min(...hotel.rooms.map((r) => r.remaining));
  const discounted = hotel.original_price > hotel.base_price;

  return (
    <li className="group grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-shadow hover:shadow-md sm:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr_200px]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
        <Link href={`/hotel/${hotel.id}`} data-track="hotel_row_image" data-hotel-id={hotel.id}>
          <RemoteImage
            photoId={hotel.images[0].photo_id}
            alt={hotel.name}
            width={480}
            height={360}
            sizes="240px"
            className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
        <div className="absolute right-2 top-2">
          <WishlistButton hotelId={hotel.id} hotelName={hotel.name} source="search_row" />
        </div>
        <span className="absolute bottom-2 left-2 rounded bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          사진 {hotel.images.length}장
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StarRating star={hotel.star} size={13} />
          <span className="text-xs text-slate-400">{hotel.category}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          <Link href={`/hotel/${hotel.id}`} data-track="hotel_row_title" data-hotel-id={hotel.id}>
            <h3 className="prose-ko select-all text-lg font-bold leading-snug text-slate-900 hover:text-brand-700">
              {hotel.name}
            </h3>
          </Link>
          <CopyNameButton value={hotel.name} />
        </div>

        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <MapPinIcon size={13} className="shrink-0 text-slate-400" />
          {hotel.address}
        </p>

        <p className="prose-ko mt-2.5 line-clamp-2 text-sm leading-relaxed text-slate-600">{hotel.description}</p>

        <AmenityList ids={hotel.amenities} limit={5} className="mt-3" />
      </div>

      <div className="flex flex-row items-end justify-between gap-3 border-t border-slate-100 pt-4 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-end lg:justify-between lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <div className="flex items-center gap-2 lg:flex-col lg:items-end lg:gap-1">
          <ScorePill score={hotel.rating} showLabel />
          <span className="text-[11px] text-slate-500">리뷰 {num(hotel.review_count)}개</span>
        </div>

        <div className="text-right">
          {minRemaining <= 3 && (
            <Badge tone="rose" className="mb-1.5">
              잔여 {minRemaining}실
            </Badge>
          )}
          {discounted && (
            <p className="text-xs tabular-nums text-slate-400 line-through">{won(hotel.original_price)}</p>
          )}
          <p className="text-xl font-bold tabular-nums text-rose-600">{won(hotel.base_price)}</p>
          <p className="text-[11px] text-slate-400">1박 · 세금 포함</p>
          <Link
            href={`/rooms?hotel=${hotel.id}`}
            data-track="hotel_row_cta"
            data-hotel-id={hotel.id}
            className="mt-2.5 inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            객실 보기
          </Link>
        </div>
      </div>
    </li>
  );
}
