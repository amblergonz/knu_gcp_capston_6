'use client';

import { useEffect } from 'react';
import { initTracker } from './index';
import { RouteTracker } from './RouteTracker';
import { hydrateCart } from '@/lib/cart';
import { hydrateWishlist } from '@/lib/wishlist';
import { DebugPanel } from '@/components/debug/DebugPanel';
import { InterventionHost } from '@/components/widgets/InterventionHost';

/**
 * 트래커를 마운트하는 유일한 지점.
 * session_id, Date.now(), Math.random() 은 전부 effect 안에서만 만들어지므로
 * 서버 렌더와 첫 클라이언트 렌더가 어긋날 여지가 없다.
 */
export function TrackerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 트래커가 장바구니 변경을 구독하므로 스토어를 먼저 복원한다.
    hydrateCart();
    hydrateWishlist();
    return initTracker();
  }, []);

  return (
    <>
      {children}
      <RouteTracker />
      <InterventionHost />
      <DebugPanel />
    </>
  );
}
