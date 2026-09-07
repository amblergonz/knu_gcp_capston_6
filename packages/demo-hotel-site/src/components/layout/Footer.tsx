import { Container } from '@/components/ui/Container';
import { ExternalLink } from '@/components/ui/ExternalLink';

const COLUMNS = [
  { title: '회사', items: ['회사 소개', '채용', '제휴 문의', '공지사항'] },
  { title: '고객센터', items: ['자주 묻는 질문', '1:1 문의', '예약 취소·환불', '이용 가이드'] },
  { title: '약관', items: ['이용약관', '개인정보 처리방침', '위치기반서비스 약관', '청소년 보호정책'] },
];

export function Footer() {
  return (
    <footer className="mt-20 bg-slate-900 py-12 text-slate-400">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <span className="grid h-6 w-6 place-items-center rounded bg-white/10 text-xs font-black">H</span>
              hover stay
            </div>
            <p className="prose-ko mt-3 max-w-xs text-xs leading-relaxed">
              본 사이트는 실시간 행동 기반 개입 시스템 시연을 위한 데모입니다. 실제 예약과 결제는 이루어지지 않습니다.
            </p>
            <p className="mt-4 text-[11px] text-slate-500">
              경북대학교 캡스톤 프로젝트 · hover
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{col.title}</p>
              <ul className="mt-4 space-y-2.5 text-xs">
                {col.items.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      data-track="footer_link"
                      data-label={item}
                      className="transition-colors hover:text-brand-300"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-800 pt-6 text-[11px]">
          <span className="text-slate-500">제휴 예약 사이트</span>
          <ExternalLink href="https://www.agoda.com/ko-kr/" label="아고다" className="hover:text-brand-300">
            아고다
          </ExternalLink>
          <ExternalLink href="https://www.booking.com/" label="부킹닷컴" className="hover:text-brand-300">
            부킹닷컴
          </ExternalLink>
          <ExternalLink href="https://hotels.naver.com/" label="네이버 호텔" className="hover:text-brand-300">
            네이버 호텔
          </ExternalLink>
        </div>
      </Container>
    </footer>
  );
}
