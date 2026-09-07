'use client';

import { useState } from 'react';
import { unsplashUrl } from '@/lib/images';
import { cn } from '@/lib/cn';

// Unsplash 원격 이미지. 네트워크가 막힌 환경에서도 데모가 깨져 보이지 않도록
// 실패 시 그라데이션 + 숙소명 폴백으로 대체한다.
export function RemoteImage({
  photoId,
  alt,
  width,
  height,
  className,
  sizes,
}: {
  photoId: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-sky-100 to-brand-200 px-3 text-center',
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <span className="prose-ko text-xs font-semibold text-brand-900/40">{alt}</span>
      </div>
    );
  }

  return (
    // next/image 대신 <img> 를 쓴다: 데모가 오프라인일 때 onError 폴백이 확실히 동작하고,
    // 원격 최적화 프록시가 죽어도 페이지가 멈추지 않는다.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={unsplashUrl(photoId, width, height)}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}
