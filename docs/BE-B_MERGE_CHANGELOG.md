# BE-B 코드 통합 변경사항

> 원본: https://github.com/Kwonsoonil123/AnalShop_backend  
> 통합일: 2026-05-18  
> 커밋: `17bba4c`

단순 복사가 아니라 Hover 프로젝트 구조에 맞게 **상당 부분을 수정·보완**하였다.

---

## 1. 구조 변경

### 패키지 분리 (AnalShop → Hover)

AnalShop은 3개 패키지에 모든 코드를 몰아넣었으나, Hover는 역할별로 분리한다.

| AnalShop_backend | Hover (claude_cap) |
|---|---|
| `packages/realtime-core/src/ingestion.js` | `packages/ingestion-api/src/index.js` |
| `packages/realtime-core/src/worker.js` | `packages/stream-worker/src/worker.js` |
| `packages/realtime-core/src/decision.js` | `packages/decision-api/src/index.js` |
| `packages/data-infra/src/index.js` | `packages/dashboard-api/src/index.js` |
| `packages/data-infra/src/simulator.js` | `packages/simulator/src/simulator.js` |
| `packages/data-science/main.py` | `packages/data-science/main.py` |

### Dockerfile 분리

AnalShop은 하나의 Dockerfile로 모든 서비스를 빌드했으나, Hover는 각 패키지가 독립 Dockerfile을 가진다.

```
# AnalShop: 모노레포 루트에서 한 번에 빌드
packages/realtime-core/Dockerfile  # ingestion + worker + decision 모두 처리

# Hover: 패키지별 독립 빌드
packages/ingestion-api/Dockerfile
packages/stream-worker/Dockerfile
packages/decision-api/Dockerfile
packages/dashboard-api/Dockerfile
```

---

## 2. 포트 번호 변경

Hover의 `docker-compose.yml` 기준으로 통일.

| 서비스 | AnalShop 포트 | Hover 포트 |
|---|---|---|
| Ingestion API | 3000 | **4000** |
| Decision API | 3002 | **4001** |
| Dashboard API | 3001 | **4002** |
| Model API | 8000 | 8000 (동일) |

---

## 3. 패키지 매니저 변경

| 항목 | AnalShop | Hover |
|---|---|---|
| 패키지 매니저 | npm (package-lock.json) | pnpm (pnpm-workspace.yaml) |
| 모듈 시스템 | CommonJS (`require`) | CommonJS 유지 (TypeScript 전환 보류) |
| TypeScript | 미사용 | scaffold는 TS였으나 JS 직접 사용 |

> Hover scaffold의 각 package.json은 TypeScript + ts-node 설정이었으나,  
> AnalShop 코드가 CommonJS JS이므로 `"type": "module"` 제거 + TS 의존성 제거 후 JS 직접 실행.

---

## 4. 코드별 주요 변경사항

### ingestion-api

| 항목 | AnalShop 원본 | Hover 변경 |
|---|---|---|
| 포트 | `3000` | `process.env.PORT \|\| 4000` |
| 응답 코드 | `200 OK` (암묵적) | `202 Accepted` (API Spec 준수) |
| 입력 검증 | 없음 | `session_id`, `events` 누락 시 400 반환 |

### stream-worker

AnalShop 원본은 **테스트용 mock**이었음. Hover에서 실제 룰 엔진으로 교체.

| 항목 | AnalShop 원본 | Hover 변경 |
|---|---|---|
| 판단 로직 | 하드코딩된 mock intervention 항상 생성 | `json-rules-engine` 으로 실제 룰 평가 |
| 룰 | 없음 | `visibility_change + hidden=true` → 이탈 감지 |
| 스트림 시작점 | `$` 고정 (재시작 시 처음부터 못 읽음) | `lastId` 추적으로 처리 위치 유지 |
| A/B 그룹 | 항상 `treatment` | 50% 랜덤 `treatment` / `control` |

```javascript
// AnalShop 원본 — 무조건 mock 생성
const mockIntervention = { ... };
await redis.setex(`pending:${session_id}`, 300, JSON.stringify(mockIntervention));

// Hover — json-rules-engine으로 실제 판단
const { events } = await engine.run(facts);
if (events.some((e) => e.type === 'exit_intent_detected')) {
  await createIntervention(session_id);
}
```

### decision-api

| 항목 | AnalShop 원본 | Hover 변경 |
|---|---|---|
| 라우트 파라미터 | `:id` | `:session_id` (API Spec 준수) |
| 포트 | `3002` | `4001` |

### dashboard-api

AnalShop 원본에는 `/stream/live` heartbeat만 있었고, API Spec에 있는 나머지 엔드포인트가 **미구현** 상태였음.

| 엔드포인트 | AnalShop 원본 | Hover 변경 |
|---|---|---|
| `GET /stream/live` | 5초 heartbeat만 | heartbeat + **Redis Stream 실시간 폴링** 추가 |
| `GET /signals/coverage` | **없음** | 16개 신호별 카운트 반환 (mock) 추가 |
| `GET /scenarios/firings` | **없음** | 시나리오별 발화 통계 반환 (mock) 추가 |
| 포트 | `3001` | `4002` |

```javascript
// AnalShop 원본 — heartbeat만
const interval = setInterval(() => {
  reply.raw.write(`data: ${JSON.stringify({ ts: Date.now(), event: 'heartbeat' })}\n\n`);
}, 5000);

// Hover — Redis Stream 실시간 구독 추가
const poll = async () => {
  const result = await subscriber.xread('BLOCK', 4000, 'STREAMS', 'events_stream', lastId);
  if (result) {
    // 새 이벤트 발생 시 SSE로 브로드캐스트
    send({ ts: Date.now(), event: 'new_event', session_id: fields[1] });
  }
  if (!reply.raw.writableEnded) poll();
};
```

### simulator

AnalShop 원본은 **뼈대만 있는 미완성 코드** (실제 HTTP 요청 없음).

| 항목 | AnalShop 원본 | Hover 변경 |
|---|---|---|
| 구현 상태 | `console.log`만 있는 skeleton | 실제 POST /events 요청 발송 |
| 이벤트 생성 | 없음 | 랜덤 이벤트 3~6개 + 마지막 `visibility_change` |
| 세션 ID | 없음 | `uuid` 기반 고유 세션 ID |
| 환경변수 | `INGESTION_URL` | `INGESTION_URL` + `USER_COUNT` |

```javascript
// AnalShop 원본
async function simulateUser(id) {
  console.log(`Simulating user ${id}...`);
  // Simulation logic to be implemented
}

// Hover — 실제 이벤트 발송
async function simulateUser(userId) {
  const session_id = `sim-${userId}-${uuidv4()}`;
  const events = [...randomEvents, randomEvent('visibility_change')];
  const res = await axios.post(INGESTION_URL, { session_id, events, device: 'desktop' });
  console.log(`[Simulator] User ${userId}: ${res.status}`);
}
```

### data-science (FastAPI)

| 항목 | AnalShop 원본 | Hover 변경 |
|---|---|---|
| `/predict` 입력 타입 | `dict` (타입 힌트 없음) | `dict` 유지 |
| 추가 엔드포인트 | 없음 | `GET /thresholds` — thresholds.yml 직접 조회 추가 |
| requirements | 기본 5개 | numpy, seaborn, scipy 추가 |

---

## 5. 추가된 파일

AnalShop에 없던 파일로, Hover에서 새로 작성.

| 파일 | 내용 |
|---|---|
| `test.http` | 전체 파이프라인 테스트 시나리오 (4개 서비스, 포트 반영) |
| `packages/*/Dockerfile` | 패키지별 독립 Dockerfile (5개) |
| `docker-compose.yml` | `model-api` 서비스 추가 |

---

## 6. 변경하지 않은 것

| 항목 | 이유 |
|---|---|
| `packages/shared/config/thresholds.yml` | Hover 버전(BE-A 분석 반영)이 AnalShop 초기값보다 최신 |
| `docker-compose.yml` 인프라 부분 | Hover 버전이 healthcheck 등 더 완성도 높음 |
| Redis / ClickHouse 설정 | 동일 |

---

## 7. 실제 동작 테스트 결과 (2026-05-18)

```
POST /events           → 202 Accepted ✅
Worker 이탈 감지        → pending:session_id Redis 저장 ✅
GET /decision/:id      → 쿠폰 JSON 200 OK ✅
전달 후 key 자동 삭제   → EXISTS = 0 ✅
Simulator 10명 실행    → 전원 202, 10개 pending key 생성 ✅
GET /signals/coverage  → 16개 신호 카운트 반환 ✅
GET /scenarios/firings → S1/S2 통계 반환 ✅
GET /thresholds        → thresholds.yml 내용 반환 ✅
```
