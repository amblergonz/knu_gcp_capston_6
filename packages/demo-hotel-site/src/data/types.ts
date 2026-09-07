import hotelsJson from './hotels.json';
import reviewsJson from './reviews.json';
import metaJson from './meta.json';

export interface RoomOption {
  id: string;
  label: string;
  price: number;
}

export interface Room {
  id: string;
  name: string;
  bed: string;
  size_m2: number;
  capacity: { standard: number; max: number };
  view: string;
  breakfast: boolean;
  refundable: boolean;
  price: number;
  original_price: number | null;
  remaining: number;
  photo_id: string;
  options: RoomOption[];
}

export interface Competitor {
  site: string;
  price: number;
  url: string;
}

export interface Hotel {
  id: string;
  name: string;
  name_en: string;
  brand: string;
  category: string;
  star: number;
  region: string;
  district: string;
  address: string;
  rating: number;
  review_count: number;
  base_price: number;
  original_price: number;
  discount_percent: number;
  images: { photo_id: string; alt: string }[];
  description: string;
  highlights: string[];
  amenities: string[];
  tags: string[];
  nearby: { name: string; distance_m: number }[];
  policy: { checkin: string; checkout: string; cancel: string; children: string };
  competitors: Competitor[];
  rooms: Room[];
}

export interface Review {
  id: string;
  hotel_id: string;
  author: string;
  rating: number;
  date: string;
  stay_type: string;
  room_name: string;
  title: string;
  body: string;
  helpful_count: number;
  categories: {
    cleanliness: number;
    location: number;
    service: number;
    value: number;
    facility: number;
  };
}

export interface Meta {
  regions: string[];
  amenities: { id: string; label: string }[];
  categories: string[];
  price_presets: { id: string; label: string; min: number; max: number }[];
  sorts: { id: string; label: string }[];
}

export const HOTELS = hotelsJson as unknown as Hotel[];
export const REVIEWS = reviewsJson as unknown as Record<string, Review[]>;
export const META = metaJson as unknown as Meta;
