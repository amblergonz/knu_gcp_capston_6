# 🎯 Hover — 실시간 마케팅 개입 플랫폼

> **호텔 예약 사이트에서 손님이 이탈하기 전에 최저가를 보장한다**

---

## 📋 프로젝트 개요

**Hover**는 호텔 예약 사이트를 둘러보던 손님이 다른 탭(아고다·부킹닷컴 등)으로 옮겨갈 때, **마우스 좌표 추적 없이** 그 행동을 감지해 1.5초 안에 "지금 이 가격이 최저가입니다" 또는 "방금 보던 객실이 곧 마감됩니다"라는 메시지를 띄워주는 시스템입니다.

| 항목 | 내용 |
|---|---|
| **팀 규모** | FE 2명 + BE 4명 (총 6명) |
| **프로젝트 기간** | 8주 (Capstone) |
| **주요 도메인** | 호텔 예약 |
| **핵심 기술** | BroadcastChannel, Visibility API, Redis Streams, Rule Engine |

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────┐
│  📱 데모 호텔 예약 사이트           │
│  ├─ Tracking SDK (P0: 8개 신호)    │
│  └─ Widget SDK (쿠폰/배너)          │
└──────────┬──────────────────────────┘
           │ Event batch (HTTPS)
           ▼
┌─────────────────────────────────────┐
│  ⚙️ Backend                         │
│  ├─ Ingestion API (Fastify)        │
│  ├─ Redis Streams (Event Queue)    │
│  ├─ Stream Worker + Rule Engine    │
│  ├─ Decision API (개입 발화)       │
│  ├─ ClickHouse (분석)              │
│  └─ Dashboard API                  │
└──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  📊 Admin Dashboard (Next.js)       │
│  ├─ Live Stream                    │
│  ├─ Scenarios                      │
│  ├─ A/B Test Results               │
│  └─ Signals Coverage               │
└─────────────────────────────────────┘
```

---

## 📦 모노레포 구조

```
hover/
├── packages/
│   ├── tracking-sdk/           # FE1 → Tracking SDK (TypeScript)
│   ├── widget-sdk/             # FE2 → Widget SDK (Preact)
│   ├── demo-hotel-site/        # FE1 → 데모 사이트 (Next.js)
│   ├── admin-dashboard/        # FE2 → 관리 대시보드 (Next.js)
│   ├── ingestion-api/          # BE1 → SDK 이벤트 수신 (Fastify)
│   ├── stream-worker/          # BE2 → 실시간 처리 + 룰 엔진
│   ├── decision-api/           # BE2 → 개입 결정 API
│   ├── dashboard-api/          # BE3 → 분석 API (Fastify)
│   ├── simulator/              # BE3 → 합성 트래픽 시뮬레이터
│   ├── shared/                 # ⭐ 공통 타입 (event-schema 등)
│   └── types.ts                # TypeScript 타입 단일 출처
├── notebooks/                  # BE4 → Jupyter 분석
│   ├── 01_retailrocket.ipynb
│   ├── 02_otto.ipynb
│   └── 03_ab_synthetic.ipynb
├── docker-compose.yml          # 전체 시스템 한 번에 기동
├── pnpm-workspace.yaml         # Monorepo 설정
├── package.json
├── tsconfig.json
├── README.md
└── docs/
    ├── event-schema.md         # ⭐ FE1↔BE1 이벤트 스키마
    ├── intervention-payload.md # ⭐ BE2↔FE2 개입 페이로드
    ├── dashboard-api.md        # ⭐ BE3↔FE2 대시보드 API
    └── adr/                    # Architecture Decision Records
        └── 001-redis-vs-kafka.md
```

---

## 👥 팀 구성 & 담당 영역

| 팀원 | 역할 | 주요 산출물 |
|---|---|---|
| **FE1** | Tracking SDK + Demo 호텔 사이트 | `tracking-sdk/`, `demo-hotel-site/`, 이벤트 스키마 |
| **FE2** | Widget SDK + Admin Dashboard | `widget-sdk/`, `admin-dashboard/`, 개입 페이로드 |
| **BE1** | Ingestion API + 인프라 (테크리드) | `ingestion-api/`, `docker-compose.yml`, monorepo 셋업 |
| **BE2** | Rule Engine + Stream Worker | `stream-worker/`, `decision-api/`, 룰 엔진 |
| **BE3** | Analytics + Dashboard API | `dashboard-api/`, `simulator/`, ClickHouse |
| **BE4** | 데이터 분석 | `notebooks/`, 임계치 도출, A/B 통계 검정 |

---

## 🎯 핵심 신호 (P0: 8개 필수)

| # | 신호 | 수집 대상 | 용도 |
|---|---|---|---|
| 1 | 탭 가시성 변화 | Visibility API | S2 트리거 |
| 2 | 윈도우 포커스 | `focus/blur` | 사용자 주의도 |
| 3 | 유휴 시간 | inactivity timeout | S1 트리거 |
| 4 | 스크롤 깊이 | scroll % | 페이지 참여도 |
| 7 | 폼 필드 체류 | input focus time | 망설임 신호 |
| 12 | 클립보드 복사 | `copy` 이벤트 | S2 트리거 (호텔명 복사) |
| 14 | BroadcastChannel | 다중 탭 감지 | S2 비교 행동 |
| 15 | 페이지 진입/이탈 | `sendBeacon` | 세션 경계 |

> **주의:** 마우스 좌표 추적 없음 ❌

---

## 📊 2개의 핵심 시나리오

### S1: "방을 카트에 담고 다른 탭에서 비교 중"
```
트리거: cart.count >= 1 AND 탭 hidden_for >= N초
개입: 복귀 시 쿠폰 모달 → "5% 할인 쿠폰 (10분 한정)"
```

### S2: "객실 정보를 복사해서 다른 사이트에서 비교 중" ⭐ 시그니처
```
트리거: clipboard.copy(호텔명|객실명) OR BroadcastChannel 감지
개입: 화면 상단 배너 → "이 호텔, 다른 사이트보다 ₩XX,XXX 더 저렴"
```

---

## 📅 8주 마일스톤

### W1 (4/29~5/3) — Kickoff + 인터페이스 동결
- ✅ 모노레포 셋업 (BE1)
- ✅ 이벤트 스키마 v1 동결 (FE1↔BE1)
- ✅ 개입 페이로드 v1 동결 (BE2↔FE2)
- 🔗 통합: `docker compose up` → 빈 API 기동

### W2 — 골격 구축
- 📄 데모 사이트 6개 페이지 마크업 (FE1)
- 📡 Tracking SDK P0 신호 4개 구현 (FE1)
- 🎨 Widget 1개 컴포넌트 (FE2)
- ⚙️ Ingestion API 동작 (BE1)
- 📊 ClickHouse 스키마 생성 (BE3)
- 🔗 통합: 이벤트 수집 → 저장 한 줄 흐름

### W3 — 핵심 신호 + S1 작동
- 🔔 P0 신호 8개 완료 (FE1)
- 🎨 쿠폰 모달 + 배너 완성 (FE2)
- 🎬 S1 룰 작동 (BE2)
- 🔗 통합: S1 E2E 첫 발화

### W4 — S2 + Go/No-Go 회의
- 🎬 S2 룰 작동 (BE2)
- 📊 Admin Dashboard Live·Scenarios (FE2)
- 🤖 합성 트래픽 시뮬레이터 v1 (BE3)
- 🔬 Retailrocket 임계치 도출 (BE4)
- **결정:** A안 호텔 유지 vs B안 패션 피벗
- 🔗 통합: S1·S2 둘 다 발화

### W5 — A/B 통계
- 📊 Dashboard A/B 페이지 (FE2)
- 🤖 시뮬레이터 1,000명 가동 (BE3)
- 📈 A/B 통계 검정 (BE4)
- 🔗 통합: 시뮬레이터 → 대시보드 실시간 채우기

### W6 — 안정화
- 🐛 버그 수렴
- 🔗 통합: 외부 PC에서 `docker compose up` → 5분 안 데모 가능

### W7 — 발표/보고서
- 📃 발표 슬라이드 + 보고서 초안
- 🎬 시연 리허설 1회

### W8 — 최종 발표
- 🎬 시연 리허설 2~3회
- 🎤 최종 발표

---

## 🚀 Quick Start

### 1️⃣ 의존성 설치
```bash
# Node 20 LTS 필요
node --version  # v20.x

# pnpm 설치
npm install -g pnpm

# 의존성 설치
pnpm install
```

### 2️⃣ 전체 시스템 기동 (docker compose)
```bash
docker compose up
```

**접근:**
- 📱 데모 호텔 사이트: http://localhost:3000
- 📊 관리 대시보드: http://localhost:3001
- 📡 Ingestion API: http://localhost:4000
- ⚙️ Decision API: http://localhost:4001
- 🔍 ClickHouse: http://localhost:8123

### 3️⃣ 개발 모드 (로컬)
```bash
# 모든 패키지 watch 모드
pnpm dev

# 또는 특정 패키지
cd packages/demo-hotel-site
pnpm dev
```

---

## 📐 개발 규칙

### 인터페이스 합의 (W1 동결, 수정은 PR 리뷰 필수)
1. `docs/event-schema.md` — FE1 ↔ BE1
2. `docs/intervention-payload.md` — BE2 ↔ FE2
3. `docs/dashboard-api.md` — BE3 ↔ FE2
4. `packages/shared/types.ts` — TypeScript 단일 출처

### Git 워크플로우
```bash
# 브랜치 생성 (팀 이름 + 기능)
git checkout -b fe1/sdk-visibility
git checkout -b be2/s1-rule

# Commit
git add .
git commit -m "✨ Implement Visibility API tracking"

# Push & Pull Request
git push origin fe1/sdk-visibility
# → GitHub에서 PR 생성 (최소 1명 리뷰)
```

### 매주 의식
- **월 09:00** — 스탠드업 (15분)
- **수** — 인터페이스 체크인 (필요 시, 30분)
- **금 17:00** — 통합일 (전원, 마일스톤 검증)
- **금 18:00** — 회고 (15분)

---

## 📚 주요 문서

| 문서 | 담당 | 용도 |
|---|---|---|
| [event-schema.md](./docs/event-schema.md) | FE1↔BE1 | 이벤트 포맷 정의 |
| [intervention-payload.md](./docs/intervention-payload.md) | BE2↔FE2 | 개입 응답 포맷 |
| [dashboard-api.md](./docs/dashboard-api.md) | BE3↔FE2 | 분석 API 스펙 |
| [PRD_realtime_intervention_v1.0.md](./PRD_realtime_intervention_v1.0.md) | 전원 | 프로젝트 완전 정의 |

---

## 🔐 데이터 & 프라이버시

- ✅ 마우스 좌표 **미수집**
- ✅ 사용자 신원 감지 없음 (세션 기반만)
- ✅ 합성 데이터 사용 (데모 단계)
- ✅ 옵트인 UX 기본 제공

> **보고서에 명시:** 실서비스 GDPR/PIPA 풀 컴플라이언스는 스코프 외

---

## 📊 공개 데이터셋 (분석용)

| 데이터셋 | 출처 | 용도 |
|---|---|---|
| Retailrocket | Kaggle | S1 임계치 도출 |
| OTTO Recommender | Kaggle (CC-BY 4.0) | 세션 분석, 예측 모델 |
| H&M Personalized Fashion | Kaggle | B안(패션) 피벗 대비 |

> 다운로드 및 분석: `notebooks/` 디렉토리

---

## ⚠️ 주요 리스크 & 대응

| 리스크 | 신호 | 대응 |
|---|---|---|
| 인터페이스 변경 빈발 | 주 2개 이상 schema PR | PR 전원 리뷰 강제 |
| docker compose 깨짐 | 새 PR 후 로컬 안 뜸 | BE1 주간 클린 검증 |
| 브라우저 호환성 | 신호 미수신 | 호환성 매트릭스 + fallback |
| 발표 시연 실패 | W7 리허설 에러 | W7에 녹화 백업본 준비 |

---

## 🔄 팀 간 협업 체크리스트

### W1 Kickoff 전
- [ ] 모든 팀원이 이 README 읽음
- [ ] PRD v1.0 정독, 질문은 GitHub Issues에
- [ ] 개발 환경 설정 완료 (Node 20, Docker)
- [ ] GitHub 계정 준비

### 매주 토요일 밤 (다음주 준비)
- [ ] 다음주 담당 작업 예측
- [ ] 블로커 미리 식별
- [ ] 인터페이스 변경 필요시 이슈 등록

---

## 📞 연락처 & 리소스

| 역할 | 담당자 | 채널 |
|---|---|---|
| **테크리드** | BE1 | GitHub Issues, 주간 미팅 |
| **데이터 담당** | BE4 | notebooks/, 통계 PR |
| **FE 리드** | FE1/FE2 중 합의 | 웹UI 결정 |

---

## 📄 라이센스

이 프로젝트는 학기 캡스톤 프로젝트입니다. 
- 코드: MIT
- 데이터: Kaggle 데이터셋 원 라이센스 준수

---

**마지막 업데이트:** 2026-04-29  
**버전:** v1.0 (동결)  
**상태:** 🚀 Kickoff 준비 중

> 💡 **팀원들을 위한 한 문장:**  
> 우리가 만드는 것은 호텔 손님이 "다른 탭을 깐다"는 행동을 감지해서 1.5초 안에 "최저가입니다"라고 말해주는 시스템이다.
