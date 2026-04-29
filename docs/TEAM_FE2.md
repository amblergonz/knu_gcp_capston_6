# 🎨 FE2 — Widget SDK + 관리 대시보드

## 📌 당신의 미션

**고객이 보는 "개입 위젯"(쿠폰 모달, 최저가 배너)과 평가자가 보는 "결과 대시보드"를 만들어야 합니다.**

---

## 🎯 W1 — Kickoff (4/29 ~ 5/3)

### 할 일
- [ ] PRD v1.0 정독
- [ ] Widget SDK 기술 스택 결정 (Preact + Shadow DOM)
- [ ] 개입 페이로드 스키마 v1 작성 → PR로 BE2와 합의
  - 파일: `docs/intervention-payload.md`
  - 예: `{ scenario_id: "S1", widgets: [{ type: "coupon", data: {...} }] }`
- [ ] Dashboard API 스키마 v1 작성 → PR로 BE3과 합의
  - 파일: `docs/dashboard-api.md`
  - 예: `GET /api/signals/coverage`, `GET /api/scenarios/firings`
- [ ] Dashboard 페이지 와이어프레임 작성 (4개 페이지)

### 산출물
- PR: `docs/intervention-payload.md` (BE2 리뷰 필수)
- PR: `docs/dashboard-api.md` (BE3 리뷰 필수)
- 와이어프레임: 4개 페이지 (Live, Scenarios, A/B, Signals)

### 첫 명령어
```bash
cd packages/widget-sdk
pnpm install
pnpm dev

cd packages/admin-dashboard
pnpm install
pnpm dev  # 포트 3001
```

> 📌 **중요:** 개입 페이로드는 BE2가 Decision API를 만들 때 필요합니다. W2 첫날까지 조인해야 합니다.

---

## 🎯 W2 — 골격 구축 (5/6 ~ 5/10)

### Widget SDK
- [ ] 컴포넌트 1종 필수: **쿠폰 모달** (S1)
  - 호텔명, 객실명, 할인율 표시
  - 닫기/사용 버튼
  - Preact + Shadow DOM (호스트 CSS 격리)
  - Storybook 스토리 작성
- [ ] 컴포넌트 구조:
  - `CouponModal.tsx` — 렌더링
  - `styles.css` — Shadow DOM 내 스타일
  - `index.tsx` — 진입점

### Admin Dashboard
- [ ] 라우팅 + 레이아웃 (Next.js)
- [ ] 페이지 스켈레톤:
  1. `/dashboard/live` — 라이브 이벤트 스트림
  2. `/dashboard/scenarios` — 시나리오 발화
  3. `/dashboard/ab` — A/B 테스트 결과
  4. `/dashboard/signals` — 신호 수집 현황

### 산출물
```
packages/widget-sdk/
├── src/
│   ├── components/
│   │   └── CouponModal.tsx
│   ├── styles/
│   │   └── coupon.css
│   └── index.tsx
└── dist/
    └── hover-widget.js

packages/admin-dashboard/
├── app/
│   ├── dashboard/
│   │   ├── live/page.tsx
│   │   ├── scenarios/page.tsx
│   │   ├── ab/page.tsx
│   │   └── signals/page.tsx
│   └── layout.tsx
└── public/
```

---

## 🎯 W3 — 위젯 완성 (5/13 ~ 5/17)

### Widget SDK
- [ ] 쿠폰 모달 **완성**
- [ ] 위젯 2종 추가: **최저가 배너** (S2)
  - 화면 상단 슬라이드인 애니메이션
  - 가격 차액 표시
  - 닫기 버튼

### Admin Dashboard
- [ ] **Live 페이지** → 실시간 이벤트 스트림 (BE3 SSE/WebSocket)
- [ ] **Scenarios 페이지** → 시나리오 발화 차트 (Recharts)

### 성능 검증
```bash
# 위젯 로드 < 200ms 목표
npm run lighthouse
```

---

## 🎯 W4 ~ W6 — 대시보드 완성 & A/B

### W4
- [ ] **Scenarios 페이지** 완성
  - S1·S2 발화 횟수 차트
  - 시간대별 분석

### W5
- [ ] **A/B 페이지** 완성
  - 개입군 vs 통제군 전환율
  - 통계 검정 결과 (chi-square)
- [ ] **Signals 페이지** 완성
  - 16개 신호 수집 현황
  - 누락 알림

### W6
- [ ] 대시보드 시각 다듬기
- [ ] 시뮬레이터 데이터로 테스트

---

## 📋 주요 파일 & 타입

### 개입 페이로드 (`docs/intervention-payload.md`)
```typescript
interface InterventionPayload {
  intervention_id: string;   // UUID
  session_id: string;
  scenario_id: 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  widgets: InterventionWidget[];
  ab_group: 'control' | 'treatment';
}

interface InterventionWidget {
  type: 'coupon_modal' | 'price_banner' | 'review_card';
  duration_ms: number;      // 표시 시간
  data: {
    hotel_name?: string;
    room_name?: string;
    discount_percent?: number;
    price_diff?: number;
    cta_text?: string;
  };
}
```

### Dashboard API (`docs/dashboard-api.md`)
```typescript
// GET /api/signals/coverage
{
  total_signals: 16,
  collected: [1, 2, 3, 4, 7, 12, 14, 15],
  coverage_percent: 50
}

// GET /api/scenarios/firings?from=1234567890&to=1234567990
{
  S1: { count: 42, avg_revenue: 15000 },
  S2: { count: 78, avg_revenue: 8000 }
}

// GET /api/ab/results?scenario=S1
{
  control: { count: 100, converted: 5, cr: 0.05 },
  treatment: { count: 100, converted: 12, cr: 0.12 },
  p_value: 0.042,
  significant: true
}
```

### Widget 사용법 (FE1이 호텔 사이트에 추가)
```javascript
// Decision API에서 개입 받기
const decision = await fetch('http://localhost:4001/decide', {
  body: JSON.stringify({ session_id, scenario_id: 'S1' })
}).then(r => r.json());

// 위젯 표시
if (decision.widgets.length > 0) {
  const container = document.createElement('div');
  container.id = 'hover-widget';
  document.body.appendChild(container);
  
  // Lazy load + render
  import('@hover/widget-sdk').then(({ renderWidget }) => {
    renderWidget(container, decision.widgets[0]);
  });
}
```

---

## 🔗 의존성 & 협업

### BE2와 협력
- **개입 페이로드 정의** (W1 동결)
- **Decision API** 라이브 여부 확인 (W3)

### BE3와 협력
- **Dashboard API** 정의 (W1 동결)
- **API 실장** 여부 확인 (W3)
- **시뮬레이터** 데이터로 대시보드 테스트 (W5)

### FE1과 협력
- **Widget 통합** (W4~W5)
- **데모 사이트**에서 위젯 표시 확인

---

## 💡 팁

1. **Shadow DOM 격리**
   ```typescript
   const shadow = host.attachShadow({ mode: 'open' });
   shadow.innerHTML = `
     <style>${styles}</style>
     <div class="coupon-modal">...</div>
   `;
   ```
   → 호스트 사이트 CSS가 위젯에 영향 없음

2. **Lazy Load**
   ```typescript
   // 처음엔 로드 안 함
   if ('IntersectionObserver' in window) {
     observer.observe(container);
   }
   ```

3. **대시보드는 BE3 API에 의존**
   - `.env.local` 설정:
     ```
     NEXT_PUBLIC_DASHBOARD_API=http://localhost:4002
     ```

4. **Recharts 활용**
   ```typescript
   <LineChart data={scenarios}>
     <XAxis dataKey="ts" />
     <Line type="monotone" dataKey="count" />
   </LineChart>
   ```

---

## 📞 블로커 발생 시

- **개입 페이로드 정의 안 됨?** → BE2에 즉시 연락 (W1 중 해결)
- **Decision API 안 뜸?** → BE2에 확인 (W3 금요일까지)
- **대시보드 API 응답 안 옴?** → BE3에 확인 (W4 금요일까지)

---

**Remember:** 당신의 위젯이 고객 화면에 1.5초 안에 떠야 우리가 이탈을 막습니다. ⚡
