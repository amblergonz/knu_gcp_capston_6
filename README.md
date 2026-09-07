# Hover — 실시간 이탈 개입 플랫폼

> 호텔 예약 사이트에서 손님이 떠나기 전에, 세션이 살아 있는 동안 되돌린다

호텔을 고르던 손님이 다른 예약 사이트로 옮겨가는 순간을 **마우스 좌표 추적 없이** 감지해,
탭이 살아 있을 때 쿠폰 모달이나 최저가 배너를 띄우는 시스템입니다.

GA류 사후 퍼널 분석은 이미 떠난 손님을 되돌리지 못하고,
쿠팡·테무식 리타게팅은 이탈 후 분~일 뒤에 도착합니다. Hover는 **세션 안에서** 개입합니다.

| 항목 | 내용 |
|---|---|
| 팀 규모 | FE 2명 + BE 4명 |
| 기간 | 8주 (Capstone) |
| 도메인 | 호텔 예약 |
| 핵심 기술 | Visibility API · BroadcastChannel · Redis Streams · json-rules-engine · Gemini 2.5 Flash |

---

## 현재 상태

동작하는 것과 아직 아닌 것을 구분해 둡니다.

| 영역 | 상태 |
|---|---|
| 데모 호텔 사이트 6페이지 | 동작 |
| 행동 신호 16종 수집 | 동작 |
| 부스터 12종 · 점수 판정 | 동작 |
| S1 쿠폰 모달 · S2 가격비교 배너 | 동작 (E2E 검증) |
| 할인율 차등 5 / 10 / 15% | 동작 |
| 운영 튜닝 콘솔 (배포 없이 조정) | 동작 |
| Gemini 문구 생성 | 동작 (키 없으면 고정 문구로 폴백) |
| 어드민 대시보드 실시간 집계 | 동작 |
| 전환율 A/B 검증 | **미측정** — 실사용 세션 필요 |
| 분석 파이프라인 (ClickHouse) | **미구현** — 설계만 존재 |
| 워커 수평 확장 | **불가** — consumer group 미도입, 단일 인스턴스만 |

---

## 시스템 구성

```
브라우저 (데모 사이트 :3000)
   │  POST /events            16종 이벤트 배치
   ▼
ingestion-api :4000  ──XADD──▶  events_stream
                                     │  XREAD BLOCK 5s
                                     ▼
                              stream-worker
                              부스터 적립 · 점수 합산 · 임계치 판정
                                     │  SETEX pending:{sid}
                                     ▼
브라우저 ◀── 200/204 ── decision-api :4001
   폴링 300ms · 최대 8초

dashboard-api :4002   집계 + 신호 튜닝 설정
어드민 대시보드 :3001
```

**저장소는 Redis 하나입니다.** 네 서비스는 서로를 직접 호출하지 않고 전부 Redis를 통해 만납니다.
개입 전달은 푸시가 아니라 폴링이고, `decision-api`는 응답을 보내기 전에 키를 지웁니다 (원샷).

---

## 모노레포 구조

```
hover/
├── packages/
│   ├── demo-hotel-site/     데모 예약 사이트 + 트래킹 레이어 + 개입 위젯 (Next.js)
│   ├── admin-dashboard/     관리 대시보드 (Next.js)
│   ├── ingestion-api/       이벤트 수집 (Fastify)
│   ├── stream-worker/       룰 엔진 · 개입 판정
│   ├── decision-api/        개입 전달 (Fastify)
│   ├── dashboard-api/       집계 + 설정 API (Fastify)
│   ├── simulator/           부하 생성기
│   └── shared/config/       thresholds.yml (룰 기준값)
├── notebooks/               데이터 분석 (Retailrocket · OTTO)
├── docs/
└── docker-compose.yml
```

---

## 행동 신호

**16종을 수집하고, 그중 12종이 판정에 관여합니다.**

| 역할 | 이벤트 |
|---|---|
| 부스터 소스 (10) | `clipboard_copy` · `broadcast_channel` · `external_link` · `visibility_change` · `form_field` · `search_query` · `wishlist_add` · `scroll_depth` · `idle` · `window_focus` |
| 장바구니 상태 (2) | `add_to_cart` · `cart_change` — S1의 통과 조건 |
| 수집만 (4) | `page_view` · `click` · `scroll` · `page_lifecycle` |

**마우스 좌표는 어디서도 수집하지 않습니다.** `mousemove` · `clientX` · `clientY` 사용처 0건.
유휴 판정의 리셋 소스에서도 제외했습니다.

### 부스터 가중치

`packages/shared/config/thresholds.yml`

| 티어 | 부스터 | 가중치 |
|---|---|---|
| 고관여 | 호텔명 복사 · 멀티탭 비교 · 외부 예약사이트 클릭 | 0.30 |
| 고관여 | 탭 반복 이탈 | 0.25 |
| 중간 | 결제 폼 8초 이상 체류 | 0.20 |
| 중간 | 가격비교 유입 · 반복 검색 · 찜하기 | 0.15 |
| 앰비언트 | 5분 이상 체류 | 0.10 |
| 앰비언트 | 깊은 스크롤 · 유휴 진입 · 포커스 이탈 | 0.05 |

intent 점수는 활성 부스터 가중치의 **단순 합**입니다. 머신러닝 확률값이 아닙니다.

**설계 원칙 — 단일 신호로는 어떤 시나리오도 발화하지 않습니다.**
최대 단일 부스터 0.30 < 최저 임계치 0.42이고,
일반 탐색 신호를 전부 합쳐도 0.40이라 두 임계치 모두 넘지 못합니다.

---

## 개입 시나리오

### S1 — 카트 이탈 → 쿠폰 모달

```
장바구니 2개 이상  AND  탭 숨김 20초 이상  AND  intent >= 0.52
```

### S2 — 비교 탐색 → 최저가 배너

```
(호텔명 복사 OR 멀티탭 OR 외부 예약사이트) AND intent >= 0.42
```

### 할인율 차등

이탈 의도가 강할수록 잃을 위험이 크므로 더 큰 혜택을 줍니다.

| intent | 할인 | 쿠폰 코드 |
|---|---|---|
| 0.52 – 0.62 | 5% | `HOVER5` |
| 0.63 – 0.77 | 10% | `HOVER10` |
| 0.78 이상 | 15% | `HOVER15` |

### 발화 제한

세션당 최대 2회 · 시나리오별 쿨다운 24시간 · 익명 세션 30분 만료.
A/B `control` 그룹은 개입이 생성되어도 화면에 표시하지 않습니다.

---

## 실행

### Docker

```bash
cp .env.example .env      # GEMINI_API_KEY 를 채우면 문구가 LLM 생성으로 바뀝니다
docker compose up
```

| 서비스 | 주소 |
|---|---|
| 데모 호텔 사이트 | http://localhost:3000 |
| 관리 대시보드 | http://localhost:3001 |
| Ingestion API | http://localhost:4000 |
| Decision API | http://localhost:4001 |
| Dashboard API | http://localhost:4002 |

### 로컬 (Docker 없이)

```bash
# Redis 가 :6379 에 떠 있어야 합니다
bash scripts/dev-backend.sh                        # 백엔드 4종

cd packages/demo-hotel-site && pnpm install && pnpm dev
cd packages/admin-dashboard && pnpm install && pnpm dev
```

> **stream-worker 는 단일 인스턴스만 실행하세요.**
> consumer group 없이 `XREAD` 하므로 두 개를 띄우면 개입이 중복 발화합니다.

---

## 시연

데모 사이트 우측의 **SIGNAL** 손잡이(또는 `Ctrl` + `` ` ``)를 열면
신호 적립·intent 점수·발화 조건이 실시간으로 보입니다.

**S2 — 가격비교 배너**

1. 장바구니를 비운 채 호텔 상세 페이지로 이동
2. 호텔명을 클릭해 전체 선택하고 `Ctrl+C` → 점수만 오르고 아무 일도 일어나지 않음
3. 가격비교 표에서 외부 예약사이트 클릭 → 배너 발화

**S1 — 쿠폰 모달**

1. `http://localhost:3000/?ref=google.com` 으로 진입
2. 객실 2개를 장바구니에 담기
3. 상세 페이지를 끝까지 스크롤, 결제 폼에서 8초 이상 머무르기
4. 탭을 전환해 20초 이상 이탈 후 복귀 → 쿠폰 모달 발화
5. 쿠폰 받기 → 체크아웃 쿠폰란에 코드가 채워지고 결제 금액에서 실제 차감

> S1이 우선순위가 높지만 **시간상 먼저 조건이 충족되는 쪽이 나갑니다.**
> 호텔명을 복사하면 그 순간 S2가 발화하므로, S1을 보려면 복사 없이 진행하세요.
> 같은 세션에서 다시 보려면 SIGNAL 패널의 **새 세션 시작**을 누릅니다 (쿨다운 24시간).

### 운영 튜닝 콘솔

SIGNAL 패널의 **신호 튜닝** 섹션에서 신호를 끄거나 가중치·임계치·할인 구간을 바꾸고 저장하면,
**배포도 재시작도 없이 최대 5초 안에** 워커 판정에 반영됩니다.

기준값은 `thresholds.yml`에 남고 조정값만 Redis에 저장되므로, **기본값 복원**으로 언제든 되돌아갑니다.

---

## 검증

```bash
# 부스터 12종 발동 + S1/S2 실발화 + 원샷 응답 자동 검증
node packages/stream-worker/scripts/smoke-be-c.js

# 타입 체크 · 빌드
cd packages/demo-hotel-site && pnpm type-check && pnpm build
```

스모크 테스트는 부스터 12종이 각각 실제로 발동하는지 확인합니다.
워커와 프론트 미러가 같은 분기를 각각 구현하고 있어서, 한쪽만 고치면 조용히 어긋나기 때문입니다.

---

## 문서

| 문서 | 내용 |
|---|---|
| [docs/발표자료_해설.md](./docs/발표자료_해설.md) | 설계 문서·포스터 해설, 숫자 치트시트, 예상 질문 답변 |
| [docs/FE_HANDOFF.md](./docs/FE_HANDOFF.md) | 프론트엔드 연동 가이드 |
| [docs/BE-C_WORK.md](./docs/BE-C_WORK.md) | 스트림 워커 작업 내역 |
| [PRD_realtime_intervention_v1.0.md](./PRD_realtime_intervention_v1.0.md) | 프로젝트 정의 |
| `notebooks/` | Retailrocket 176,661 세션 분석 — 가중치 근거 |

---

## 팀

| 팀원 | 담당 |
|---|---|
| FE1 | 데모 사이트 · 트래킹 레이어 |
| FE2 | 개입 위젯 · 관리 대시보드 |
| BE1 | Ingestion API · 인프라 |
| BE2 | 룰 엔진 · 스트림 워커 · Decision API |
| BE3 | 집계 · Dashboard API · 시뮬레이터 |
| BE4 | 데이터 분석 · 임계치 도출 |

테크리드 BE1 · 데이터 담당 BE4. 논의는 GitHub Issues와 주간 미팅에서 진행합니다.

---

## 한계

- **전환 효과 미측정** — 합성 A/B는 랜덤 분할이라 개입 효과를 분리할 수 없습니다. 실사용 A/B가 필요합니다.
- **복사·멀티탭 가중치의 데이터 근거 부족** — Retailrocket에 해당 신호가 없어 상대 순위로 배치했습니다.
- **워커 수평 확장 불가** — consumer group 도입이 선행돼야 합니다.
- **전환 추적 없음** — 구매 귀속이 없어 CTR·전환율을 계산하지 않습니다.
- **설정 API 무인증** — `:4002`는 데모 전용입니다. `CONFIG_WRITE_TOKEN`으로 잠글 수 있으나 기본은 열려 있습니다. localhost 밖으로 노출하지 마세요.

---

## 라이센스

학기 캡스톤 프로젝트입니다.

- 코드: 강원대학교
- 데이터: Kaggle 데이터셋 원 라이센스 준수
