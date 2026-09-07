import { HOTELS, REVIEWS, META, type Hotel, type Room, type Review } from '@/data/types';

export { META };
export type { Hotel, Room, Review };

export function allHotels(): Hotel[] {
  return HOTELS;
}

export function getHotel(id: string): Hotel | undefined {
  return HOTELS.find((h) => h.id === id);
}

export function getRoom(hotelId: string, roomId: string): Room | undefined {
  return getHotel(hotelId)?.rooms.find((r) => r.id === roomId);
}

export function getReviews(hotelId: string): Review[] {
  return REVIEWS[hotelId] ?? [];
}

export function amenityLabel(id: string): string {
  return META.amenities.find((a) => a.id === id)?.label ?? id;
}

export interface SearchFilters {
  q?: string;
  region?: string[];
  star?: number[];
  category?: string[];
  amenities?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: string;
}

export function searchHotels(f: SearchFilters): Hotel[] {
  let out = HOTELS.slice();

  if (f.q) {
    const q = f.q.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.name_en.toLowerCase().includes(q) ||
          h.region.includes(q) ||
          h.district.toLowerCase().includes(q),
      );
    }
  }
  if (f.region?.length) out = out.filter((h) => f.region!.includes(h.region));
  if (f.star?.length) out = out.filter((h) => f.star!.includes(h.star));
  if (f.category?.length) out = out.filter((h) => f.category!.includes(h.category));
  if (f.amenities?.length) out = out.filter((h) => f.amenities!.every((a) => h.amenities.includes(a)));
  if (typeof f.minPrice === 'number') out = out.filter((h) => h.base_price >= f.minPrice!);
  if (typeof f.maxPrice === 'number') out = out.filter((h) => h.base_price <= f.maxPrice!);
  if (typeof f.minRating === 'number') out = out.filter((h) => h.rating >= f.minRating!);

  switch (f.sort) {
    case 'price_asc':
      out.sort((a, b) => a.base_price - b.base_price);
      break;
    case 'price_desc':
      out.sort((a, b) => b.base_price - a.base_price);
      break;
    case 'rating':
      out.sort((a, b) => b.rating - a.rating);
      break;
    case 'reviews':
      out.sort((a, b) => b.review_count - a.review_count);
      break;
    default:
      // 추천순: 평점과 리뷰 수를 함께 본다.
      out.sort((a, b) => b.rating * 1000 + b.review_count / 100 - (a.rating * 1000 + a.review_count / 100));
  }

  return out;
}

/** 검색 결과에서 각 필터 값이 몇 개를 남기는지 — 사이드바 카운트용 */
export function facetCounts(hotels: Hotel[]) {
  const region: Record<string, number> = {};
  const star: Record<number, number> = {};
  const category: Record<string, number> = {};
  for (const h of hotels) {
    region[h.region] = (region[h.region] ?? 0) + 1;
    star[h.star] = (star[h.star] ?? 0) + 1;
    category[h.category] = (category[h.category] ?? 0) + 1;
  }
  return { region, star, category };
}
