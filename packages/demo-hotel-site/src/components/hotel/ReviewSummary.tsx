import type { Review } from '@/lib/hotels';
import { ScorePill } from './ScorePill';
import { num } from '@/lib/format';

const CATEGORIES: { key: keyof Review['categories']; label: string }[] = [
  { key: 'cleanliness', label: '청결도' },
  { key: 'location', label: '위치' },
  { key: 'service', label: '서비스' },
  { key: 'value', label: '가성비' },
  { key: 'facility', label: '시설' },
];

export function ReviewSummary({ rating, reviewCount, reviews }: { rating: number; reviewCount: number; reviews: Review[] }) {
  const avg = (key: keyof Review['categories']) =>
    reviews.length ? reviews.reduce((s, r) => s + r.categories[key], 0) / reviews.length : 0;

  return (
    <div className="grid gap-8 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-[180px_1fr]">
      <div className="flex flex-col items-center justify-center border-slate-100 sm:border-r">
        <ScorePill score={rating} />
        <p className="mt-2 text-xs text-slate-500">리뷰 {num(reviewCount)}개</p>
      </div>

      <ul className="space-y-2.5">
        {CATEGORIES.map((c) => {
          const v = avg(c.key);
          return (
            <li key={c.key} className="grid grid-cols-[64px_1fr_36px] items-center gap-3">
              <span className="text-xs text-slate-600">{c.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(v / 5) * 100}%` }} />
              </span>
              <span className="text-right text-xs font-semibold tabular-nums text-slate-700">{v.toFixed(1)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
