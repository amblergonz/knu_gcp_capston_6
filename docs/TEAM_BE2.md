# ⚙️ BE2 — Rule Engine + Stream Worker + Decision API

## 📌 당신의 미션

**"언제 고객에게 개입할지"의 두뇌. S1·S2 룰을 실제로 작동시키고, 결정을 반환하는 시스템입니다.**

---

## 🎯 W1 — Kickoff (4/29 ~ 5/3)

### 할 일
- [ ] PRD v1.0 정독 + 질문/이슈
- [ ] Stream Worker & Decision API 아키텍처 설계
- [ ] 개입 페이로드 스키마 v1 작성 → PR로 FE2와 합의
  - 파일: `docs/intervention-payload.md`
  - 예: `{ scenario_id: "S1", widgets: [{ type: "coupon", ... }] }`
- [ ] 룰 엔진 라이브러리 선택
  - json-rules-engine 추천 (YAML/JSON 형태 규칙)

### 산출물
- PR: `docs/intervention-payload.md` (FE2 리뷰 필수)
- 룰 엔진 선택 문서 (왜 json-rules-engine인가?)

### 첫 명령어
```bash
cd packages/stream-worker
npm install json-rules-engine redis pg

cd packages/decision-api
npm install fastify zod
```

> 📌 **중요:** 개입 페이로드는 FE2가 Widget SDK를 만들 때 필요합니다. W2 첫날까지 조인해야 합니다.

---

## 🎯 W2 — 골격 구축 (5/6 ~ 5/10)

### Stream Worker
- [ ] Redis Streams 컨슈머 구조
  ```
  packages/stream-worker/
  ├── src/
  │   ├── worker.ts        # 진입점 + 컨슈머 루프
  │   ├── rules/
  │   │   ├── engine.ts    # json-rules-engine 래퍼
  │   │   ├── s1.yaml      # S1 룰 정의
  │   │   └── s2.yaml      # S2 룰 정의
  │   ├── db/
  │   │   └── queries.ts   # PostgreSQL 쿼리
  │   └── utils/
  │       └── redis.ts
  └── src/worker.ts
  ```

- [ ] 컨슈머 기본 동작
  ```typescript
  // hover:events 스트림에서 이벤트 읽기
  const events = await redis.xread(
    'STREAMS',
    'hover:events',
    lastId
  );
  
  for (const [stream, data] of events) {
    for (const [id, fields] of data) {
      const event = deserialize(fields);
      // 룰 엔진에 전달
      const decision = await engine.evaluate(event);
      // Decision API에 전달하거나 저장
    }
  }
  ```

### Decision API (Fastify)
- [ ] Endpoint: `GET /decide?session_id=xxx&scenario_id=S1`
  - 세션 상태 조회 (Redis)
  - 룰 엔진 실행
  - 개입 결과 반환

### 룰 엔진 (json-rules-engine)
- [ ] S1 임시 룰 (BE4가 W3에 임계치 제시)
  ```yaml
  # rules/s1.yaml
  - condition:
      all:
        - fact: cart_count
          operator: greaterThan
          value: 0
        - fact: tab_hidden_seconds
          operator: greaterThan
          value: 30  # 임시값, BE4가 조정
    event:
      type: "s1_trigger"
      params:
        discount_percent: 5
        validity_minutes: 10
  ```

- [ ] S2 임시 룰
  ```yaml
  # rules/s2.yaml
  - condition:
      any:
        - fact: clipboard_copy_hotel_or_room
          operator: equal
          value: true
        - fact: broadcast_channel_tab_count
          operator: greaterThanOrEqual
          value: 2
    event:
      type: "s2_trigger"
      params:
        message: "이 호텔, 다른 사이트보다 저렴합니다"
  ```

### 산출물
```bash
# 로컬 테스트
# 1. Ingestion API으로 이벤트 전송
curl -X POST http://localhost:4000/events \
  -d '[{"event_id":"...","session_id":"abc123",...}]'

# 2. Redis Streams 확인
redis-cli XRANGE hover:events - + COUNT 1

# 3. Stream Worker 실행 (Watch mode)
cd packages/stream-worker
npm run dev

# 4. 로그에서 룰 발화 확인
```

---

## 🎯 W3 — 룰 작동 및 A/B 분기 (5/13 ~ 5/17)

### Stream Worker 완성
- [ ] 룰 엔진 통합 완료
  - json-rules-engine 라이브러리로 S1·S2 룰 실행
  - 발화 결과를 PostgreSQL `interventions` 테이블에 저장

- [ ] A/B 분기 로직 추가
  ```typescript
  // session_id 해시로 control/treatment 50:50 분할
  const hash = hashCode(decision.session_id) % 100;
  const abGroup = hash < 50 ? 'control' : 'treatment';
  
  // control group: 개입 안 함 (위젯 없음)
  // treatment group: 개입 함 (위젯 있음)
  ```

- [ ] 쿨다운 로직
  ```typescript
  // 동일 시나리오·세션당 1회만 발화
  const key = `cooldown:${session_id}:${scenario_id}`;
  if (await redis.exists(key)) {
    return null; // 쿨다운 중
  }
  // 발화 후
  await redis.setex(key, 3600, 'true'); // 1시간
  ```

### Decision API 완성
- [ ] Endpoint 구현:
  ```
  POST /decide
  {
    "session_id": "abc123",
    "scenario_id": "S1|S2|..."
  }
  ```
  응답:
  ```json
  {
    "intervention_id": "uuid",
    "session_id": "abc123",
    "scenario_id": "S1",
    "ab_group": "treatment",
    "widgets": [
      {
        "type": "coupon_modal",
        "duration_ms": 5000,
        "data": {
          "hotel_name": "Grand Hotel",
          "room_name": "Deluxe Suite",
          "discount_percent": 5
        }
      }
    ]
  }
  ```

### 산출물
- S1 E2E 테스트:
  ```bash
  # 1. 데모 사이트에서 카트 추가 (cart_count: 1)
  # 2. 다른 탭으로 전환 (tab_hidden_seconds: 30+)
  # 3. 복귀 시 Decision API 호출
  # 4. 쿠폰 모달이 화면에 나타남 ✅
  ```

---

## 🎯 W4 ~ W6 — S2 + 통계

### W4
- [ ] S2 룰 동작 확인
  - clipboard 신호 또는 BroadcastChannel 감지
  - 최저가 배너 위젯 반환

### W5
- [ ] A/B 분기 검증
  - control vs treatment 에러 없이 분석 가능
  - 장기 실행 시 대시보드에 결과 표시

### W6
- [ ] 룰 정의 YAML 문법 검증
  - 새로운 시나리오 추가 가능한 구조
  - 코드 변경 없이 YAML만 수정

---

## 📋 주요 파일 & 타입

### Stream Worker 구조
```typescript
// src/worker.ts
import { Engine } from 'json-rules-engine';
import * as yaml from 'js-yaml';
import { redis } from './utils/redis';

const rules = yaml.load(fs.readFileSync('rules/s1.yaml'));
const engine = new Engine();
engine.addRule(rules);

async function processStream() {
  const events = await redis.xread('STREAMS', 'hover:events', lastId);
  
  for (const event of events) {
    // 세션 상태 조회
    const sessionState = await getSessionState(event.session_id);
    
    // 룰 엔진 실행
    const facts = {
      cart_count: sessionState.cart_count,
      tab_hidden_seconds: now - sessionState.tab_change_ts,
      ...
    };
    
    const { events: decisions } = await engine.run(facts);
    
    // PostgreSQL에 저장
    for (const decision of decisions) {
      await db.insertIntervention({
        session_id: event.session_id,
        scenario_id: decision.type.replace('_trigger', ''),
        ...
      });
    }
  }
}
```

### Decision API 구현
```typescript
// src/server.ts
fastify.post('/decide', async (req, reply) => {
  const { session_id, scenario_id } = req.body;
  
  // 1. 세션 상태 조회
  const state = await getSessionState(session_id);
  
  // 2. A/B 분기
  const hash = hashCode(session_id) % 100;
  const abGroup = hash < 50 ? 'control' : 'treatment';
  
  // 3. Control group은 개입 안 함
  if (abGroup === 'control') {
    return {
      ab_group: 'control',
      widgets: [] // 비어있음
    };
  }
  
  // 4. Treatment group: 룰 엔진 실행 후 위젯 반환
  const intervention = await getLatestIntervention(session_id, scenario_id);
  
  return {
    intervention_id: intervention.id,
    scenario_id: intervention.scenario_id,
    ab_group: 'treatment',
    widgets: intervention.widgets
  };
});
```

---

## 🔗 의존성 & 협업

### FE2와 협력
- **개입 페이로드 정의** (W1 동결)
- **Widget SDK** 통합 확인 (W3)

### BE3와 협력
- **interventions 테이블** 스키마 합의 (W2)
- **PostgreSQL** 쿼리 확인 (W3)

### BE4와 협력
- **임계치 N 값** 수신 (W3)
  - 이 값으로 S1 ruleset 업데이트

---

## 💡 팁

1. **json-rules-engine 문법**
   ```javascript
   const rule = {
     condition: {
       all: [ // 모두 만족
         { fact: 'cart_count', operator: '>', value: 0 },
         { fact: 'tab_hidden', operator: '==', value: true }
       ]
     },
     event: {
       type: 'intervention_trigger',
       params: { discount_percent: 5 }
     }
   };
   ```

2. **쿨다운은 필수**
   - 같은 사용자에게 5분마다 쿠폰 모달을 보면 성가심
   - Redis SETEX로 간단 구현

3. **A/B 분기는 session_id 기반**
   ```typescript
   // 언제나 같은 사용자는 같은 그룹
   const hash = CryptoJS.SHA256(session_id).digest('hex');
   const numeric = parseInt(hash.substr(0, 8), 16);
   const group = numeric % 100 < 50 ? 'control' : 'treatment';
   ```

4. **로깅 중요**
   ```typescript
   logger.info('Intervention triggered', {
     session_id,
     scenario_id,
     ab_group,
     intervention_id,
     ts: new Date()
   });
   ```

---

## 📞 블로커 발생 시

- **Ingestion API 연결 안 됨?** → BE1에 확인 (W2)
- **Redis Streams 문법?** → 공식 튜토리얼 (빠름)
- **룰 엔진 학습곡선?** → json-rules-engine 예제 코드 보고 빠르게 습득

---

**Remember:** 당신의 Decision API가 1.5초 안에 응답하지 않으면 위젯이 너무 늦게 뜹니다. 성능이 중요! ⚡
