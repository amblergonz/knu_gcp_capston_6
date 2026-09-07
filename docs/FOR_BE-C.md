# BE-C 기술 인수인계 문서

>작성: BE-A (2026-05-18)
>대상: BE-C (Real-time Core 담당)
>PR 링크: https://github.com/amblergonz/knu_gcp_capston_6/pull/2

---

## 1. 지금 당장 해야 할 것

**PR #2 리뷰 및 머지** — `be-a/thresholds-pr-2 → main`

`packages/shared/config/thresholds.yml` 값이 바뀌었어요. 머지 후 Stream Worker를 재시작해야 새 값이 반영됩니다.

```bash
# Worker 재시작 (Docker 사용 시)
docker compose restart stream-worker

# 로컬 실행 시
# 기존 node 프로세스 종료 후 재실행
node packages/stream-worker/src/worker.js
```

---

## 2. BE-A 완료 현황 (thresholds.yml)

### 변경된 값

| 항목 | 경로 | 기존 | **현재** | 근거 |
|---|---|---|---|---|
| `tab_hidden_seconds` | `scenarios.S1.base_match` | 30 | **10** | Retailrocket 280만 건 분석 — 카트 후 10초가 전환율 변곡점 |
| `session_length_5min` | `booster_weights` | 0.1 | **0.4** | lift = 32.19x (5분 이상 세션 구매율 32배 높음) |
| `hidden_repeated` | `booster_weights` | 0.1 | **0.4** | lift = 8.76x (아이템 재조회 세션 구매율 8.76배 높음) |

### 변경 안 된 값 (이유 포함)

| 항목 | 현재 값 | 이유 |
|---|---|---|
| `intent_score_min` | 0.6 | W5 A/B 검증 결과 FP Rate=0.0% → 조정 불필요 |
| `clipboard_copy_match` | 0.4 | Retailrocket에 해당 신호 없음 — 도메인 직관 유지 |
| `broadcast_channel_multi_tab` | 0.4 | 동일 |
| `referrer_price_compare` | 0.2 | 동일 |
| `cooldown_seconds` | 86400 | 변경 없음 |

### 최종 thresholds.yml

```yaml
scenarios:
  S1:
    base_match:
      cart_min_count: 1
      tab_hidden_seconds: 10      # 30 → 10
    intent_score_min: 0.6
    cooldown_seconds: 86400

booster_weights:
  clipboard_copy_match: 0.4
  broadcast_channel_multi_tab: 0.4
  referrer_price_compare: 0.2
  session_length_5min: 0.4        # 0.1 → 0.4
  hidden_repeated: 0.4            # 0.1 → 0.4
```

### W5 검증 결과 (BE-C 구현 확인용)

BE-A가 현재 thresholds.yml 값으로 A/B 시뮬레이션 돌린 결과:

| 지표 | 수치 | 목표 |
|---|---|---|
| FP Rate | **0.0%** | < 15% [x] |
| Precision | 100.0% | — |
| Treatment 전환율 | 0.786% | — |
| Control 전환율 | 0.722% | — |
| Uplift | +8.95% | — |

→ S1 룰이 `comparison` 의도 세션에만 발화, `distraction`/`browsing` 세션에는 발화 안 함

---

## 3. BE-B 완료 현황

### 구현된 API

| 서비스 | 포트 | 엔드포인트 | 상태 |
|---|---|---|---|
| Dashboard API | **4002** | `GET /health` | [x] |
| Dashboard API | 4002 | `GET /stream/live` (SSE) | [x] |
| Dashboard API | 4002 | `GET /signals/coverage` | [x] (mock) |
| Dashboard API | 4002 | `GET /scenarios/firings` | [x] (mock) |
| Simulator | — | `node packages/simulator/src/simulator.js` | [x] |

### Simulator 사용법

가상 사용자 10명이 이탈 이벤트를 발송합니다. **Ingestion API가 먼저 실행 중이어야 합니다.**

```bash
# 기본 실행 (10명, localhost:4000으로 전송)
node packages/simulator/src/simulator.js

# 환경변수로 커스텀
USER_COUNT=50 INGESTION_URL=http://localhost:4000/events node packages/simulator/src/simulator.js
```

실행 결과 예시:
```
[Simulator] Starting simulation for 10 users → http://localhost:4000/events
[Simulator] User 0 (sim-0-xxxx): 202
...
[Simulator] Done. Sessions: ['sim-0-xxxx', ...]
```

### Dashboard SSE 연결

Admin Dashboard에서 실시간 이벤트를 받으려면:

```javascript
const evtSource = new EventSource('http://localhost:4002/stream/live');
evtSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  // { ts: 1716..., event: 'new_event', session_id: 'xxx' }
  // 또는 { ts: 1716..., event: 'heartbeat' }
};
```

---

## 4. 전체 파이프라인 흐름

```
[브라우저 / Simulator]
        │
        │ POST /events  (port 4000)
        ▼
  ingestion-api
  └─ session_id + events[] → Redis Streams (events_stream)
        │
        ▼
  stream-worker   ←── thresholds.yml (BE-A가 관리)
  ├─ S1 룰 체크: cart_count >= 1 AND intent_score >= 0.6
  ├─ intent_score = Σ(booster_weights of triggered signals)
  └─ 조건 충족 시 → Redis SETEX pending:{session_id} 300초
        │
        │ (탭 복귀 시 FE가 폴링)
        ▼
  decision-api   (port 4001)
  └─ GET /decision/:session_id
     ├─ 200 OK: intervention JSON 반환 + Redis key 삭제
     └─ 204 No Content: 준비된 개입 없음
        │
        ▼
  [FE Widget SDK — 팝업 표시]
        │
        ▼
  dashboard-api  (port 4002)
  └─ ClickHouse 적재 + SSE 브로드캐스트 (구현 예정)
```

---

## 5. 로컬 실행 방법

### 인프라 먼저 (Docker)

```bash
docker compose up -d redis
# ClickHouse가 필요하면:
docker compose up -d redis clickhouse
```

### 서비스 실행

```bash
# 터미널 1
node packages/ingestion-api/src/index.js

# 터미널 2
node packages/stream-worker/src/worker.js

# 터미널 3
node packages/decision-api/src/index.js

# 터미널 4 (선택)
node packages/dashboard-api/src/index.js
```

### 전체 파이프라인 테스트

`test.http` 파일을 VS Code REST Client나 JetBrains HTTP Client로 실행:

```
1. POST http://localhost:4000/events   ← 이탈 이벤트 발송
2. (1~2초 대기)
3. GET  http://localhost:4001/decision/test-session-001  ← 쿠폰 JSON 수신
```

오늘 실제 테스트 결과:
- `POST /events` → `202 Accepted` [x]
- Worker 로그: `[Worker] Intervention created for session test-session-001` [x]
- `GET /decision/test-session-001` → 쿠폰 JSON 200 OK [x]
- 전달 후 Redis key 자동 삭제 [x]

---

## 6. Decision API 응답 스펙 (FE 연동 참고)

```json
{
  "intervention_id": "int-1716...",
  "scenario_id": "S1",
  "ab_group": "treatment",
  "component": "coupon_modal",
  "copy": {
    "title": "떠나기 전 잠깐!",
    "body": "지금 구매하시면 10% 추가 할인 쿠폰을 드려요.",
    "cta": "쿠폰 받기"
  },
  "context": {
    "hotel_name": "신라호텔"
  },
  "ttl_seconds": 300
}
```

- `ab_group`이 `"control"`이면 팝업을 표시하지 않습니다 (FE 처리 필요)
- 한 번 `GET`하면 Redis key가 삭제되어 중복 발화 방지됩니다

---

## 7. 남은 연동 작업 (BE-C 담당)

| 항목 | 설명 | 우선순위 |
|---|---|---|
| **thresholds.yml hot-reload** | Worker 재시작 없이 yml 변경 감지 | 높음 |
| **ClickHouse 적재** | 모든 이벤트/결정 기록 → Dashboard 데이터 연결 | 중간 |
| **Gemini API 키 설정** | `.env`에 `GEMINI_API_KEY` 추가 시 실시간 문구 생성 활성화 | 중간 |
| **cooldown 중복 발화 방지** | `cooldown_seconds: 86400` 구현 여부 확인 | 높음 |

### Gemini API 활성화

```bash
# packages/stream-worker/.env
GEMINI_API_KEY=your_key_here
```

키 없으면 현재처럼 기본 문구("떠나기 전 잠깐!")가 fallback으로 나갑니다.
