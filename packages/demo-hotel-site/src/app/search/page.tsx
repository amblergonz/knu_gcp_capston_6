import Link from 'next/link';
import { Suspense } from 'react';
import { Container } from '@/components/ui/Container';
import { SearchBar } from '@/components/search/SearchBar';
import { FilterSidebar } from '@/components/search/FilterSidebar';
import { SortSelect } from '@/components/search/SortSelect';
import { ActiveFilterChips } from '@/components/search/ActiveFilterChips';
import { HotelListRow } from '@/components/hotel/HotelListRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { META, searchHotels, facetCounts, allHotels, type SearchFilters } from '@/lib/hotels';
import { num } from '@/lib/format';

type SP = Record<string, string | string[] | undefined>;

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function toFilters(sp: SP): SearchFilters {
  const preset = META.price_presets.find((p) => p.id === sp.price);
  return {
    q: typeof sp.q === 'string' ? sp.q : undefined,
    region: asArray(sp.region),
    star: asArray(sp.star).map(Number).filter((n) => !Number.isNaN(n)),
    category: asArray(sp.category),
    amenities: asArray(sp.amenities),
    minPrice: preset?.min,
    maxPrice: preset?.max,
    minRating: typeof sp.rating === 'string' ? Number(sp.rating) : undefined,
    sort: typeof sp.sort === 'string' ? sp.sort : 'recommend',
  };
}

// Next 15 에서 searchParams 는 Promise 다.
export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filters = toFilters(sp);
  const results = searchHotels(filters);
  const counts = facetCounts(allHotels());

  return (
    <div className="bg-slate-50">
      <div className="border-b border-slate-200 bg-white lg:sticky lg:top-header lg:z-sticky">
        <Container className="py-3">
          <Suspense fallback={<div className="h-11" />}>
            <SearchBar variant="compact" />
          </Suspense>
        </Container>
      </div>

      <Container className="grid grid-cols-1 gap-6 py-8 lg:grid-cols-[260px_1fr]">
        <Suspense fallback={<div className="h-96 rounded-xl border border-slate-200 bg-white" />}>
          <FilterSidebar counts={counts} />
        </Suspense>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              총 <b className="tabular-nums text-slate-900">{num(results.length)}</b>개의 숙소
              {filters.q ? (
                <span className="ml-1 text-slate-400">· &ldquo;{filters.q}&rdquo; 검색 결과</span>
              ) : null}
            </p>
            <Suspense fallback={null}>
              <SortSelect />
            </Suspense>
          </div>

          <Suspense fallback={null}>
            <ActiveFilterChips />
          </Suspense>

          {results.length === 0 ? (
            <EmptyState
              title="조건에 맞는 숙소가 없습니다"
              description="필터를 조정하거나 다른 지역으로 검색해 보세요."
              action={
                <Link
                  href="/search"
                  className="inline-flex h-10 items-center rounded-lg border border-brand-600 bg-white px-5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                  필터 초기화
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {results.map((h) => (
                <HotelListRow key={h.id} hotel={h} />
              ))}
            </ul>
          )}
        </div>
      </Container>
    </div>
  );
}
