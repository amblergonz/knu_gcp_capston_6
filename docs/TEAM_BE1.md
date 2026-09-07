# BE1 — Ingestion API + 인프라 (테크리드)

## 당신의 미션

**SDK가 보낸 이벤트를 안정적으로 받아 큐에 흘리고, 전체 팀이 `docker compose up` 한 번으로 데모까지 띄울 수 있게 만들어야 합니다.**

---

## W1 — Kickoff + 모노레포 셋업 (4/29 ~ 5/3)

### 할 일 (테크리드로서)
- [ ] 모노레포 구조 생성 (pnpm workspaces)
  - `packages/` 안에 모든 패키지
  - `shared/` 패키지로 타입 단일 출처
- [ ] GitHub 저장소 생성
  - Main repo 1개 (모노레포 통합)
  - 또는 팀원별 6개 repo (선택)
- [ ] `docker-compose.yml` 골격
  - Redis, PostgreSQL, ClickHouse
  - 각 마이크로서비스 플레이스홀더
- [ ] GitHub Actions 셋업
  - 각 PR에 lint + type-check 실행
- [ ] `README.md` 작성 (전체 팀용)

### 이벤트 스키마 협력
- [ ] FE1과 `docs/event-schema.md` 협력하여 정의
  - 이벤트 타입, 필드, 제약 조건
  - 예: `visibility_change`, `focus_change`, ...
  - **W2 첫날까지 동결**

### 산출물
```
hover/
├── pnpm-workspace.yaml      [x]
├── package.json             [x]
├── tsconfig.json            [x]
├── docker-compose.yml       [x] (골격)
├── .github/workflows/
│   └── ci.yml               [x] (lint + test)
├── README.md                [x]
├── docs/
│   ├── event-schema.md       (FE1과 협력)
│   ├── TEAM_FE1.md
│   ├── TEAM_BE1.md (이 파일)
│   └── ...
└── packages/
    ├── ingestion-api/
    ├── shared/
    └── ... (나머지 팀원)
```

### 첫 명령어
```bash
# 모노레포 초기화
pnpm install

# 공유 타입 빌드
pnpm -r build --filter shared

# Ingestion API 시작
cd packages/ingestion-api
pnpm dev
```

> **중요:** 이번 주에 모든 팀원이 로컬에서 `docker compose up`을 시도하는 것이 목표. 모두 실패해도 괜찮습니다. 구조가 명확하면 됩니다.

---

## W2 — Ingestion API 구축 (5/6 ~ 5/10)

### Ingestion API (Fastify)
- [ ] 프로젝트 구조
  ```
  packages/ingestion-api/
  ├── src/
  │   ├── server.ts        # Fastify 셋업
  │   ├── routes/
  │   │   └── events.ts    # POST /events
  │   ├── middleware/
  │   │   ├── cors.ts
  │   │   └── rate-limit.ts
  │   ├── schema/
  │   │   └── event.ts     # Zod 스키마
  │   └── utils/
  │       └── redis.ts     # Redis 클라이언트
  └── src/server.ts
  ```

- [ ] Endpoint: `POST /events`
  - 배치 이벤트 수신
  - 스키마 validation (Zod)
  - Redis Streams에 XADD

- [ ] Middleware
  - CORS (FE 도메인 허용)
  - Rate limit (기본 수준)
  - 타임스탐프 검증

- [ ] Redis Streams
  ```bash
  # Redis에 이벤트 스트림 생성
  XADD hover:events * event_id=uuid session_id=xxx event_type=visibility_change ...

  # 확인
  XRANGE hover:events - + COUNT 10
  ```

### 세션 스토어 (Redis Hash)
- [ ] 각 세션의 최근 신호 16개 buffer
  ```
  HSET session:abc123 visibility_change 1234567890 focus_change 1234567891 ...
  ```
  - TTL 30분 (실제 사용자 세션보다 살짝 길게)

### Docker 통합
- [ ] `Dockerfile` for Ingestion API
  ```dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY package.json pnpm-lock.yaml ./
  RUN pnpm install --frozen-lockfile
  COPY . .
  RUN pnpm build
  EXPOSE 4000
  CMD ["pnpm", "start"]
  ```

- [ ] `docker-compose.yml` 업데이트
  ```yaml
  services:
    redis: ...
    postgres: ...
    ingestion-api:
      build: ./packages/ingestion-api
      ports:
        - "4000:4000"
      depends_on:
        redis:
          condition: service_healthy
  ```

### 산출물
- FE1과 먼저 테스트:
  ```bash
  curl -X POST http://localhost:4000/events \
    -H "Content-Type: application/json" \
    -d '[{
      "event_id":"uuid",
      "session_id":"abc",
      "ts":1234567890,
      "event_type":"visibility_change",
      "payload":{"visibility":"hidden"}
    }]'
  ```

---

## W3 — 모든 서비스 연결 (5/13 ~ 5/17)

### docker-compose.yml 완성
- [ ] 모든 백엔드 서비스 추가
  - Redis [x]
  - PostgreSQL
  - ClickHouse
  - ingestion-api [x]
  - stream-worker (BE2)
  - decision-api (BE2)
  - dashboard-api (BE3)
- [ ] 모든 FE 서비스
  - demo-hotel-site (FE1)
  - admin-dashboard (FE2)

### CI/CD 정상화
- [ ] GitHub Actions 워크플로우
  ```yaml
  - pnpm install
  - pnpm lint
  - pnpm type-check
  - pnpm test (있으면)
  ```

### 네트워크 & 헬스체크
- [ ] 모든 서비스에 `healthcheck` 추가
- [ ] 의존성 순서 정의 (`depends_on`)

### 재현가능성 테스트
```bash
# 클린 환경에서 시도
rm -rf hover
git clone <repo> hover
cd hover
docker compose up --wait

# 모든 서비스가 떠있나?
docker compose ps
```

---

## W4 ~ W6 — 안정화 & 모니터링

### W4 ~ W5
- [ ] 로깅 추가 (각 마이크로서비스)
  - 요청/응답 로깅
  - 에러 로깅
- [ ] 모니터링 대시보드 (선택)
  - prometheus + grafana (Stretch)

### W5 ~ W6
- [ ] 시뮬레이터 통합 테스트
  - 1,000명 가상 사용자 트래픽 → Ingestion API → Redis
  - 부하 테스트 확인

### W6
- [ ] 문서 정리
  - `README.md` 최종
  - 개발자 환경 설정 가이드
  - 배포 가이드 (클라우드 선택사항)

---

## 주요 파일 & 타입

### Shared Types (`packages/shared/src/index.ts`)
```typescript
export interface TrackingEvent {
  event_id: string;
  session_id: string;
  ts: number;
  event_type: EventType;
  page_url: string;
  payload: Record<string, any>;
}

export type EventType =
 | 'visibility_change'
 | 'focus_change'
 | 'idle'
 | 'scroll'
 | 'form_input'
 | 'clipboard_copy'
 | 'broadcast_channel'
 | 'page_unload';
```

### Ingestion API 구조
```typescript
// src/routes/events.ts
fastify.post<{ Body: TrackingEvent[] }>('/events', async (req, reply) => {
  const events = req.body;

  // 1. 스키마 검증
  const validated = eventSchema.array().parse(events);

  // 2. Redis Streams에 저장
  for (const event of validated) {
    await redis.xadd(
      'hover:events',
      '*',
      'event_id', event.event_id,
      'session_id', event.session_id,
      'ts', event.ts,
      'event_type', event.event_type,
      'payload', JSON.stringify(event.payload)
    );
  }

  // 3. 세션 통계 업데이트
  for (const event of validated) {
    await redis.hset(
      `session:${event.session_id}`,
      event.event_type,
      event.ts
    );
    await redis.expire(`session:${event.session_id}`, 1800); // 30분
  }

  return { success: true, count: events.length };
});
```

---

## 팀 조율 (테크리드 역할)

### 매주 인터페이스 미팅
- **월요일 스탠드업:** 각 팀원이 주간 목표 공유
- **수요일 인터페이스 체크인:** PR 리뷰
  - `docs/event-schema.md` (FE1 ↔ BE1)
  - `docs/intervention-payload.md` (BE2 ↔ FE2)
  - `docs/dashboard-api.md` (BE3 ↔ FE2)
- **금요일 통합일:** 마일스톤 검증
  - `docker compose up` 성공 여부
  - 전체 파이프라인 동작 여부

### GitHub 규칙
```bash
# 구조 변경은 반드시 PR + 전원 리뷰
git checkout -b be1/docker-update
git commit -m " Update docker-compose for W3"
git push origin be1/docker-update
# → PR 생성, 최소 1명 리뷰 필요
# → 통합일에 final check
```

---

## 팁

1. **Redis 스트림 vs 큐**
   - Stream: 영구 저장 + 여러 컨슈머 (BE2, BE3)
   - 처음엔 Stream으로 시작, 필요하면 RabbitMQ/Kafka로 마이그

2. **스키마 first**
   ```typescript
   // zod로 FE ↔ BE 타입 공유
   export const eventSchema = z.object({
     event_id: z.string().uuid(),
     session_id: z.string(),
     ts: z.number(),
     event_type: z.enum(['visibility_change', 'focus_change', ...]),
     payload: z.record(z.any())
   });
   ```

3. **헬스체크 중요**
   ```yaml
   healthcheck:
     test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
     interval: 5s
     timeout: 3s
     retries: 5
   ```

4. **환경 변수 관리**
   ```bash
   # .env.example (git 추적)
   NODE_ENV=development
   REDIS_URL=redis://localhost:6379
   POSTGRES_URL=postgresql://hover:hover_dev@localhost:5432/hover

   # .env.local (git 무시)
   # 로컬에서 필요한 오버라이드
   ```

---

## 블로커 발생 시

- **모노레포 구조 모르겠어?** → 일단 `packages/` 만들고 시작
- **docker-compose 난해?** → 각 팀원의 `Dockerfile` 먼저 만들고 통합
- **Redis Stream 모르겠어?** → 공식 문서 + 튜토리얼로 빠르게 습득

---

**Remember:** 당신이 infrastructure를 튼튼하게 파면, 6명의 팀원들이 각자의 영역에만 집중할 수 있습니다.
