import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { CopyNameButton } from '@/components/ui/CopyNameButton';
import { StarRating } from '@/components/hotel/StarRating';
import { ScorePill } from '@/components/hotel/ScorePill';
import { AmenityList } from '@/components/hotel/AmenityList';
import { ReviewSummary } from '@/components/hotel/ReviewSummary';
import { ReviewList } from '@/components/hotel/ReviewList';
import { PriceCompareTable } from '@/components/hotel/PriceCompareTable';
import { BookingSidebar } from '@/components/hotel/BookingSidebar';
import { MobileBookingBar } from '@/components/hotel/MobileBookingBar';
import { Badge } from '@/components/ui/Badge';
import { MapPinIcon, ChevronDownIcon, ChevronRightIcon } from '@/components/icons';
import { allHotels, getHotel, getReviews } from '@/lib/hotels';
import { won, num } from '@/lib/format';

export function generateStaticParams() {
  return allHotels().map((h) => ({ id: h.id }));
}

// Next 15 에서 params 는 Promise 다.
export default async function HotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hotel = getHotel(id);
  if (!hotel) notFound();

  const reviews = getReviews(hotel.id);
  const [hero, ...thumbs] = hotel.images;

  return (
    <div className="bg-slate-50 pb-28 lg:pb-16">
      <Container className="pt-6">
        <nav className="flex items-center gap-1 text-xs text-slate-500">
          <Link href="/" className="hover:text-brand-600">
            홈
          </Link>
          <ChevronRightIcon size={12} className="text-slate-300" />
          <Link href={`/search?region=${encodeURIComponent(hotel.region)}`} className="hover:text-brand-600">
            {hotel.region}
          </Link>
          <ChevronRightIcon size={12} className="text-slate-300" />
          <span className="text-slate-700">{hotel.name}</span>
        </nav>

        <div className="mt-4 grid h-[240px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl sm:h-[340px] lg:h-[420px]">
          <div className="col-span-4 row-span-2 sm:col-span-2">
            <RemoteImage
              photoId={hero.photo_id}
              alt={hero.alt}
              width={900}
              height={840}
              sizes="(max-width: 640px) 100vw, 50vw"
              className="h-full w-full"
            />
          </div>
          {thumbs.slice(0, 4).map((img) => (
            <div key={img.photo_id} className="hidden sm:block">
              <RemoteImage photoId={img.photo_id} alt={img.alt} width={450} height={420} sizes="25vw" className="h-full w-full" />
            </div>
          ))}
        </div>
      </Container>

      <Container className="grid grid-cols-1 gap-10 pt-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <section>
            <div className="flex flex-wrap items-center gap-2">
              <StarRating star={hotel.star} />
              <Badge tone="blue">{hotel.category}</Badge>
            </div>

            {/*
              select-all 이 S2 시나리오의 장치다.
              클릭 한 번으로 호텔명 전체가 선택되고, Ctrl+C 하면 워커의 호텔명 정규식에 걸린다.
              버튼으로 감싸거나 select-none 을 주면 빈 선택이 되어 S2 가 영영 안 뜬다.
            */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="prose-ko select-all text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                {hotel.name}
              </h1>
              <CopyNameButton value={hotel.name} />
            </div>

            <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPinIcon size={15} className="text-slate-400" />
              {hotel.address}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <ScorePill score={hotel.rating} showLabel />
              <a href="#reviews" data-track="jump_reviews" className="text-xs text-brand-600 hover:underline">
                리뷰 {num(hotel.review_count)}개 보기
              </a>
            </div>

            <p className="prose-ko mt-5 text-sm leading-relaxed text-slate-600">{hotel.description}</p>

            <ul className="mt-4 space-y-1.5">
              {hotel.highlights.map((h) => (
                <li key={h} className="prose-ko flex gap-2 text-sm text-slate-600">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  {h}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">편의시설</h2>
            <AmenityList ids={hotel.amenities} className="mt-3" />
          </section>

          <section>
            <div className="flex items-end justify-between">
              <h2 className="text-lg font-bold text-slate-900">객실 안내</h2>
              <Link
                href={`/rooms?hotel=${hotel.id}`}
                data-track="detail_all_rooms"
                className="text-sm font-semibold text-brand-600 hover:underline"
              >
                객실 전체 보기
              </Link>
            </div>

            <ul className="mt-4 space-y-3">
              {hotel.rooms.slice(0, 3).map((room) => (
                <li
                  key={room.id}
                  className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[160px_1fr_auto]"
                >
                  <RemoteImage
                    photoId={room.photo_id}
                    alt={room.name}
                    width={320}
                    height={240}
                    sizes="160px"
                    className="h-28 w-full rounded-lg sm:h-full"
                  />
                  <div className="min-w-0">
                    <h3 className="select-all text-base font-bold text-slate-900">{room.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {room.size_m2}㎡ · {room.bed} · 기준 {room.capacity.standard}인 · {room.view}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {room.breakfast && <Badge tone="emerald">조식 포함</Badge>}
                      <Badge tone={room.refundable ? 'blue' : 'slate'}>
                        {room.refundable ? '무료 취소' : '환불 불가'}
                      </Badge>
                      {room.remaining <= 3 && <Badge tone="rose">잔여 {room.remaining}실</Badge>}
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                    <div className="text-right">
                      {room.original_price && (
                        <p className="text-xs tabular-nums text-slate-400 line-through">{won(room.original_price)}</p>
                      )}
                      <p className="text-lg font-bold tabular-nums text-slate-900">{won(room.price)}</p>
                    </div>
                    <Link
                      href={`/rooms?hotel=${hotel.id}`}
                      data-track="detail_room_cta"
                      data-hotel-id={hotel.id}
                      className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
                    >
                      이 객실 선택
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">위치</h2>
            <div className="mt-3 grid place-items-center rounded-xl border border-slate-200 bg-gradient-to-br from-sky-100 to-brand-50 py-14">
              <MapPinIcon size={28} className="text-brand-500" />
              <p className="mt-2 text-sm font-semibold text-slate-700">{hotel.address}</p>
              <p className="text-xs text-slate-500">지도는 데모에서 제공되지 않습니다</p>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {hotel.nearby.map((n) => (
                <li
                  key={n.name}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm"
                >
                  <span className="text-slate-700">{n.name}</span>
                  <span className="tabular-nums text-slate-500">
                    {n.distance_m >= 1000 ? `${(n.distance_m / 1000).toFixed(1)}km` : `${n.distance_m}m`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <PriceCompareTable hotel={hotel} />

          <section id="reviews">
            <h2 className="text-lg font-bold text-slate-900">리뷰</h2>
            <div className="mt-3">
              <ReviewSummary rating={hotel.rating} reviewCount={hotel.review_count} reviews={reviews} />
            </div>
            <ReviewList reviews={reviews} />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">이용 안내</h2>
            <Accordion title="체크인 · 체크아웃">
              체크인 {hotel.policy.checkin} 이후, 체크아웃 {hotel.policy.checkout} 까지입니다.
            </Accordion>
            <Accordion title="취소 · 환불 규정">{hotel.policy.cancel}</Accordion>
            <Accordion title="아동 투숙">{hotel.policy.children}</Accordion>
          </section>
        </div>

        <div className="hidden lg:block">
          <BookingSidebar hotel={hotel} />
        </div>
      </Container>

      <MobileBookingBar hotel={hotel} />
    </div>
  );
}

// native <details> — JS 없이 동작한다.
function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800 marker:hidden">
        {title}
        <ChevronDownIcon size={16} className="text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <p className="prose-ko mt-3 text-sm leading-relaxed text-slate-600">{children}</p>
    </details>
  );
}
