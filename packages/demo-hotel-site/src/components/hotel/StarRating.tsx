import { StarIcon } from '@/components/icons';

export function StarRating({ star, size = 14 }: { star: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${star}성급`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon
          key={i}
          size={size}
          filled={i < star}
          className={i < star ? 'text-amber-400' : 'text-slate-200'}
        />
      ))}
    </span>
  );
}
