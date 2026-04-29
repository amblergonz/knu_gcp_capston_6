# PRD: Hover — 실시간 마케팅 개입 플랫폼 v1.0

> **A안: 호텔/숙박 예약 (메인) · B안: 패션 (피벗 대비)**

---

## 0. 문서 메타

| 항목 | 내용 |
|---|---|
| 버전 | **v1.0 (동결)** |
| 작성일 | 2026-04-29 |
| 컨텍스트 | 학기 과제 (Capstone) — 실서비스 출시 X, 데모/발표/보고서 평가 |
| 팀 | FE 2명 + BE 4명 (총 6명) |
| 기간 | 8주 |

---

## 1. 우리는 무엇을 만드는가 (팀 공통 그림)

### 1.1 한 문단 설명 — **모든 팀원이 외울 것**

> **Hover는, 호텔 예약 사이트를 둘러보던 손님이 다른 탭(아고다·부킹닷컴 등)으로 옮겨갈 때 마우스 좌표를 추적하지 않고도 그 행동을 감지해, "지금 이 가격이 최저가입니다" 또는 "방금 보던 객실이 곧 마감됩니다" 같은 메시지를 사이트 안에서 1.5초 안에 띄워주는 시스템이다.**

핵심 단어 4개:
- **호텔 예약** (타겟 도메인)
- **마우스 좌표 없이** (멘토 피드백 핵심)
- **다른 탭으로 옮길 때** (탭 스위칭 = 비교 행동)
- **사이트 안에서 즉시 개입** (실시간의 가치는 분석이 아니라 개입)

### 1.2 왜 호텔/숙박인가 (A안 선정 근거)

| 우리 시스템 특성 | 호텔 예약 매칭도 |
|---|---|
| 단일 세션 안에서 비교 행동 발생 | ★★★★★ (Booking·Agoda·Expedia 동시 비교가 표준) |
| 데스크톱 트래픽 비중 | ★★★★★ (장기 여행은 PC에서 결정) |
| 카트 → 결제 사이 망설임 시간 | ★★★★★ (분 단위 망설임이 흔함) |
| 가격 민감도 | ★★★★★ (같은 방을 어디서 살지가 핵심 의사결정) |
| 시그니처 시나리오 S2 적합도 | ★★★★★ ("최저가 매칭" 메시지가 도메인과 정확히 일치) |

### 1.3 B안: 패션 (피벗 대비)
A안 진행 중 다음 조건 발생 시 B안 검토 (W4 Go/No-Go 회의):
- 호텔 도메인 데모 사이트 제작이 W4까지 50% 미만
- 호텔 관련 공개 데이터셋 분석에서 의미 있는 임계치 도출 실패
- BroadcastChannel/visibility API가 호텔 시나리오에서 노이즈가 너무 큼

**B안 차이점만 요약:** 데이터셋이 H&M Personalized Fashion 등으로 풍부, 데모 사이트는 옵션(사이즈/색상) UI 추가 필요, S2 메시지는 "최저가 매칭" → "사이즈 임박" 톤으로 변경.

### 1.4 비-목표 (Out of Scope) — 흔들리지 않게 못 박기

- ❌ 실고객 트래픽 / 파일럿 계약 / 매출
- ❌ 마우스 좌표·궤적 정밀 분석
- ❌ 사이트 이탈 후 추적 (리타겟팅, 광고)
- ❌ GDPR/PIPA 풀 컴플라이언스 (기본 옵트인 UX만)
- ❌ 클라우드 프로덕션 배포 (로컬 docker compose로 끝)
- ❌ GA 같은 사후 퍼널 분석 풀 대시보드

### 1.5 평가받을 것 (Scope) — 8주 끝에 이게 다 있어야 함

1. **자체 제작 호텔 예약 데모 사이트** (검색→상세→예약 플로우)
2. **Tracking SDK** (마우스 좌표 미수집, P0 신호 8개+)
3. **Widget SDK** (S1·S2 컴포넌트 2종)
4. **Rule Engine** (S1·S2 룰 작동)
5. **Admin Dashboard** (시나리오 발화 / A/B 결과 시각화)
6. **Retailrocket·OTTO 분석 노트북** (임계치 도출 + 가설 검증)
7. **합성 트래픽 시뮬레이터**
8. **`docker compose up` 한 번으로 전체 기동** (재현성)
9. **최종 보고서 + 발표자료**

---

## 2. 시스템 구조 (한 그림)

```
┌──────────────────────────────────────────────────────────────┐
│  [데모 호텔 예약 사이트]   ← FE1 제작                          │
│   ┌────────────────┐     ┌─────────────────┐                 │
│   │ Tracking SDK   │ ──▶ │ Widget SDK      │                 │
│   │ (FE1)          │     │ (FE2)           │                 │
│   │ • Visibility   │     │ • 쿠폰 모달     │                 │
│   │ • BroadcastCh  │     │ • 최저가 배너   │                 │
│   │ • Clipboard    │     └────────▲────────┘                 │
│   │ • Idle/Focus   │              │                          │
│   └───────┬────────┘              │ intervention payload     │
└───────────┼───────────────────────┼──────────────────────────┘
            │ event batch (HTTPS)   │
            ▼                       │
┌────────────────────────────────────┼─────────────────────────┐
│  [Backend]                         │                         │
│   ┌──────────────┐                 │                         │
│   │ Ingestion API│ ← BE1          │                         │
│   │ (Fastify)    │                 │                         │
│   └──────┬───────┘                 │                         │
│          ▼                         │                         │
│   ┌──────────────┐                 │                         │
│   │ Redis Streams│                 │                         │
│   └──────┬───────┘                 │                         │
│          ▼                         │                         │
│   ┌──────────────┐    ┌────────────┴──────┐                  │
│   │ Stream Worker│ ──▶│ Decision API     │ ← BE2             │
│   │ + Rule Engine│    │ (S1·S2 발화)     │                   │
│   │ (BE2)        │    └───────────────────┘                  │
│   └──────┬───────┘                                           │
│          ▼                                                    │
│   ┌──────────────┐    ┌────────────────────┐                 │
│   │ Redis(session│    │ ClickHouse         │ ← BE3           │
│   │ hot state)   │    │ + Dashboard API    │                 │
│   │ BE1          │    └────────┬───────────┘                 │
│   └──────────────┘             │                             │
│                                │ analytics queries           │
│   ┌────────────────────────────┴───┐                         │
│   │ DS / 데이터셋 분석 (BE4)       │                         │
│   │ Retailrocket · OTTO            │                         │
│   │ → 임계치, 가설 검증            │                         │
│   └────────────────────────────────┘                         │
└──────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
                          ┌─────────┴─────────┐
                          │ Admin Dashboard   │ ← FE2
                          │ (Next.js)         │
                          └───────────────────┘
```

---

## 3. 기술 스택 (확정)

### 3.1 레이어별 선택

| 레이어 | 선택 | 버전/패키지 | 담당 |
|---|---|---|---|
| **Tracking SDK** | TypeScript + Vite | TS 5.x | FE1 |
| **Widget SDK** | Preact + Shadow DOM | preact 10.x | FE2 |
| **데모 호텔 사이트** | Next.js (App Router) + Tailwind | Next 15.x | FE1 |
| **Admin Dashboard** | Next.js + shadcn/ui + Recharts | Next 15.x | FE2 |
| **Ingestion API** | Fastify | Node 20 LTS | BE1 |
| **메시지 큐** | Redis Streams | Redis 7.x | BE1 |
| **Stream Worker** | Node.js + json-rules-engine | Node 20 | BE2 |
| **Decision API** | Fastify | Node 20 | BE2 |
| **세션 스토어** | Redis | Redis 7.x | BE1 |
| **OLAP** | ClickHouse | 24.x | BE3 |
| **메타 DB** | PostgreSQL | 16.x | BE3 |
| **Dashboard API** | Fastify | Node 20 | BE3 |
| **데이터 분석** | Python + Pandas + PyTorch | Python 3.11+ | BE4 |
| **오케스트레이션** | docker compose | v2 | BE1 |
| **버전 관리** | GitHub + monorepo (pnpm workspaces) | — | BE1 |
| **CI** | GitHub Actions (lint + test on PR) | — | BE1 |

### 3.2 모노레포 구조 (W1 안에 BE1이 만들 것)

```
hover/
├── packages/
│   ├── tracking-sdk/         # FE1
│   ├── widget-sdk/           # FE2
│   ├── demo-hotel-site/      # FE1
│   ├── admin-dashboard/      # FE2
│   ├── ingestion-api/        # BE1
│   ├── stream-worker/        # BE2
│   ├── decision-api/         # BE2
│   ├── dashboard-api/        # BE3
│   ├── shared/               # 공통 타입 (이벤트 스키마 등) ★
│   └── simulator/            # BE3 합성 트래픽
├── notebooks/                # BE4 (Retailrocket, OTTO 분석)
├── docker-compose.yml        # BE1
├── README.md                 # BE1
└── docs/
    ├── event-schema.md       # ★ FE1↔BE1 합의
    ├── intervention-payload.md  # ★ BE2↔FE2 합의
    └── dashboard-api.md      # ★ BE3↔FE2 합의
```

---

## 4. 데이터 — 무엇을 어떻게 모으는가

### 4.1 공개 데이터셋 (BE4가 W1에 모두 다운로드)

| 데이터셋 | 출처 | 용도 | 크기 |
|---|---|---|---|
| **Retailrocket** | Kaggle: `retailrocket/ecommerce-dataset` | S1 임계치 도출 ("카트추가→이탈 시간 분포") | ~700MB |
| **OTTO Recommender Systems** | Kaggle: `otto/recsys-dataset` (CC-BY 4.0) | 세션 기반 의도 예측 시연, 사전학습 | ~12GB (필요 시 subset) |
| **(B안용) H&M Personalized Fashion** | Kaggle | B안 피벗 시 패션 데이터 | — |
| **(보조) Diginetica CIKM 2016** | 학계 공개 | 검색→클릭 시퀀스 분석 | — |

> 호텔 도메인 직접 데이터셋은 공개된 게 빈약하므로, **이커머스 일반 데이터셋에서 임계치를 뽑고 호텔 시나리오에 매핑**하는 전략. 보고서에 이 방법론적 한계를 명시.

### 4.2 자체 수집 데이터 (모두 익명)

| 데이터 | 수집 시점 | 용도 |
|---|---|---|
| **§5 의 16개 신호** | SDK 통해 데모 사이트 방문 시 | 시스템 동작 검증, A/B |
| **합성 트래픽** | BE3 시뮬레이터 (가상 사용자 1,000명) | 발표용 대시보드 채우기, 부하 테스트 |
| **개입 결과 로그** | Decision API 발화 시 | A/B 통계 검정 |

### 4.3 데이터 스키마 — W1에 동결

#### `events` 테이블 (ClickHouse)
```
event_id      UUID
session_id    String
user_id       String (옵션, 익명 해시)
ts            DateTime64(3)
event_type    Enum (visibility_change, focus_change, idle, scroll, ...)
page_url      String
payload       JSON   -- 이벤트 타입별 가변 필드
device       Enum (desktop, mobile, tablet)
referrer      String
```

#### `interventions` 테이블
```
intervention_id  UUID
session_id       String
ts               DateTime64(3)
scenario_id      Enum (S1, S2, ...)
ab_group         Enum (control, treatment)
shown            Bool
```

#### `outcomes` 테이블
```
session_id    String
final_state   Enum (purchased, abandoned, ongoing)
revenue       Decimal (데모용 더미)
```

---

## 5. 신호 카탈로그 (변동 없음, 다시 명시)

P0 (MVP 필수 8개): #1 탭 가시성 · #2 윈도우 포커스 · #3 유휴 시간 · #4 스크롤 깊이 · #7 폼 필드 체류 · #12 클립보드 복사 · #14 BroadcastChannel(다중 탭) · #15 페이지 진입/이탈(sendBeacon)

P1 (시간 되면 4개): #5 스크롤 방향 · #6 키보드 리듬 · #8 데드 클릭 · #16 뒤/앞 네비

P2 (Stretch 4개): #9 터치 · #10 네트워크 · #11 리사이즈 · #13 컨텍스트 메뉴

---

## 6. 시나리오 (호텔 도메인으로 재해석)

### S1 — "방을 카트에 담고 다른 탭에서 비교 중"
- **트리거:** 카트(예약 진행 중) ≥ 1 AND 탭 hidden_for ≥ N초 (N은 BE4가 도출)
- **개입:** 복귀 시 모달 — "방금 보시던 [호텔명] [객실명], 5% 할인 쿠폰을 드립니다 (10분 한정)"

### S2 — "객실 정보를 복사해서 다른 사이트에서 비교 중" ★ 시그니처
- **트리거:** `copy` 이벤트가 객실명/호텔명을 포함 OR BroadcastChannel로 같은 사이트 다중 탭 감지
- **개입:** 화면 상단 배너 — "이 호텔, 다른 사이트보다 ₩XX,XXX 더 저렴합니다 (최저가 보장)"

### Stretch (S3~S5)
- S3 결제 단계 입력 막힘 (#6 #7) → 간편결제 추천
- S4 객실 상세 망설임 (#3 #4) → 리뷰 요약 카드
- S5 PDP↔리뷰↔PDP 비교 루프 (#16) → 비교표

---

## 7. 팀 — 누가 무엇을 한다

> **공통 약속:** 모두 `shared/` 패키지의 타입을 import 한다. 이벤트 스키마·개입 페이로드 변경은 PR로만, **W2 이후 변경은 전원 리뷰 필수**.

### 🎨 FE1 — Tracking SDK + 데모 호텔 사이트

**미션 한 줄:** 평가자가 진짜 호텔 예약하는 것처럼 둘러볼 수 있는 사이트를 만들고, 그 사이트에서 마우스 좌표 없이 행동 신호를 수집한다.

#### 데모 호텔 사이트 (Next.js)
- [ ] 페이지 6종: 홈(검색바) → 검색결과(필터) → 호텔 상세 → 객실 선택 → 예약 입력 → 완료
- [ ] 더미 데이터: 호텔 20개, 객실 타입 3~4종/호텔, 사진은 Unsplash 등 오픈 이미지
- [ ] 더미 결제 (실결제 X) — "예약 확정" 버튼만
- [ ] 모바일 반응형 (P1, 데스크톱 우선)
- [ ] Tracking SDK 통합 (한 줄 스니펫)

#### Tracking SDK (TypeScript)
- [ ] §5 P0 신호 8개 수집 모듈
- [ ] **마우스 좌표는 절대 수집하지 않음** (멘토 피드백 핵심)
- [ ] 배치 전송 (debounce 200ms) + `sendBeacon` (unload 보장)
- [ ] gzipped 10KB 이하, 페이지 로드 영향 < 50ms (Lighthouse 검증)
- [ ] 호환성 fallback (지원 안 되는 브라우저는 no-op)
- [ ] 이벤트 스키마 문서 (`docs/event-schema.md`) 작성 — **BE1과 합의**

**산출물:** `tracking-sdk/dist/hover.min.js`, `demo-hotel-site/`, 이벤트 스키마 문서

---

### 🎨 FE2 — Widget SDK + Admin Dashboard

**미션 한 줄:** 고객이 보는 "개입 위젯"과, 평가자가 보는 "결과 대시보드"를 만든다.

#### Widget SDK (Preact + Shadow DOM)
- [ ] 컴포넌트 2종 필수
  - **쿠폰 모달** (S1): 호텔명·객실명·할인율 동적 표시, 닫기/사용 버튼
  - **최저가 배너** (S2): 상단 슬라이드인, 가격 차액 표시
- [ ] Shadow DOM 격리 (호스트 사이트 CSS 충돌 방지)
- [ ] lazy load — Decision API 응답 받은 뒤에만 로드
- [ ] 첫 렌더 < 200ms
- [ ] 시간 되면: 비교표 위젯, 리뷰 요약 카드 (S5, S4)

#### Admin Dashboard (Next.js + shadcn/ui + Recharts)
- [ ] 페이지 4종
  - **Live** — 라이브 이벤트 스트림 (발표 시 임팩트 큼)
  - **Scenarios** — S1·S2 발화 횟수, 시간대별 차트
  - **A/B** — 개입군 vs 통제군 전환율 비교, 통계 검정 결과
  - **Signals** — 16개 신호 중 수집 현황, 누락 알림
- [ ] BE3 Dashboard API와 연동 (`docs/dashboard-api.md` 합의)

**산출물:** `widget-sdk/`, `admin-dashboard/`, 위젯 페이로드 문서 (`docs/intervention-payload.md`) — **BE2와 합의**

---

### ⚙️ BE1 — Ingestion + Session State + Infra (테크리드)

**미션 한 줄:** SDK가 보낸 이벤트를 안정적으로 받아 큐에 흘리고, 전체 시스템을 한 줄로 띄울 수 있게 만든다.

- [ ] **Ingestion API** (Fastify)
  - POST /events (배치), 스키마 validation (zod 또는 ajv)
  - CORS, rate limit (기본 수준)
- [ ] **Redis Streams** 기반 큐 (XADD/XREAD)
- [ ] **세션 스토어** (Redis Hash, TTL 30분)
  - 세션별 16개 신호 최근 buffer
- [ ] **`docker-compose.yml`** — 전체 시스템 한 번에 기동
- [ ] **monorepo 셋업** (pnpm workspaces, shared 패키지)
- [ ] **GitHub Actions** (lint + type check + test on PR)
- [ ] **README** (재현 가능성 ★) — clone부터 데모까지 5분 안에
- [ ] **테크리드 겸임:** 매주 인터페이스 동기화 미팅 진행

**산출물:** `ingestion-api/`, `docker-compose.yml`, `README.md`, monorepo 구조

---

### ⚙️ BE2 — Rule Engine + Stream + Decision API

**미션 한 줄:** "언제 개입할지"의 두뇌. S1·S2 룰을 실제로 작동시킨다.

- [ ] **Stream Worker** (Node.js, Redis Streams 컨슈머)
- [ ] **룰 엔진** (json-rules-engine 활용)
  - 시나리오를 YAML로 정의 (코드 변경 없이 추가/수정)
- [ ] **S1 룰**: `cart.count >= 1 AND tab.hidden_for >= N` (N은 BE4가 제시)
- [ ] **S2 룰**: `clipboard.copy(matches: hotel|room) OR broadcast_channel.tab_count >= 2`
- [ ] **A/B 분기** (session_id 해시 → control/treatment 50:50)
- [ ] **쿨다운** (동일 시나리오 세션당 1회)
- [ ] **Decision API** (Fastify) — Widget SDK가 호출 시 노출할 개입 반환
- [ ] 룰 발화 결과를 ClickHouse `interventions`에 적재 (BE3 협업)

**산출물:** `stream-worker/`, `decision-api/`, `rules/*.yml`, A/B 분기 검증 노트

---

### ⚙️ BE3 — Analytics + Dashboard API + Simulator

**미션 한 줄:** 모든 이벤트와 개입 결과를 ClickHouse에 적재하고, 대시보드가 쓸 쿼리 API와 발표용 시뮬레이터를 만든다.

- [ ] **ClickHouse 스키마** (§4.3 events / interventions / outcomes)
- [ ] **적재 파이프라인** (Redis Streams → ClickHouse, 배치 INSERT)
- [ ] **PostgreSQL** (룰 정의·메타·시나리오 — 운영 데이터)
- [ ] **Dashboard API** (Fastify)
  - GET /signals/coverage
  - GET /scenarios/firings?from&to
  - GET /ab/results?scenario
  - GET /stream/live (SSE or WebSocket)
- [ ] **합성 트래픽 시뮬레이터** (Node.js 또는 Python)
  - 가상 사용자 1,000명이 데모 호텔 사이트 탐색 시나리오 생성
  - 발표 직전에 돌리면 대시보드가 풍부하게 채워짐 ★
  - 실제 SDK가 보내는 이벤트와 동일한 형식으로 Ingestion에 주입

**산출물:** ClickHouse 스키마, `dashboard-api/`, `simulator/`, 시뮬레이션 시나리오 문서

---

### ⚙️ BE4 — Data Science (Retailrocket / OTTO)

**미션 한 줄:** 공개 데이터셋으로 우리 가설을 숫자로 증명한다. 발표·보고서의 임팩트는 여기서 나온다.

- [ ] **Retailrocket 분석 노트북**
  - 카트 추가 후 N분 시점의 이탈률 곡선 → **S1의 임계 N 도출** (BE2에 전달)
  - "임계치 N 적용 시 잠재 이탈자 X% 커버" 시각화
- [ ] **OTTO 분석 노트북**
  - 세션 길이/이벤트 시퀀스 EDA
  - 호텔 도메인 매핑 가능성 논의 (보고서)
  - **Stretch:** GRU4Rec 또는 SASRec 사전학습으로 다음 행동 예측 정확도 시연
- [ ] **합성 A/B 결과 분석** (BE3 시뮬레이터 데이터)
  - chi-square 또는 t-test로 통계적 유의성 검정
  - 개입군 vs 통제군 전환율 시각화
- [ ] **발표용 도표 패키지** (전원 공동 사용)

**산출물:** `notebooks/01_retailrocket.ipynb`, `notebooks/02_otto.ipynb`, `notebooks/03_ab_synthetic.ipynb`, 발표용 도표 PNG/SVG 묶음, **임계치 N 값 (BE2 input)**

---

## 8. 8주 마일스톤 + 통합 시점

> **통합 시점이 핵심.** 너무 늦으면 인터페이스가 안 맞아서 막판에 무너진다. 매주 금요일 = 통합일.

### W1 (4/29 ~ 5/3) — Kickoff + 인터페이스 동결

- [ ] (전원) 본 PRD v1.0 정독, 질문/이슈 GitHub Issues에 등록
- [ ] (BE1) 모노레포 셋업, docker-compose 골격, GitHub Actions 셋업
- [ ] (BE1+FE1) 이벤트 스키마 v1 합의 → `docs/event-schema.md` 동결
- [ ] (BE2+FE2) 개입 페이로드 v1 합의 → `docs/intervention-payload.md` 동결
- [ ] (BE3+FE2) Dashboard API v1 합의 → `docs/dashboard-api.md` 동결
- [ ] (BE4) Retailrocket·OTTO 다운로드 + 1차 EDA 노트북
- [ ] (FE1) 데모 호텔 사이트 페이지 와이어프레임
- [ ] (FE2) Widget·Dashboard 와이어프레임
- **🔗 W1 종료 시 통합:** `docker compose up` → 빈 ingestion-api와 빈 dashboard 한 번에 뜸

### W2 — 골격 구축

- [ ] (FE1) 데모 호텔 사이트 페이지 6종 정적 마크업 완료
- [ ] (FE1) Tracking SDK P0 신호 4개 (#1, #2, #3, #15) 구현
- [ ] (FE2) Widget SDK 쿠폰 모달 컴포넌트 1종 (Storybook 형태)
- [ ] (FE2) Admin Dashboard 라우팅·레이아웃
- [ ] (BE1) Ingestion API endpoint 동작, Redis Streams 적재 확인
- [ ] (BE2) 룰 엔진 라이브러리 셋업, S1 룰 1차 작성 (임계치 임시값)
- [ ] (BE3) ClickHouse 스키마 + events 테이블 적재 동작
- [ ] (BE4) Retailrocket EDA 1차 결과 공유 (카트→이탈 시간 분포)
- **🔗 W2 종료 시 통합:** 데모 사이트 → SDK → Ingestion → Redis → ClickHouse 한 줄 흐름 검증 (가짜 이벤트라도)

### W3 — 핵심 신호 + S1 룰 작동

- [ ] (FE1) Tracking SDK P0 신호 8개 완료 (#4 #7 #12 #14 추가)
- [ ] (FE1) 데모 사이트 검색→상세→예약 플로우 동작
- [ ] (FE2) 쿠폰 모달 + 최저가 배너 컴포넌트 완성
- [ ] (BE1) 세션 스토어 (Redis Hash) 동작, TTL 검증
- [ ] (BE2) S1 룰 작동 (Stream Worker가 Redis 신호 보고 발화)
- [ ] (BE3) Dashboard API endpoint 4종 동작
- [ ] (BE4) **임계치 N 값 BE2에 전달** (S1 발화 조건 확정)
- **🔗 W3 종료 시 통합:** 데모 사이트에서 카트 추가 → 탭 전환 → 복귀 시 쿠폰 모달이 진짜로 뜸 (S1 E2E 첫 동작)

### W4 — S2 + Go/No-Go 회의

- [ ] (FE1) Tracking SDK P1 신호 4개 추가
- [ ] (FE2) Admin Dashboard Live·Scenarios 페이지 동작
- [ ] (BE2) S2 룰 작동 (clipboard + BroadcastChannel)
- [ ] (BE3) 합성 트래픽 시뮬레이터 v1 (가상 100명)
- [ ] (BE4) OTTO EDA 완료, 호텔 매핑 가능성 보고
- [ ] **(전원) Go/No-Go 회의** — A안 호텔 유지 vs B안 패션 피벗
- **🔗 W4 종료 시 통합:** S1·S2 둘 다 데모 사이트에서 발화. 대시보드에서 발화 카운트 보임.

### W5 — A/B 통계 + 시뮬레이터 풀가동

- [ ] (FE2) Admin Dashboard A/B·Signals 페이지 완성
- [ ] (BE2) A/B 분기 + 쿨다운 검증
- [ ] (BE3) 시뮬레이터 가상 1,000명 동시 시나리오
- [ ] (BE4) **합성 A/B 통계 검정 노트북** 1차 결과
- [ ] (FE1+BE1) Lighthouse로 SDK 영향 측정 (< 50ms 검증)
- **🔗 W5 종료 시 통합:** 시뮬레이터 돌리면 대시보드가 실시간으로 채워지는 모습 시연 가능

### W6 — 전체 시스템 안정화

- [ ] (전원) 버그 수렴 주간
- [ ] (BE4) GRU4Rec/SASRec Stretch (시간 되면)
- [ ] (BE1) `docker compose up` 클린 환경에서 5분 안에 데모까지 검증
- [ ] (FE1) 데모 시나리오 스크립트 작성 (시연용 동선)
- **🔗 W6 종료 시 통합:** 외부 환경(다른 사람 PC)에서 클론 → docker up → 데모까지 5분 안

### W7 — 발표/보고서 집중

- [ ] (전원) 발표 슬라이드 초안 (BE4 도표 활용)
- [ ] (전원) 보고서 초안
- [ ] (FE1) 데모 사이트 시각 디테일 보강 (사진, UX 다듬기)
- [ ] (FE2) 대시보드 시각 다듬기
- [ ] **시연 리허설 1회** — 발표 동선 확정

### W8 — 마무리 + 발표

- [ ] (전원) 발표 리허설 2~3회
- [ ] (전원) 보고서 최종
- [ ] (BE1) README 마무리, GitHub 공개 정리
- [ ] **최종 발표일** — 라이브 시연 권장

---

## 9. 통합·협업 가이드라인

### 9.1 매주 의식 (Rituals)
- **월요일 09:00** — 주간 스탠드업 (15분, 각자 이번 주 목표·블로커)
- **수요일 — 인터페이스 체크인** (필요한 사람만, 30분)
- **금요일 17:00 — 통합일** (전원, §8 마일스톤의 "🔗 통합" 항목 검증)
- **금요일 18:00** — 회고 (이번 주 어땠는지, 다음 주 변경사항)

### 9.2 git 흐름
- `main` 보호, 모든 변경은 PR로
- PR 1개 리뷰어 1명 이상
- **인터페이스 변경 PR (`docs/event-schema.md` 등)은 전원 리뷰 필수**
- 브랜치 명명: `fe1/sdk-visibility`, `be2/s1-rule` 등

### 9.3 인터페이스 합의 문서 (W1 동결, 수정은 PR + 전원 리뷰)
1. `docs/event-schema.md` — FE1 ↔ BE1
2. `docs/intervention-payload.md` — BE2 ↔ FE2
3. `docs/dashboard-api.md` — BE3 ↔ FE2
4. `packages/shared/types.ts` — 위 3개의 TypeScript 타입 단일 출처

### 9.4 의사결정 기록
- 주요 결정은 `docs/adr/` (Architecture Decision Records)에 한 페이지씩 기록
- 예: `001-clickhouse-vs-pinot.md`, `002-redis-streams-vs-kafka.md`

### 9.5 Definition of Done (각 task 공통)
- [ ] 코드 작성 + 타입 통과
- [ ] 최소 1개 테스트 (단위 또는 E2E)
- [ ] 문서 업데이트 (해당되면)
- [ ] PR 머지
- [ ] 다음 의존자에게 알림

---

## 10. 리스크 & 대응

| 리스크 | 신호 | 대응 |
|---|---|---|
| 인터페이스 합의 후 변경 빈발 | 한 주에 schema PR 2개 이상 | 전원 리뷰 강제, ADR 기록 |
| `docker compose up` 깨짐 | 새 PR 머지 후 안 뜸 | BE1이 매주 클린 검증, GitHub Actions에 추가 |
| BroadcastChannel/clipboard 호환성 | 특정 브라우저에서 신호 미수신 | FE1 호환성 매트릭스 + fallback no-op |
| Retailrocket 임계치가 호텔 도메인에 안 맞음 | BE4 분석 결과가 비현실적 N 제시 | 데모용 N은 짧게(예 30초) 임의 조정, 보고서에 한계 명시 |
| OTTO 학습 시간 초과 | 24h 이상 학습 | subset 사용 또는 사전학습 모델 활용 |
| 발표 리허설 시 시연 깨짐 | W7 리허설에서 에러 | 녹화 백업본 W7에 미리 준비 |
| W4 Go/No-Go에서 B안 피벗 | A안 진척도 < 50% | B안은 데모 사이트만 패션으로 교체, 코어는 동일 → 1주 내 전환 가능 |

---

## 11. 다음 단계 (즉시)

1. **PRD v1.0을 모든 팀원이 읽고** 질문/이슈를 GitHub Issues에 등록 (~ 5/2)
2. **W1 Kickoff 미팅 (5/3)** — 역할 확인, 인터페이스 합의 시작
3. **모노레포 + docker-compose 골격 (BE1, ~ 5/3)**
4. **데이터셋 다운로드 + 1차 EDA (BE4, ~ 5/3)**

---

*v1.0 동결. 인터페이스 변경은 PR + 전원 리뷰. — 2026-04-29*
