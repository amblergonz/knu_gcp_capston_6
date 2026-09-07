import { cn } from '@/lib/cn';

// 심볼: 자기 그림자 위에 떠 있는 아치.
// 아치는 숙소·입구를, 아래 짧은 선은 "hover"(떠 있음)를 뜻한다.
// 박스 없이 선 하나로만 그려서 헤더 크롬에 그대로 얹힌다.
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('shrink-0 overflow-visible', className)}
    >
      <defs>
        <linearGradient id="hoverstay-mark" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="0.55" stopColor="#93c5fd" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      {/* 아치 — 다리가 바닥에 닿지 않는다 */}
      <path
        d="M6 23.4V16a10 10 0 0 1 20 0v7.4"
        stroke="url(#hoverstay-mark)"
        strokeWidth="2.9"
        strokeLinecap="round"
        className="transition-transform duration-300 ease-out group-hover:-translate-y-[1.2px]"
      />
      {/* 아치 안쪽의 작은 기둥 — 비어 보이지 않게 잡아준다 */}
      <path
        d="M16 23.4v-6.6"
        stroke="url(#hoverstay-mark)"
        strokeWidth="2.9"
        strokeLinecap="round"
        opacity="0.5"
        className="transition-transform duration-300 ease-out group-hover:-translate-y-[1.2px]"
      />
      {/* 떠 있음을 만드는 그림자 선 */}
      <path
        d="M10 28.2h12"
        stroke="url(#hoverstay-mark)"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.32"
        className="origin-center transition-transform duration-300 ease-out group-hover:scale-x-[0.82]"
      />
    </svg>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="text-[21px] font-extrabold tracking-[-0.02em] text-white">
          hover<span className="font-light text-sky-300/90">stay</span>
        </span>
        <span className="mt-[5px] hidden text-[9px] font-semibold uppercase tracking-[0.3em] text-brand-200/55 sm:block">
          hotel booking
        </span>
      </span>
    </span>
  );
}
