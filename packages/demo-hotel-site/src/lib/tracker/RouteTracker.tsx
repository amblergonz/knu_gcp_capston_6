'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { onRouteChange } from './index';

// 모듈 레벨에 두어 StrictMode 이중 실행에도 page_view 가 두 번 나가지 않게 한다.
let lastKey = '';

/**
 * useSearchParams() 를 쓰지 않는다.
 * Next 15 에서 그 훅은 가장 가까운 Suspense 경계를 강제하고, 경계가 없으면
 * 라우트 전체를 클라이언트 렌더로 떨어뜨린다. effect 안에서 location.search 를
 * 읽으면 여기서는 동등하고 부작용도 없다.
 */
export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const key = pathname + window.location.search;
    if (lastKey === key) return;
    lastKey = key;
    onRouteChange(pathname);
  }, [pathname]);

  return null;
}
