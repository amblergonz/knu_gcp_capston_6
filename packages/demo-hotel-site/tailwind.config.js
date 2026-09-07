/** @type {import('tailwindcss').Config} */
module.exports = {
  // src/lib 까지 포함해야 트래커/위젯/디버그 패널의 클래스가 purge 되지 않는다.
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#152a63',
          // 헤더 밴드 전용 딥 네이비. 히어로(brand-700)보다 확실히 진해야
          // 스크롤해서 흰 본문 위로 올라와도 크롬으로 읽힌다.
          ink: '#0d1c42',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      maxWidth: {
        container: '1200px',
      },
      spacing: {
        header: '76px',
        panel: '360px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        hairline: '0 1px 0 0 rgb(15 23 42 / 0.06)',
        widget: '0 20px 45px -12px rgb(15 23 42 / 0.25)',
      },
      zIndex: {
        header: '40',
        sticky: '30',
        panel: '900',
        banner: '1000',
        backdrop: '1100',
        modal: '1110',
        toast: '1200',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pop-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.97)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-110%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '1', transform: 'translateY(0)' },
          to: { opacity: '0', transform: 'translateY(-110%)' },
        },
        'shrink-x': { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
        'pulse-dot': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        'log-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'fade-out': 'fade-out 160ms ease-in forwards',
        'pop-in': 'pop-in 220ms cubic-bezier(0.16,1,0.3,1)',
        'pop-out': 'pop-out 160ms ease-in forwards',
        'slide-down': 'slide-down 380ms cubic-bezier(0.16,1,0.3,1)',
        'slide-up': 'slide-up 240ms ease-in forwards',
        'shrink-x': 'shrink-x 12s linear forwards',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'log-in': 'log-in 180ms ease-out',
      },
    },
  },
  plugins: [],
};
