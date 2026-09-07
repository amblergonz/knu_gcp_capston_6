import Link from 'next/link';
import { Suspense } from 'react';
import { Container } from '@/components/ui/Container';
import { SearchBar } from '@/components/search/SearchBar';
import { HotelCard } from '@/components/hotel/HotelCard';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { ExternalLinkIcon, ChevronRightIcon } from '@/components/icons';
import { allHotels, META, searchHotels } from '@/lib/hotels';

const COMPARE_SITES = [
  { label: '아고다', href: 'https://www.agoda.com/ko-kr/' },
  { label: '부킹닷컴', href: 'https://www.booking.com/' },
  { label: '네이버 호텔', href: 'https://hotels.naver.com/' },
];

export default function HomePage() {
  const popular = searchHotels({ sort: 'recommend' }).slice(0, 8);
  const deals = allHotels()
    .slice()
    .sort((a, b) => b.discount_percent - a.discount_percent)
    .slice(0, 4);

  return (
    <div className="bg-sky-50 pb-4">
      {/* 파랑은 이 히어로 밴드까지. 아래 본문은 중립 캔버스로 넘어간다. */}
      <section className="relative bg-gradient-to-b from-brand-700 to-sky-600 pb-24 pt-14">
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 0%, transparent 45%)' }}
        />
        <Container className="relative">
          <h1 className="prose-ko max-w-2xl text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
            국내 호텔·리조트, 한 번에 비교하고 예약하세요
          </h1>
          <p className="prose-ko mt-3 max-w-xl text-sm leading-relaxed text-brand-100">
            전국 20개 프리미엄 숙소의 실시간 최저가를 확인하고, 무료 취소 가능한 객실을 골라보세요.
          </p>
        </Container>
      </section>

      <Container className="relative z-10 -mt-16">
        <Suspense fallback={<div className="h-[132px] rounded-2xl border border-slate-200 bg-white shadow-lg" />}>
          <SearchBar variant="hero" />
        </Suspense>
      </Container>

      <Container className="pt-10">
        <div className="flex flex-wrap gap-2">
          {META.regions.map((r) => (
            <Link
              key={r}
              href={`/search?region=${encodeURIComponent(r)}`}
              data-track="region_chip"
              data-label={r}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {r}
            </Link>
          ))}
        </div>
      </Container>

      <Container className="pt-12">
        <SectionHead title="인기 호텔" desc="예약이 많은 순으로 추천합니다" href="/search" />
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((h) => (
            <HotelCard key={h.id} hotel={h} />
          ))}
        </div>
      </Container>

      <Container className="pt-12">
        <SectionHead title="지금 할인 중" desc="오늘까지 적용되는 특가입니다" href="/search?sort=price_asc" />
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {deals.map((h) => (
            <HotelCard key={h.id} hotel={h} showDiscount />
          ))}
        </div>
      </Container>

      <Container className="pt-12">
        <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">다른 예약 사이트 가격도 확인해 보세요</h2>
            <p className="prose-ko mt-1.5 text-sm text-slate-500">
              같은 객실이라도 사이트마다 가격이 다릅니다. 새 탭에서 비교한 뒤 돌아오시면 최저가를 다시 안내해 드립니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {COMPARE_SITES.map((s) => (
              <ExternalLink
                key={s.label}
                href={s.href}
                label={s.label}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {s.label}
                <ExternalLinkIcon size={14} />
              </ExternalLink>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}

function SectionHead({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
      </div>
      <Link
        href={href}
        data-track="section_more"
        data-label={title}
        className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-600 hover:underline"
      >
        전체 보기
        <ChevronRightIcon size={15} />
      </Link>
    </div>
  );
}
