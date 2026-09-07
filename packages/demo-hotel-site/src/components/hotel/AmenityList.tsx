import { amenityLabel } from '@/lib/hotels';
import { cn } from '@/lib/cn';

// 편의시설은 아이콘 대신 텍스트 pill + Tailwind 로 그린 점을 쓴다.
// 12종에 각각 글리프를 붙이면 통일감이 무너지고 이모지 유혹이 생긴다.
export function AmenityList({ ids, limit, className }: { ids: string[]; limit?: number; className?: string }) {
  const shown = typeof limit === 'number' ? ids.slice(0, limit) : ids;
  const rest = ids.length - shown.length;

  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {shown.map((id) => (
        <li
          key={id}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          {amenityLabel(id)}
        </li>
      ))}
      {rest > 0 && (
        <li className="inline-flex items-center rounded-full px-2 py-1 text-[11px] text-slate-400">+{rest}</li>
      )}
    </ul>
  );
}
