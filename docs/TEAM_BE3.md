# ⚙️ BE3 — Analytics + Dashboard API + Simulator

## 📌 당신의 미션

**모든 이벤트와 개입 결과를 ClickHouse에 적재하고, 대시보드가 쓸 쿼리 API를 제공합니다. 또한 발표용 합성 트래픽을 생성합니다.**

---

## 🎯 W1 — Kickoff (4/29 ~ 5/3)

### 할 일
- [ ] PRD v1.0 정독
- [ ] ClickHouse + PostgreSQL 스키마 설계
- [ ] Dashboard API 스키마 v1 작성 → PR로 FE2와 합의
  - 파일: `docs/dashboard-api.md`
  - Endpoints: `/signals/coverage`, `/scenarios/firings`, `/ab/results`, `/stream/live`
- [ ] 시뮬레이터 아키텍처 설계

### 산출물
- PR: `docs/dashboard-api.md` (FE2 리뷰 필수)
- ClickHouse 스키마 정의서

### 첫 명령어
```bash
cd packages/dashboard-api
npm install fastify pg

cd packages/simulator
npm install axios
```

> 📌 **중요:** Dashboard API는 FE2가 Admin Dashboard를 만들 때 필요합니다. W2 첫날까지 조인해야 합니다.

---

## 🎯 W2 — 스키마 및 골격 구축 (5/6 ~ 5/10)

### ClickHouse 스키마

#### 1. events 테이블
```sql
CREATE TABLE IF NOT EXISTS hover.events (
  event_id UUID,
  session_id String,
  user_id String DEFAULT '',
  ts DateTime64(3),
  event_type String,
  page_url String,
  payload String, -- JSON 형태
  device String,  -- desktop, mobile, tablet
  referrer String,
  inserted_at DateTime64(3) DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (ts, session_id)
PARTITION BY toYYYYMM(ts)
TTL ts + INTERVAL 90 DAY;
```

#### 2. interventions 테이블
```sql
CREATE TABLE IF NOT EXISTS hover.interventions (
  intervention_id UUID,
  session_id String,
  ts DateTime64(3),
  scenario_id String,
  ab_group String, -- control, treatment
  shown Bool,
  inserted_at DateTime64(3) DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (ts, session_id)
PARTITION BY toYYYYMM(ts)
TTL ts + INTERVAL 90 DAY;
```

#### 3. outcomes 테이블
```sql
CREATE TABLE IF NOT EXISTS hover.outcomes (
  session_id String,
  final_state String, -- purchased, abandoned, ongoing
  revenue Decimal(10, 2) DEFAULT 0,
  ts DateTime64(3),
  inserted_at DateTime64(3) DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (ts, session_id)
PARTITION BY toYYYYMM(ts);
```

### PostgreSQL 메타 테이블
```sql
CREATE TABLE hover.rules (
  rule_id SERIAL PRIMARY KEY,
  scenario_id VARCHAR(10),
  rule_yaml TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE hover.sessions (
  session_id UUID PRIMARY KEY,
  user_agent VARCHAR(500),
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP,
  final_state VARCHAR(20) DEFAULT 'ongoing'
);
```

### Dashboard API (Fastify)
```
packages/dashboard-api/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── signals.ts       # GET /signals/coverage
│   │   ├── scenarios.ts     # GET /scenarios/firings
│   │   ├── ab.ts            # GET /ab/results
│   │   └── stream.ts        # GET /stream/live (SSE)
│   ├── queries/
│   │   ├── clickhouse.ts     # ClickHouse 쿼리
│   │   └── postgres.ts       # PostgreSQL 쿼리
│   └── utils/
│       ├── clickhouse.ts
│       └── db.ts
└── src/server.ts
```

### Ingest 파이프라인 (Redis → ClickHouse)
```typescript
// Redis Streams의 이벤트를 ClickHouse에 배치 적재
const batch = [];
const BATCH_SIZE = 100;

async function ingestEvents() {
  const events = await redis.xrange('hover:events', '-', '+');
  
  for (const event of events) {
    batch.push({
      event_id: event.event_id,
      session_id: event.session_id,
      ts: event.ts,
      ...
    });
    
    if (batch.length >= BATCH_SIZE) {
      await clickhouse.insert('hover.events', batch);
      batch.length = 0;
    }
  }
}
```

### 산출물
- ClickHouse 원격 제어 확인:
  ```bash
  curl 'http://localhost:8123/?query=SELECT%201'
  ```

---

## 🎯 W3 — Dashboard API 구현 (5/13 ~ 5/17)

### Endpoint 1: GET /signals/coverage
```typescript
// 16개 신호 중 얼마나 수집했는가?
app.get('/signals/coverage', async (req, reply) => {
  const query = `
    SELECT
      DISTINCT event_type,
      COUNT() as count
    FROM hover.events
    WHERE ts > now() - INTERVAL 1 HOUR
    GROUP BY event_type
  `;
  
  const result = await clickhouse.query(query);
  
  return {
    total_signals: 16,
    collected: result.map(r => r.event_type),
    coverage_percent: (result.length / 16) * 100
  };
});
```

### Endpoint 2: GET /scenarios/firings
```typescript
// 시나리오 발화 횟수 및 시간대별 분석
app.get('/scenarios/firings', async (req, reply) => {
  const { from, to } = req.query;
  
  const query = `
    SELECT
      scenario_id,
      COUNT() as count,
      AVG(revenue) as avg_revenue
    FROM hover.interventions
    WHERE ts BETWEEN ${from} AND ${to}
    GROUP BY scenario_id
  `;
  
  return await clickhouse.query(query);
});
```

### Endpoint 3: GET /ab/results
```typescript
// A/B 테스트 결과 (통계 검정)
app.get('/ab/results', async (req, reply) => {
  const { scenario } = req.query;
  
  const controlQuery = `
    SELECT COUNT(CASE WHEN final_state = 'purchased' THEN 1 END) as converted
    FROM hover.outcomes o
    JOIN hover.interventions i ON o.session_id = i.session_id
    WHERE i.ab_group = 'control' AND i.scenario_id = '${scenario}'
  `;
  
  const treatmentQuery = `
    SELECT COUNT(CASE WHEN final_state = 'purchased' THEN 1 END) as converted
    FROM hover.outcomes o
    JOIN hover.interventions i ON o.session_id = i.session_id
    WHERE i.ab_group = 'treatment' AND i.scenario_id = '${scenario}'
  `;
  
  const control = await clickhouse.query(controlQuery);
  const treatment = await clickhouse.query(treatmentQuery);
  
  // Chi-square 검정 (Python 호출 또는 npm 라이브러리)
  const pValue = chi2Test(control.converted, treatment.converted);
  
  return {
    control: {
      count: control.total,
      converted: control.converted,
      cr: control.converted / control.total
    },
    treatment: {
      count: treatment.total,
      converted: treatment.converted,
      cr: treatment.converted / treatment.total
    },
    p_value: pValue,
    significant: pValue < 0.05
  };
});
```

### Endpoint 4: GET /stream/live (Server-Sent Events)
```typescript
// 실시간 이벤트 스트림 (대시보드 Live 보기)
app.get('/stream/live', async (req, reply) => {
  reply.type('text/event-stream');
  
  const stream = setInterval(async () => {
    const events = await redis.xread(
      'STREAMS',
      'hover:events',
      lastId
    );
    
    for (const event of events) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }, 1000);
  
  req.socket.on('end', () => clearInterval(stream));
});
```

---

## 🎯 W4 ~ W5 — 시뮬레이터 & 통합 (5/20 ~ 5/31)

### 합성 트래픽 시뮬레이터

#### 구조
```
packages/simulator/
├── src/
│   ├── simulator.ts        # 메인 루프
│   ├── scenarios/
│   │   ├── s1.ts          # S1 시나리오
│   │   ├── s2.ts          # S2 시나리오
│   │   └── basic.ts       # 기본 시나리오 (비교용)
│   └── utils/
│       └── axio.ts         # HTTP 클라이언트
└── src/simulator.ts
```

#### Scenario (S1 예)
```typescript
// scenarios/s1.ts
export async function simulateS1(userId: string, apiUrl: string) {
  // 1. 데모 사이트 방문
  const sessionId = uuid();
  
  // 2. 호텔 검색 → 객실 선택 (이벤트 전송)
  const events = [
    {
      event_id: uuid(),
      session_id: sessionId,
      ts: Date.now(),
      event_type: 'page_view',
      payload: { page: 'search' }
    },
    // ... 추가 이벤트들
  ];
  
  // 3. 카트에 추가
  // 4. 다른 탭으로 전환 (tab_hidden_seconds 증가)
  // 5. 복귀 (Decision API 호출)
  
  await axios.post(`${apiUrl}/events`, events);
}
```

#### 시뮬레이터 실행
```typescript
// simulator.ts
async function runSimulation(userCount = 1000) {
  const activeUsers = [];
  
  for (let i = 0; i < userCount; i++) {
    const userId = `sim_user_${i}`;
    
    // 시나리오 선택 (50% S1, 30% S2, 20% 기본)
    const scenario = Math.random();
    let promise;
    
    if (scenario < 0.5) {
      promise = simulateS1(userId, API_URL);
    } else if (scenario < 0.8) {
      promise = simulateS2(userId, API_URL);
    } else {
      promise = simulateBasic(userId, API_URL);
    }
    
    activeUsers.push(promise);
    
    // 동시성 제한 (예: 한 번에 10명씩)
    if (activeUsers.length >= 10) {
      await Promise.all(activeUsers);
      activeUsers.length = 0;
    }
  }
}
```

#### 시뮬레이터 사용
```bash
# 1,000명 가상 사용자 생성 (약 5분)
cd packages/simulator
npm run start -- --users=1000 --api-url=http://localhost:4000

# 대시보드에서 라이브로 이벤트 흐르는 것을 볼 수 있음
open http://localhost:3001/dashboard/live
```

---

## 🎯 W6 — 안정화 & 보고서

### 데이터 정합성 확인
- [ ] events 개수 = SDK 전송 개수
- [ ] interventions 개수 = 룰 발화 개수
- [ ] A/B 분기 50:50 확인

### 쿼리 성능 테스트
```bash
# ClickHouse 쿼리 응답 시간 < 500ms 목표
curl 'http://localhost:8123/?query=SELECT COUNT() FROM hover.events'
```

---

## 📋 주요 파일 & 타입

### Dashboard API 응답 타입
```typescript
// Signals Coverage
interface SignalsCoverage {
  total_signals: 16;
  collected: string[];             // 수집된 event_type 배열
  coverage_percent: number;
}

// Scenarios Firings
interface ScenarioFirings {
  [scenario_id: string]: {
    count: number;
    avg_revenue: number;            // 더미값
  };
}

// A/B Results
interface ABResults {
  control: {
    count: number;
    converted: number;
    cr: number; // conversion rate
  };
  treatment: {
    count: number;
    converted: number;
    cr: number;
  };
  p_value: number;
  significant: boolean;
}

// Live Stream Event
interface LiveEvent {
  event_id: string;
  session_id: string;
  event_type: string;
  ts: number;
  payload?: Record<string, any>;
}
```

---

## 🔗 의존성 & 협업

### FE2와 협력
- **Dashboard API 정의** (W1 동결)
- **API 응답 구조** 확인 (W3)

### BE2와 협력
- **interventions 테이블** insertion (W3)
- **PostgreSQL** outcome 기록 (W4)

---

## 💡 팁

1. **ClickHouse 배치 쓰기**
   - 한 번에 1개씩 INSERT하면 느림
   - 최소 100개 단위로 배치

2. **시뮬레이터는 발표 직전에 실행**
   - W6 금요일 발표 준비 시
   - 대시보드를 멋있게 채우기 위해

3. **SSE (Server-Sent Events) vs WebSocket**
   - SSE가 더 간단 (브라우저 네이티브)
   - WebSocket은 양방향 필요할 때만

4. **A/B 통계는 신중하게**
   - Chi-square, t-test 검증
   - p-value < 0.05를 "유의"라 함

---

## 📞 블로커 발생 시

- **ClickHouse 연결 안 됨?** → docker-compose 확인 (BE1)
- **시뮬레이터 이벤트 안 들어옴?** → Ingestion API 엔드포인트 확인
- **대시보드 API 쿼리 느림?** → ClickHouse 인덱스 최적화

---

**Remember:** 당신의 시뮬레이터가 발표용 대시보드를 아름답게 채웁니다. 최후의 임팩트를 책임지세요! 📊
