# FE 개발자 핸드오프 문서

> 작성일: 2026-05-22  
> 대상: FE1 (Tracking SDK), FE2 (Widget SDK), FE3 (Admin Dashboard)  
> 검증 상태: 전체 E2E 통과

---

## 1. 포트 안내 (API Spec과 다름)

API Spec 문서(v1.1)의 포트가 실제 구현과 다릅니다. **아래 포트를 사용하세요.**

| 서비스 | 실제 포트 | API Spec 포트 | 담당 |
|---|---|---|---|
| Ingestion API | **4000** | ~~3000~~ | FE1 → BE-C |
| Decision API | **4001** | ~~3002~~ | FE2 → BE-C |
| Dashboard API | **4002** | ~~3001~~ | FE3 → BE-B |

> 이유: 3000/3001은 demo-hotel-site, admin-dashboard 프론트엔드 앱이 사용합니다.

---

## 2. Ingestion API — FE1 (Tracking SDK)

### 엔드포인트

```
POST http://localhost:4000/events
```

### Request Body

```json
{
  "session_id": "uuid-string",
  "user_id": "optional-user-id",
  "device": "desktop",
  "events": [
    {
      "event_id": "uuid-string",
      "ts": 1748000000000,
      "type": "visibility_change",
      "payload": { "hidden": true },
      "page_url": "https://hisfit.co.kr/product/123",
      "referrer": "https://google.com"
    }
  ]
}
```

### 필드 규칙

| 필드 | 필수 | 규칙 |
|---|---|---|
| `session_id` | ✅ | 문자열, 1–128자 |
| `device` | ✅ | `"desktop"` / `"mobile"` / `"tablet"` |
| `events` | ✅ | 배열, 1–100개 |
| `user_id` | 선택 | 문자열, 최대 128자 |
| `events[].event_id` | ✅ | 문자열, 1–128자 |
| `events[].ts` | ✅ | Unix 밀리초 (숫자) |
| `events[].type` | ✅ | 아래 허용 목록 참고 |
| `events[].payload` | ✅ | 객체 (내용 자유) |
| `events[].page_url` | ✅ | 문자열, 1–2048자 |
| `events[].referrer` | 선택 | 문자열, 최대 2048자 |

### 허용 event type 목록

```
visibility_change, window_focus, idle, scroll, scroll_depth,
form_field, clipboard_copy, broadcast_channel, page_lifecycle,
cart_change, add_to_cart, page_view, click, external_link,
search_query, wishlist_add
```

### 응답

| 상태 | 의미 | Body 예시 |
|---|---|---|
| `202 Accepted` | 정상 수집 | `{"status":"accepted","accepted":2}` |
| `400 Bad Request` | 유효성 검증 실패 | `{"error":"Invalid event payload","details":[...]}` |

### 핵심 이벤트 payload 예시

```json
// 탭 숨김 (이탈 감지)
{ "type": "visibility_change", "payload": { "hidden": true } }

// 탭 복귀
{ "type": "visibility_change", "payload": { "hidden": false } }

// 장바구니 추가
{ "type": "add_to_cart", "payload": { "product_id": "hotel-101" } }

// 장바구니 수량 변경
{ "type": "cart_change", "payload": { "count": 2 } }

// 클립보드 복사 (호텔명 감지용)
{ "type": "clipboard_copy", "payload": { "selected_text": "신라호텔 디럭스룸" } }

// 멀티탭 감지
{ "type": "broadcast_channel", "payload": { "tab_count": 3 } }

// page_lifecycle (visibility_change 대체 가능)
{ "type": "page_lifecycle", "payload": { "phase": "hide" } }
{ "type": "page_lifecycle", "payload": { "phase": "show" } }
```

---

## 3. Decision API — FE2 (Widget SDK)

### 엔드포인트

```
GET http://localhost:4001/decision/:session_id
```

### 응답 종류

#### 200 OK — 개입 있음

```json
{
  "intervention_id": "737394b1-0b01-42db-a4cc-a4b033c08891",
  "session_id": "handoff-s1-xxx",
  "scenario_id": "S1",
  "ab_group": "treatment",
  "component": "coupon_modal",
  "copy": {
    "title": "떠나기 전 잠깐!",
    "body": "지금 구매하시면 10% 추가 할인 쿠폰을 드려요.",
    "cta": "쿠폰 받기"
  },
  "context": {
    "hotel_name": "Shilla Hotel Deluxe Room",
    "discount_percent": 10
  },
  "ttl_seconds": 300,
  "intent_score": 0.6,
  "active_boosters": ["referrer_price_compare", "hidden_repeated"],
  "copy_source": "fallback"
}
```

#### 204 No Content — 개입 없음 (body 없음)

### 필드 설명

| 필드 | 설명 |
|---|---|
| `scenario_id` | `"S1"` (쿠폰 모달) / `"S2"` (가격 비교 배너) |
| `component` | `"coupon_modal"` / `"price_match_banner"` |
| `ab_group` | `"treatment"` → 팝업 표시 / **`"control"` → 팝업 표시 안 함** |
| `copy` | 팝업 문구 (title, body, cta) |
| `context.hotel_name` | 클립보드에서 감지된 호텔명 (S2에서 주로 사용) |
| `context.discount_percent` | S1에서 10 고정 |
| `ttl_seconds` | 300초 (5분) — Redis key 만료 시간과 동일 |
| `intent_score` | 0.0–1.0 (boosters 가중치 합산) |
| `active_boosters` | 트리거된 신호 목록 |
| `copy_source` | `"gemini"` / `"fallback"` (Gemini API key 없을 때 fallback) |

### 중요 동작 규칙

**1. 1회성 반환** — `GET`을 한 번 호출하면 Redis key가 삭제됩니다. 두 번째 호출은 항상 `204`입니다.

**2. `ab_group: "control"` 처리 필수** — FE가 이 값을 직접 확인해야 합니다.

```javascript
const res = await fetch(`http://localhost:4001/decision/${sessionId}`);
if (res.status === 204) return; // 개입 없음

const data = await res.json();
if (data.ab_group === 'control') return; // A/B 테스트 control 그룹 → 팝업 미표시

// treatment 그룹만 팝업 표시
showPopup(data.component, data.copy, data.context);
```

**3. 폴링 권장 방식** — 탭이 다시 보여질 때(`visibility_change hidden:false`) 폴링합니다.

```javascript
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const res = await fetch(`http://localhost:4001/decision/${sessionId}`);
    if (res.status === 200) {
      const data = await res.json();
      if (data.ab_group === 'treatment') showPopup(data);
    }
  }
});
```

---

## 4. Dashboard API — FE3 (Admin Dashboard)

### 4.1 Live Stream (SSE)

```
GET http://localhost:4002/stream/live
```

```javascript
const evtSource = new EventSource('http://localhost:4002/stream/live');
evtSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  // heartbeat: { ts: 1748..., event: 'heartbeat' }
  // 새 이벤트: { ts: 1748..., event: 'new_event', session_id: 'xxx' }
};
```

> heartbeat는 5초마다 전송됩니다.

### 4.2 신호 커버리지

```
GET http://localhost:4002/signals/coverage
```

응답 예시 (16개 신호별 수집 카운트):
```json
{
  "visibility_change": 386,
  "clipboard_copy": 426,
  "add_to_cart": 268,
  ...
}
```

> 현재 mock 데이터입니다. ClickHouse 연동 후 실제값으로 교체 예정입니다.

### 4.3 시나리오 발화 통계

```
GET http://localhost:4002/scenarios/firings?from=2026-01-01&to=2026-05-22
```

응답 예시:
```json
{
  "from": "2026-01-01",
  "to": "2026-05-22",
  "scenarios": [
    { "scenario_id": "S1", "fired": 42, "converted": 7, "ctr": 0.167 },
    { "scenario_id": "S2", "fired": 18, "converted": 3, "ctr": 0.167 }
  ]
}
```

> 현재 mock 데이터입니다. ClickHouse 연동 후 실제값으로 교체 예정입니다.

---

## 5. 개입 트리거 조건 (참고)

### S1 — coupon_modal

| 조건 | 값 |
|---|---|
| 장바구니 수량 | 1개 이상 |
| 탭 hidden 유지 시간 | 10초 이상 |
| intent score | 0.6 이상 |

### S2 — price_match_banner

| 조건 | 값 |
|---|---|
| 신호 | `clipboard_copy_match` 또는 `broadcast_channel_multi_tab` 중 하나 이상 |
| intent score | 0.5 이상 |

### Intent Score 가중치

| 신호 | 가중치 |
|---|---|
| clipboard_copy_match | 0.4 |
| broadcast_channel_multi_tab | 0.4 |
| hidden_repeated (탭 2회 이상 숨김) | 0.4 |
| session_length_5min (5분 이상 세션) | 0.4 |
| referrer_price_compare (Google/Naver 등) | 0.2 |

---

## 6. 로컬 실행 방법

### Docker (권장)

```bash
docker compose up -d redis postgres clickhouse ingestion-api stream-worker decision-api dashboard-api
```

### 수동 실행

```bash
# 터미널 1 — Redis 필수
docker compose up -d redis

# 터미널 2
node packages/ingestion-api/src/index.js

# 터미널 3
node packages/stream-worker/src/worker.js

# 터미널 4
node packages/decision-api/src/index.js

# 터미널 5 (선택)
node packages/dashboard-api/src/index.js
```

> ⚠️ stream-worker는 반드시 **단일 인스턴스**만 실행해야 합니다. 두 개 이상 실행 시 동일 세션에 개입이 중복 생성됩니다.

### Gemini API 활성화 (선택)

```bash
# .env 또는 환경변수 설정
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=10000
```

키가 없으면 한국어 fallback 문구를 자동 사용합니다.

---

## 7. 빠른 동작 확인 (curl)

```bash
# 1. 서비스 상태
curl http://localhost:4000/health
curl http://localhost:4001/health
curl http://localhost:4002/health

# 2. 이벤트 전송
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-001",
    "device": "desktop",
    "events": [{
      "event_id": "e1",
      "ts": 1748000000000,
      "type": "add_to_cart",
      "page_url": "https://hisfit.co.kr/hotel/shilla",
      "referrer": "https://google.com",
      "payload": {"product_id": "shilla-101"}
    }]
  }'

# 3. 개입 확인
curl http://localhost:4001/decision/test-001
```

---

## 8. 현재 미구현 사항 (FE 측 판단 필요)

| 항목 | 설명 |
|---|---|
| 팝업 UI 렌더링 | `coupon_modal`, `price_match_banner` 컴포넌트 직접 구현 필요 |
| 노출/클릭/닫기 이벤트 | 팝업 인터랙션을 다시 Ingestion API로 전송 (이벤트 타입 협의 필요) |
| Dashboard 실데이터 | `/signals/coverage`, `/scenarios/firings` 현재 mock → ClickHouse 연동 후 교체 예정 |

---

## 9. 검증 완료 목록

| 항목 | 결과 |
|---|---|
| `POST /events` 유효성 검증 (400) | ✅ |
| S1 E2E (cart + hidden 11s → coupon_modal) | ✅ |
| S2 E2E (clipboard + multi-tab → price_match_banner) | ✅ |
| Decision API 1회 반환 후 204 | ✅ |
| `ab_group` 필드 정상 반환 | ✅ |
| `ttl_seconds: 300` Redis TTL 일치 | ✅ |
| 한국어 fallback copy | ✅ |
| `interventions_stream` 기록 | ✅ |
| Dashboard SSE heartbeat | ✅ |
| Dashboard `/signals/coverage` 16개 신호 | ✅ |
| Dashboard `/scenarios/firings` | ✅ |
