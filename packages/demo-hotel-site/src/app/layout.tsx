import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { TrackerProvider } from '@/lib/tracker/TrackerProvider';

export const metadata: Metadata = {
  title: 'hover stay — 국내 호텔·리조트 예약',
  description: '실시간 행동 기반 개입 시스템 데모용 호텔 예약 사이트',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50">
        <TrackerProvider>
          <Header />
          <main className="min-h-[60vh]">{children}</main>
          <Footer />
        </TrackerProvider>
      </body>
    </html>
  );
}
