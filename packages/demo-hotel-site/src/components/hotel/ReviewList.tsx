import type { Review } from '@/lib/hotels';
import { StarRating } from './StarRating';

export function ReviewList({ reviews }: { reviews: Review[] }) {
  return (
    <ul className="mt-4 grid gap-4 md:grid-cols-2">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                {r.author.slice(0, 1)}
              </span>
              <span className="text-sm font-semibold text-slate-800">{r.author}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{r.stay_type}</span>
            </span>
            <span className="text-[11px] tabular-nums text-slate-400">{r.date}</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <StarRating star={Math.round(r.rating)} size={12} />
            <span className="text-xs font-bold tabular-nums text-slate-700">{r.rating.toFixed(1)}</span>
            <span className="text-[11px] text-slate-400">· {r.room_name}</span>
          </div>

          <p className="mt-2 text-sm font-semibold text-slate-900">{r.title}</p>
          <p className="prose-ko mt-1 text-sm leading-relaxed text-slate-600">{r.body}</p>

          <p className="mt-3 text-[11px] text-slate-400">도움이 됐어요 {r.helpful_count}</p>
        </li>
      ))}
    </ul>
  );
}
