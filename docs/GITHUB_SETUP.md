# 🚀 GitHub 연결 가이드

## 📌 현재 상태

✅ 로컬 Git 저장소 초기화 완료  
✅ 첫 커밋 생성: "🎯 Init: Project structure, monorepо setup, and team guides"  
✅ 모노레포 구조 및 6개 팀원별 가이드 작성 완료

---

## 1️⃣ GitHub에 Main Repository 생성

### A. GitHub에서 새 저장소 만들기

1. **GitHub (https://github.com) 로그인**
2. **우측 상단 "+" → "New repository"** 클릭
3. **저장소 정보 입력:**
   ```
   Repository name:        hover
   Description:            Real-time marketing intervention platform for hotel booking
   Visibility:             Public (또는 Private)
   Initialize repository:  ❌ No (이미 로컬에서 git init 했음)
   ```
4. **"Create repository"** 클릭

### B. 로컬에서 GitHub 원격 추가

```bash
cd c:\Users\super\Desktop\claude_cap

# GitHub 원격 저장소 추가 (YOUR_USERNAME을 실제 GitHub 계정명으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/hover.git

# main 브랜치로 이름 변경 (또는 master 유지)
git branch -M main

# Push!
git push -u origin main
```

> **예:** 계정명이 `john-doe`면:  
> `git remote add origin https://github.com/john-doe/hover.git`

### C. 확인
```bash
# 원격 저장소 확인
git remote -v

# 출력:
# origin  https://github.com/YOUR_USERNAME/hover.git (fetch)
# origin  https://github.com/YOUR_USERNAME/hover.git (push)
```

---

## 2️⃣ 팀원별 Repository 구조 (선택사항)

### 옵션 A: 단일 Main Repo (권장 ✅)
```
GitHub 계정/
└── hover (monorepo 통합)
    ├── packages/
    │   ├── tracking-sdk/          # FE1 담당
    │   ├── widget-sdk/            # FE2 담당
    │   ├── demo-hotel-site/       # FE1 담당
    │   ├── admin-dashboard/       # FE2 담당
    │   ├── ingestion-api/         # BE1 담당
    │   ├── stream-worker/         # BE2 담당
    │   ├── decision-api/          # BE2 담당
    │   ├── dashboard-api/         # BE3 담당
    │   ├── simulator/             # BE3 담당
    │   └── shared/                # 전원
    └── notebooks/                 # BE4 담당
```

**장점:**
- 모든 코드가 한곳 (타입 공유 쉬움)
- 통합 테스트 간단
- 단일 CI/CD

**Git 워크플로우:**
```bash
# FE1이 tracking-sdk 개발할 때
git checkout -b fe1/tracking-sdk
cd packages/tracking-sdk
# ... 개발
git add .
git commit -m "✨ Add visibility tracking"
git push origin fe1/tracking-sdk
# → GitHub에서 PR 생성
```

---

### 옵션 B: 팀별 개별 Repo (선택사항)

6개 저장소 생성:
1. `hover-fe1` — Tracking SDK + Demo Site
2. `hover-fe2` — Widget SDK + Admin Dashboard
3. `hover-be1` — Ingestion API + 인프라
4. `hover-be2` — Stream Worker + Decision API
5. `hover-be3` — Dashboard API + Simulator
6. `hover-be4` — Notebooks (분석)

**장점:**
- 팀원별 독립성 높음
- 각자 담당 영역 소유

**단점:**
- 타입 공유 복잡
- 통합 테스트 어려움
- 멀티레포 관리 (사용 비권장)

---

## 3️⃣ GitHub 설정 (Main Repo 기준)

### Collaborators 추가

1. **Settings → Collaborators**
2. "Add people" 클릭
3. 6명 팀원의 GitHub 아이디 입력
4. "Owner" 또는 "Maintain" 권한 부여

### Branch Protection (선택사항)

1. **Settings → Branches**
2. "Add rule" → "main"
3. 설정:
   - ✅ Require pull request reviews
   - ✅ Dismiss stale pull request approvals
   - ✅ Require branches to be up to date

---

## 4️⃣ 각 팀원의 첫 번째 작업

### 모든 팀원이 수행할 일

```bash
# 1. 저장소 클론
git clone https://github.com/YOUR_USERNAME/hover.git
cd hover

# 2. 브랜치 생성 (팀 이름 + 역할)
git checkout -b fe1/setup         # FE1: Tracking SDK 셋업
git checkout -b fe2/setup         # FE2: Widget SDK 셋업
git checkout -b be1/infra-setup   # BE1: 인프라
git checkout -b be2/rules-engine  # BE2: 룰 엔진
git checkout -b be3/clickhouse    # BE3: ClickHouse
git checkout -b be4/analysis      # BE4: 데이터 분석

# 3. 의존성 설치 (각자 담당 폴더)
cd packages/tracking-sdk
pnpm install  # 또는 npm install

# 4. 개발 시작
pnpm dev

# 5. 변경 커밋
git add .
git commit -m "🔧 Setup TypeScript + DevServer"
git push origin fe1/setup

# 6. GitHub에서 PR 생성
# → "Create Pull Request" 버튼 클릭
# → 설명 추가
# → 최소 1명 리뷰 요청
# → Merge (BE1 또는 테크리드)
```

---

## 5️⃣ 주간 Git 룰

### 브랜치 네이밍 규칙
```
{team}/{feature}

fe1/sdk-visibility
fe2/coupon-modal
be1/redis-setup
be2/s1-rule
be3/clickhouse-schema
be4/retailrocket-analysis
```

### Commit 메시지 규칙
```
{emoji} {Type}: {Description}

✨ feat: Add visibility API tracking
🐛 fix: Handle clipboard permission error
♻️ refactor: Reorganize rule engine structure
📚 docs: Update event-schema.md
🧪 test: Add unit tests for S1 rule
🔧 chore: Update dependencies
```

### PR 제목
```
[FE1] Add Tracking SDK visibility event
[BE2] Implement S1 rule engine
[BE3] Setup ClickHouse schema
```

### 매주 금요일 통합 프로세스
1. 모든 팀원이 자신의 PR 최종 확인
2. BE1(테크리드)이 전원 리뷰 체크
3. main 브랜치에 merge
4. `docker compose up` 통합 테스트

---

## 6️⃣ GitHub로 협력하는 팁

### Issue 생성

```markdown
# [BE1] Ingestion API 엔드포인트 설계

## 문제
FE1이 이벤트를 어디로 보낼지 모름

## 해결책
/events 엔드포인트 설계

## 체크리스트
- [ ] Endpoint 명세
- [ ] Zod 스키마
- [ ] Redis 통합
```

### Milestone 생성

1. Settings → Milestones → New milestone
2. W1, W2, W3, ... W8 생성
3. 각 이슈/PR을 해당 주에 할당

### Discussion 활용

1. "Issues" → "Discussions" 탭
2. 설계/아이디어 토론
3. 의사결정 기록

---

## 7️⃣ 로컬 개발 후 Push 체크리스트

### Push 전
- [ ] 코드 작동 확인 (로컬 테스트)
- [ ] Lint + Type check 통과
- [ ] `.gitignore` 확인 (node_modules, .env 등)
- [ ] 커밋 메시지 명확

### Push 후
```bash
# PR 생성 전에 최신 커밋 확인
git log --oneline -5

# 예상 출력:
# a1b2c3d ✨ Add visibility tracking
# e4f5g6h 📚 Update event-schema docs
# i7j8k9l 🧪 Add test for visibility
```

---

## 8️⃣ GitHub Actions (CI/CD 자동화)

### 기본 CI 워크플로우

`.github/workflows/ci.yml` 생성 (BE1이 담당):

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Lint
        run: pnpm lint
      
      - name: Type check
        run: pnpm type-check
      
      - name: Test
        run: pnpm test --if-present
```

**효과:** 모든 PR에서 자동으로 lint + type check 실행!

---

## 📞 문제 해결

### 1. "origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/hover.git
```

### 2. "Permission denied (publickey)"
SSH 키 설정 필요:
```bash
# GitHub → Settings → SSH and GPG keys → New SSH key
# 또는 HTTPS 사용:
git remote set-url origin https://github.com/YOUR_USERNAME/hover.git
```

### 3. "main 브랜치인데 master로 표시"
```bash
git branch -M main
git push -u origin main
```

### 4. "대용량 파일 실수로 커밋"
```bash
# .gitignore에 추가 후
git rm --cached <filename>
git commit --amend --no-edit
git push -f origin <branch>  # 주의: force push
```

---

## ✅ 다음 단계

1. **GitHub 계정 준비** (아직 없으면)
2. **"hover" 저장소 생성** (위 1️⃣절차)
3. **로컬에서 `git push` 실행**
4. **https://github.com/YOUR_USERNAME/hover 확인**
5. **6명 팀원 Collaborators로 추가**
6. **각자 담당 브랜치 생성 후 W1 개발 시작**

---

**당신의 GitHub 저장소가 팀의 협력 중심입니다! 🚀**
