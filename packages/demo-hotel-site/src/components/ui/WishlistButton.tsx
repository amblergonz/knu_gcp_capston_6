'use client';

import { useEffect, useState } from 'react';
import { HeartIcon } from '@/components/icons';
import { hydrateWishlist, toggleWishlist, useWishlist } from '@/lib/wishlist';
import { cn } from '@/lib/cn';

export function WishlistButton({
  hotelId,
  hotelName,
  source,
  variant = 'overlay',
}: {
  hotelId: string;
  hotelName: string;
  source: string;
  variant?: 'overlay' | 'inline';
}) {
  const list = useWishlist();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrateWishlist();
    setMounted(true);
  }, []);

  const active = mounted && list.includes(hotelId);

  if (variant === 'inline') {
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${hotelName} 찜하기`}
        data-track="wishlist"
        data-source={source}
        onClick={() => toggleWishlist(hotelId)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
          active
            ? 'border-rose-200 bg-rose-50 text-rose-600'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
        )}
      >
        <HeartIcon size={16} filled={active} />
        {active ? '찜한 숙소' : '찜하기'}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${hotelName} 찜하기`}
      data-track="wishlist"
      data-source={source}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(hotelId);
      }}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-card backdrop-blur transition-colors',
        active ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600',
      )}
    >
      <HeartIcon size={17} filled={active} />
    </button>
  );
}
