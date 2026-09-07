import { StarIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

// 박스 없이 별 하나 + 숫자만. 색은 별이 담당하고 숫자는 진한 잉크색으로 둔다.
// (파란 사각형 배지는 헤더 크롬과 색이 겹쳐서 걷어냈다.)
function label(score: number): string {
  if (score >= 4.7) return '최고예요';
  if (score >= 4.4) return '훌륭해요';
  if (score >= 4.0) return '좋아요';
  return '괜찮아요';
}

export function ScorePill({
  score,
  size = 'md',
  showLabel = false,
  className,
}: {
  score: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}) {
  const sm = size === 'sm';

  return (
    <span className={cn('inline-flex items-baseline gap-1', className)}>
      <StarIcon
        size={sm ? 14 : 17}
        filled
        className={cn('shrink-0 translate-y-[2px] text-amber-400', sm && 'translate-y-[1.5px]')}
      />
      <span
        className={cn(
          'font-bold tabular-nums leading-none text-slate-900',
          sm ? 'text-sm' : 'text-[17px]',
        )}
      >
        {score.toFixed(1)}
      </span>
      {showLabel && (
        <span className={cn('font-semibold leading-none text-amber-600', sm ? 'text-[11px]' : 'text-xs')}>
          {label(score)}
        </span>
      )}
    </span>
  );
}
