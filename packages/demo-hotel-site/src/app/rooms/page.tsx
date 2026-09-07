import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { CopyNameButton } from '@/components/ui/CopyNameButton';
import { StarRating } from '@/components/hotel/StarRating';
import { RoomCard } from '@/components/room/RoomCard';
import { CartSummary } from '@/components/room/CartSummary';
import { EmptyState } from '@/components/ui/EmptyState';
import { allHotels, getHotel } from '@/lib/hotels';

type SP = Record<string, string | string[] | undefined>;

export default async function RoomsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const hotelId = typeof sp.hotel === 'string' ? sp.hotel : allHotels()[0].id;
  const hotel = getHotel(hotelId);

  if (!hotel) {
    return (
      <Container className="py-16">
        <EmptyState
          title="숙소를 찾을 수 없습니다"
          description="검색 결과에서 다시 선택해 주세요."
          action={
            <Link
              href="/search"
              className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white"
            >
              숙소 검색하기
            </Link>
          }
        />
      </Container>
    );
  }

  return (
    <div className="bg-sky-50 pb-16">
      <div className="border-b border-slate-200 bg-white lg:sticky lg:top-header lg:z-sticky">
        <Container className="flex items-center gap-4 py-3">
          <RemoteImage
            photoId={hotel.images[0].photo_id}
            alt={hotel.name}
            width={128}
            height={128}
            sizes="64px"
            className="h-16 w-16 shrink-0 rounded-lg"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              <Link href={`/hotel/${hotel.id}`} data-track="rooms_hotel_link" data-hotel-id={hotel.id}>
                <h1 className="select-all truncate text-lg font-bold text-slate-900 hover:text-brand-700">
                  {hotel.name}
                </h1>
              </Link>
              <CopyNameButton value={hotel.name} />
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <StarRating star={hotel.star} size={12} />
              <span className="text-xs text-slate-500">
                {hotel.region} {hotel.district}
              </span>
            </div>
          </div>
        </Container>
      </div>

      <Container className="grid grid-cols-1 gap-8 py-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold text-slate-900">객실 선택</h2>
            <span className="text-sm text-slate-500">{hotel.rooms.length}개 객실 타입</span>
          </div>
          <ul className="flex flex-col gap-4">
            {hotel.rooms.map((room) => (
              <RoomCard key={room.id} hotel={hotel} room={room} />
            ))}
          </ul>
        </div>

        <CartSummary />
      </Container>
    </div>
  );
}
