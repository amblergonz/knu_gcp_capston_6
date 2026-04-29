# ✅ 프로젝트 초기화 완료!

## 🎉 현재 상태

```
✅ README.md                          — 전체 팀원용 프로젝트 개요
✅ docker-compose.yml                 — 전체 시스템 한 줄로 기동
✅ pnpm-workspace.yaml                — 모노레포 설정
✅ package.json (root)                — 공유 스크립트
✅ tsconfig.json                      — TypeScript 설정
✅ .gitignore                         — Git 제외 파일
✅ packages/                          — 10개 패키지 (package.json 포함)
  ✅ tracking-sdk/          [FE1]
  ✅ widget-sdk/            [FE2]
  ✅ demo-hotel-site/       [FE1]
  ✅ admin-dashboard/       [FE2]
  ✅ ingestion-api/         [BE1]
  ✅ stream-worker/         [BE2]
  ✅ decision-api/          [BE2]
  ✅ dashboard-api/         [BE3]
  ✅ simulator/             [BE3]
  ✅ shared/                [전원]
✅ notebooks/                         — 데이터 분석용 폴더 [BE4]
✅ docs/                              — 팀원별 상세 가이드
  ✅ README.md              — 메인 문서 (이미 root README.md와 중복)
  ✅ GITHUB_SETUP.md        — GitHub 연결 및 협력 가이드
  ✅ TEAM_FE1.md            — FE1 상세 로드맵 (8주, W1~W8)
  ✅ TEAM_FE2.md            — FE2 상세 로드맵
  ✅ TEAM_BE1.md            — BE1 상세 로드맵 (테크리드)
  ✅ TEAM_BE2.md            — BE2 상세 로드맵
  ✅ TEAM_BE3.md            — BE3 상세 로드맵
  ✅ TEAM_BE4.md            — BE4 상세 로드맵 (데이터 분석)
✅ PRD_realtime_intervention_v1.0.md  — 원본 PRD (동결)
✅ .git/                              — 로컬 Git 저장소 (첫 커밋 완료)
```

---

## 📁 폴더 구조 요약

```
hover/ (프로젝트 루트)
├── README.md                        ← 모든 팀원이 먼저 읽을 것
├── docker-compose.yml               ← 전체 시스템 한 줄 실행
├── pnpm-workspace.yaml              ← 모노레포 설정
├── package.json
├── tsconfig.json
├── .gitignore
├── PRD_realtime_intervention_v1.0.md ← 공식 사양서 (동결)
│
├── packages/                        ← 모든 코드 (10개 패키지)
│   ├── tracking-sdk/        [FE1] Tracking SDK (TypeScript)
│   ├── widget-sdk/          [FE2] Widget SDK (Preact)
│   ├── demo-hotel-site/     [FE1] Demo 호텔 사이트 (Next.js)
│   ├── admin-dashboard/     [FE2] 관리 대시보드 (Next.js)
│   ├── ingestion-api/       [BE1] 이벤트 수신 API (Fastify)
│   ├── stream-worker/       [BE2] 실시간 처리 + 룰 엔진
│   ├── decision-api/        [BE2] 개입 결정 API (Fastify)
│   ├── dashboard-api/       [BE3] 분석 API (Fastify)
│   ├── simulator/           [BE3] 합성 트래픽 생성
│   └── shared/              [전원] 공유 타입/유틸
│
├── notebooks/               [BE4] Jupyter 분석
│   ├── 01_retailrocket.ipynb
│   ├── 02_otto.ipynb
│   ├── 03_ab_synthetic.ipynb
│   └── 99_export_presentation_charts.ipynb
│
└── docs/                    ← 팀원별 가이드 & 설정
    ├── README.md            (root README.md와 동일)
    ├── GITHUB_SETUP.md      ← GitHub 연결 가이드 👈 읽어야 함
    ├── TEAM_FE1.md          ← FE1 상세 로드맵
    ├── TEAM_FE2.md          ← FE2 상세 로드맵
    ├── TEAM_BE1.md          ← BE1 상세 로드맵
    ├── TEAM_BE2.md          ← BE2 상세 로드맵
    ├── TEAM_BE3.md          ← BE3 상세 로드맵
    └── TEAM_BE4.md          ← BE4 상세 로드맵
```

---

## 🚀 다음 단계 (우선순위순)

### 1️⃣ **GitHub 저장소 생성 & 연결** (BE1 주도)
```bash
# 위치: docs/GITHUB_SETUP.md 읽기
# 실행:
# 1. GitHub에서 "hover" 저장소 생성
# 2. 로컬에서 origin 추가
git remote add origin https://github.com/YOUR_USERNAME/hover.git

# 3. Push
git push -u origin main
```

### 2️⃣ **모든 팀원이 README 읽기**
- 루트 `README.md` — 프로젝트 전체 개요 (5분)
- 자신의 팀 가이드 — `docs/TEAM_[역할].md` (10분)

### 3️⃣ **W1 Kickoff 미팅** (4/29 또는 첫 회의)
- PRD v1.0 정독 + 질문/이슈 등록
- 각자 담당 영역 확인
- Git 워크플로우 숙지

### 4️⃣ **각자 담당 폴더에서 개발 시작**
```bash
# FE1 예시
cd hover/packages/tracking-sdk
git checkout -b fe1/setup
npm install  # 또는 pnpm install
pnpm dev

# ... 개발
git add .
git commit -m "✨ Setup Tracking SDK"
git push origin fe1/setup
# → GitHub에서 PR 생성
```

---

## 📌 중요한 파일 위치

| 파일 | 용도 | 읽어야 할 사람 |
|---|---|---|
| `README.md` | 프로젝트 전체 개요 | 모두 |
| `docs/GITHUB_SETUP.md` | GitHub 연결 방법 | BE1 (테크리드) |
| `docs/TEAM_FE1.md` | FE1 8주 로드맵 | FE1 |
| `docs/TEAM_FE2.md` | FE2 8주 로드맵 | FE2 |
| `docs/TEAM_BE1.md` | BE1 8주 로드맵 + 테크리드 역할 | BE1 |
| `docs/TEAM_BE2.md` | BE2 8주 로드맵 | BE2 |
| `docs/TEAM_BE3.md` | BE3 8주 로드맵 | BE3 |
| `docs/TEAM_BE4.md` | BE4 8주 로드맵 | BE4 |
| `docker-compose.yml` | 전체 시스템 기동 | 모두 (최종 통합 시) |
| `PRD_realtime_intervention_v1.0.md` | 공식 사양서 (동결) | 모두 (참고용) |

---

## ✨ 프로젝트의 핵심

> **"Hover는 호텔 손님이 다른 탭으로 옮겨갈 때 마우스 좌표 추적 없이 그 행동을 감지해서, 1.5초 안에 '지금 이 가격이 최저가입니다' 또는 '방금 보던 객실이 곧 마감됩니다'라는 메시지를 띄워주는 시스템입니다."**

### 핵심 신호 (P0: 8개 필수)
1. 탭 가시성 (Visibility API)
2. 윈도우 포커스
3. 유휴 시간
4. 스크롤 깊이
5. 폼 필드 체류
6. 클립보드 복사
7. BroadcastChannel (다중 탭)
8. 페이지 진입/이탈

### 핵심 시나리오
- **S1:** 카트에 담고 다른 탭에서 비교 중 → 쿠폰 모달
- **S2:** 호텔명 복사해서 비교 중 → 최저가 배너 ⭐

---

## 🎯 8주 일정 (한눈에)

| 주 | 목표 | 통합 포인트 |
|---|---|---|
| **W1** | Kickoff + 인터페이스 동결 | docker compose up 시작 |
| **W2** | 골격 구축 (각 팀 기본 구조) | 이벤트 수집 → 저장 1줄 흐름 |
| **W3** | 신호 완성 + S1 작동 | S1 E2E 첫 발화 |
| **W4** | S2 + Go/No-Go 회의 | S1·S2 둘 다 발화 |
| **W5** | A/B 통계 + 시뮬레이터 가동 | 대시보드 실시간 데이터 채우기 |
| **W6** | 안정화 (외부 PC에서 재현) | 5분 안에 전체 데모 가능 |
| **W7** | 발표/보고서 작성 + 리허설 | 문서 + 슬라이드 완성 |
| **W8** | 최종 발표 | 🎤 라이브 시연 |

---

## 💡 팀 협력 원칙

### ✅ DO
- 모든 변경사항은 **PR로만** (브랜치 → PR → 리뷰 → merge)
- 인터페이스 변경은 **전원 리뷰 필수** (event-schema.md 등)
- **매주 금요일 17:00 통합일** (마일스톤 검증)
- 블로커 발생 시 **즉시 연락** (BE1 테크리드)

### ❌ DON'T
- main 브랜치에 직접 push
- 통보 없이 인터페이스 변경
- 마우스 좌표 수집 ❌

---

## 📞 연락처 & 역할

| 역할 | 담당자 | 연락 | 책임 |
|---|---|---|---|
| **테크리드** | BE1 | 주간 스탠드업 | 인프라 + 통합 + 의사결정 |
| **데이터** | BE4 | notebooks/ | 임계치 + 보고서 데이터 |
| **FE 조율** | FE1 또는 FE2 | 디자인 회의 | 웹 UI 일관성 |
| **전원** | 모두 | GitHub Issues | 기술 질문 |

---

## 🔍 마지막 확인

```bash
# 로컬에서 확인
cd c:\Users\super\Desktop\claude_cap

# Git 상태 확인
git status
git log --oneline

# 폴더 확인
ls packages/          # 10개 모두 있는가?
ls notebooks/         # 분석 폴더 있는가?

# 파일 확인
cat README.md | head  # 메인 문서 읽힘
cat docs/TEAM_FE1.md  # FE1 가이드 읽힘
```

---

## ✅ 다음 회의 어젠다 (첫 Kickoff)

1. **PRD v1.0 정독** (전원 15분)
2. **역할 확인** (각자 자신의 팀 가이드 읽음)
3. **GitHub 설정** (BE1이 주도, origin 설정)
4. **첫 branch 생성** (각자 담당 영역)
5. **W1 미션 가치화** (팀별 체크리스트)

---

## 🎁 보너스: 빠른 명령어 모음

```bash
# 프로젝트 홈으로 이동
cd hover

# 모든 패키지 설치
pnpm install

# 모든 패키지 dev 모드
pnpm dev

# 타입 검증
pnpm type-check

# Docker로 전체 시스템 띄우기 (W2 이후)
docker compose up

# GitHub에 현재 작업 푸시
git add .
git commit -m "✨ [팀] 기능 설명"
git push origin branch-name
```

---

## 🚀 출발 선언

> **당신들의 프로젝트는 이제 시작되었습니다. 8주 후, "Hover"라는 실시간 마케팅 개입 플랫폼은 발표 무대에 서게 될 것입니다. 성공을 기원합니다! 🎯**

---

**프로젝트 시작일:** 2026-04-29  
**마일스톤:** W1 (4/29~5/3) Kickoff  
**상태:** ✅ 초기화 완료 — 준비 끝, 출발 대기 중

---

📧 **질문이나 이슈:** GitHub Issues에 등록  
💬 **팀 협력:** GitHub Discussions 또는 주간 미팅
