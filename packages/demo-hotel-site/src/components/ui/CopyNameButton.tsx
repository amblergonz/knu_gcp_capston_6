'use client';

import { useState } from 'react';
import { CopyIcon, CheckIcon } from '@/components/icons';
import { track } from '@/lib/tracker';
import { cn } from '@/lib/cn';

// navigator.clipboard.writeText 는 copy 이벤트를 발생시키지 않는다.
// 따라서 전역 copy 리스너가 이 버튼을 절대 못 잡으므로 여기서 직접 track 을 호출해야 한다.
export function CopyNameButton({ value, label = '이름 복사', className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      // 비보안 오리진 폴백. 이 경로는 실제 copy 이벤트를 발생시키므로
      // 전역 리스너와의 중복은 트래커 쪽에서 100ms 창으로 제거한다.
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }

    if (ok) {
      track('clipboard_copy', { selected_text: value.slice(0, 200), length: value.length, source: 'button' });
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      data-track="copy_name"
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
        done ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
        className,
      )}
    >
      {done ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      {done ? '복사됨' : label}
    </button>
  );
}
