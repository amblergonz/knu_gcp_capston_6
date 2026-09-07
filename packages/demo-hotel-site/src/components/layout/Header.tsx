'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Logo } from './Logo';
import { CartIcon, HeartIcon, UserIcon } from '@/components/icons';
import { cartCount, hydrateCart, useCart } from '@/lib/cart';
import { hydrateWishlist, useWishlist } from '@/lib/wishlist';
import { cn } from '@/lib/cn';

// 헤더는 딥 네이비 크롬. 히어로(brand-700)보다 진해서 스크롤 중 흰 본문 위로
// 올라와도 배경과 섞이지 않는다.
export function Header() {
  const pathname = usePathname();
  const cart = useCart();
  const wishlist = useWishlist();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrateCart();
    hydrateWishlist();
    setMounted(true);
  }, []);

  // /checkout, /confirmation 은 결제 퍼널이라 네비게이션을 걷어낸다.
  const minimal = pathname === '/checkout' || pathname === '/confirmation';
  const count = mounted ? cartCount(cart) : 0;
  const wishCount = mounted ? wishlist.length : 0;

  return (
    <header
      className={cn(
        'sticky top-0 z-header h-header border-b border-white/10',
        'bg-gradient-to-r from-brand-ink via-brand-950 to-brand-900',
        'shadow-[0_2px_14px_-4px_rgba(13,28,66,0.55)]',
      )}
    >
      <Container className="flex h-full items-center justify-between gap-3 sm:gap-6">
        <div className="flex min-w-0 items-center gap-5 lg:gap-9">
          <Link href="/" data-track="logo" className="group">
            <Logo />
          </Link>

          {!minimal && (
            <nav className="hidden items-center gap-7 text-[15px] font-semibold text-brand-100/85 md:flex">
              <Link href="/search?region=서울" data-track="nav_domestic" className="transition-colors hover:text-white">
                국내 숙소
              </Link>
              <Link href="/search?category=리조트" data-track="nav_resort" className="transition-colors hover:text-white">
                리조트
              </Link>
              <Link href="/search?sort=price_asc" data-track="nav_deal" className="transition-colors hover:text-white">
                특가
              </Link>
            </nav>
          )}
        </div>

        {minimal ? (
          <span className="text-sm font-semibold text-brand-100">안전 결제</span>
        ) : (
          <div className="flex items-center gap-1">
            <Link
              href="/search"
              data-track="header_wishlist"
              className="relative flex h-10 items-center gap-1.5 rounded-lg px-3 text-[15px] font-semibold text-brand-100/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              <HeartIcon size={19} filled={wishCount > 0} />
              <span className="hidden sm:inline">찜</span>
              {wishCount > 0 && <span className="text-sm tabular-nums text-white">{wishCount}</span>}
            </Link>

            <Link
              href="/rooms"
              data-track="header_cart"
              className="relative flex h-10 items-center gap-1.5 rounded-lg px-3 text-[15px] font-semibold text-brand-100/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              <CartIcon size={19} />
              <span className="hidden sm:inline">예약 담기</span>
              {count > 0 && (
                <span
                  className={cn(
                    'absolute -right-0.5 top-0 grid h-5 min-w-[20px] animate-pop-in place-items-center',
                    'rounded-full bg-rose-500 px-1 text-[11px] font-bold tabular-nums text-white',
                  )}
                >
                  {count}
                </span>
              )}
            </Link>

            <button
              type="button"
              data-track="header_login"
              className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-[15px] font-semibold text-brand-100/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              <UserIcon size={19} />
              <span className="hidden sm:inline">로그인</span>
            </button>
          </div>
        )}
      </Container>
    </header>
  );
}
