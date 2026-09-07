# FE1 — Tracking SDK + 데모 호텔 사이트

## 당신의 미션

**호텔 예약을 "실제로" 하는 것처럼 보이는 사이트를 만들고, 그 사이트에서 마우스 좌표 없이 행동 신호를 수집해야 합니다.**

---

## W1 — Kickoff (4/29 ~ 5/3)

### 할 일
- [ ] PRD v1.0 정독 + 질문/이슈 등록
- [ ] Tracking SDK 프로젝트 구조 설계
- [ ] 데모 호텔 사이트 페이지 와이어프레임 작성 (6개 페이지)
- [ ] 이벤트 스키마 v1 작성 → PR로 BE1과 합의
  - 파일: `docs/event-schema.md`
  - 예: `{ event_type: "visibility_change", ts: 1234567890, ... }`

### 산출물
- PR: `docs/event-schema.md` (BE1 리뷰 필수)
- 와이어프레임: 노션/피그마 링크 또는 로컬 `docs/fe1-wireframe.md`

### 첫 명령어
```bash
cd packages/tracking-sdk
pnpm install
pnpm dev
```

> **중요:** 이벤트 스키마는 BE1이 Ingestion API를 만들 때 필요합니다. W2 첫날까지 조인해야 합니다.

---

## W2 — 골격 구축 (5/6 ~ 5/10)

### Tracking SDK
- [ ] P0 신호 4개 수집 모듈 구현:
  - #1 탭 가시성 (Visibility API)
  - #2 윈도우 포커스 (focus/blur)
  - #3 유휴 시간 (inactivity timer)
  - #15 페이지 진입/이탈 (sendBeacon)
- [ ] 배트 전송 (debounce 200ms)
- [ ] TypeScript 타입 검증

### 데모 호텔 사이트
- [ ] 페이지 6종 정적 마크업:
  1. 홈 (검색바)
  2. 검색 결과 (필터)
  3. 호텔 상세
  4. 객실 선택
  5. 예약 입력 (가짜 폼)
  6. 예약 완료
- [ ] 더미 데이터: 호텔 20개 × 객실 3~4종 (JSON)
- [ ] 사진: Unsplash API 또는 오픈 이미지
- [ ] Tracking SDK 한 줄 스니펫 통합

### 산출물
```
packages/tracking-sdk/
├── src/
│   ├── index.ts          # 진입점
│   ├── visibility.ts     # Visibility API
│   ├── focus.ts          # Focus tracking
│   ├── idle.ts           # Idle detection
│   ├── beacon.ts         # sendBeacon
│   ├── batch.ts          # Event batching
│   └── types.ts          # Zod schemas
└── dist/
    └── hover.min.js      # 최종 산물 (< 10KB)

packages/demo-hotel-site/
├── src/
│   ├── app/
│   │   ├── page.tsx      # 홈
│   │   ├── search/page.tsx
│   │   ├── hotel/[id]/page.tsx
│   │   ├── rooms/page.tsx
│   │   ├── checkout/page.tsx
│   │   └── confirmation/page.tsx
│   └── data/
│       └── hotels.json   # 호텔 20개 더미 데이터
└── public/
    └── images/           # 호텔 사진
```

---

## W3 — 핵심 신호 완성 (5/13 ~ 5/17)

### Tracking SDK - P0 신호 나머지 4개
- [ ] #4 스크롤 깊이 (scroll %)
- [ ] #7 폼 필드 체류 (input focus time)
- [ ] #12 클립보드 복사 (clipboard event)
- [ ] #14 BroadcastChannel (다중 탭 감지)

### 데모 호텔 사이트
- [ ] 검색 → 상세 → 예약 플로우 동작 확인
- [ ] Redux/Context로 상태 관리 (선택사항)

### 성능 검증
```bash
# Lighthouse CI
npm run lighthouse

# < 50ms 영향도 목표
```

---

## W4 ~ W8 — 안정화 & 완성

### W4 Go/No-Go 회의
- [ ] A안(호텔) 유지 여부 결정 (호텔 도메인 진척도 > 50%)

### W5 ~ W6
- [ ] P1 신호 추가 (시간 되면)
  - #5 스크롤 방향
  - #6 키보드 리듬
  - #8 데드 클릭
- [ ] 브라우저 호환성 테스트
  - Chrome, Firefox, Safari 최신 버전
  - fallback: 지원 안 되는 API는 no-op

### W7 ~ W8
- [ ] 데모 시나리오 스크립트 작성 (발표용)
- [ ] 사이트 디테일 다듬기 (사진, UX 폴리시)

---

## 주요 파일 & 타입

### 이벤트 스키마 (`docs/event-schema.md`)
```typescript
interface TrackingEvent {
  event_id: string;        // UUID
  session_id: string;
  ts: number;             // milliseconds
  event_type:
 | 'visibility_change'
 | 'focus_change'
 | 'idle'
 | 'scroll'
 | 'form_input'
 | 'clipboard_copy'
 | 'broadcast_channel'
 | 'page_unload';
  payload: Record<string, any>;  // 이벤트 타입별 세부 정보
}
```

### Tracking SDK 사용법 (최종)
```html
<!-- 호텔 사이트에 한 줄만 추가 -->
<script src="https://cdn.hover.io/tracking-sdk/latest/hover.min.js"></script>
<script>
  hover.init({
    apiUrl: 'http://localhost:4000/events',
    sessionId: 'auto', // 또는 수동 생성
  });
</script>
```

---

## 의존성 & 협업

### BE1과 협력
- **이벤트 스키마 정의** (W1 동결)
- **Ingestion API** 라이브 여부 확인 (W2)
- **배치 포맷** 검증 (W3)

### FE2와 협력
- **Widget SDK** 통합 지점 (W4 이후)

---

## 팁

1. **마우스 추적 금지**
   - 멘토의 핵심 피드백
   - 절대 `mousemove`, `mousedown`, `mouseup` 수집 금지

2. **성능 우선**
   - SDK는 최대 10KB (gzipped)
   - 페이지 로드 < 50ms 추가 시간

3. **호환성 Fallback**
   ```typescript
   if ('visibilityState' in document) {
     // Visibility API 사용
   } else {
     // iOS Safari 같은 미지원 환경에서 no-op
   }
   ```

4. **로컬 테시**
   ```bash
   # Demo 사이트로 테스트
   cd packages/demo-hotel-site
   pnpm dev

   # 콜롬 개발자 도구에서 이벤트 전송 확인
   ```

---

## 블로커 발생 시

- **이벤트 스키마 합의 안 됨?** → BE1에 즉시 연락 (W1 중 해결)
- **Ingestion API 안 뜸?** → BE1에 확인 (W2 수요일까지)
- **위젯 SDK 통합 지점?** → FE2와 상의 (W4)

---

**Remember:** 우리가 하는 일은 "호텔 손님이 다른 탭을 깐다"는 **행동**을 감지하는 것입니다.
