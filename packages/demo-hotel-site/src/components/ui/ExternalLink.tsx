'use client';

import type { ReactNode } from 'react';
import { track } from '@/lib/tracker';
import { cn } from '@/lib/cn';

// 외부 링크는 반드시 새 탭으로 연다.
// 같은 탭에서 이탈하면 데모 세션 자체가 사라지고, 새 탭은 자연스럽게 멀티탭 신호도 만든다.
export function ExternalLink({
  href,
  label,
  className,
  children,
}: {
  href: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const host = (() => {
    try {
      return new URL(href).hostname;
    } catch {
      return '';
    }
  })();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-external="true"
      onClick={() => track('external_link', { href, hostname: host, label })}
      className={cn('inline-flex items-center gap-1 transition-colors', className)}
    >
      {children}
    </a>
  );
}
