# BE-C 작업 요약

작성일: 2026-05-21  
브랜치: `be-c/worker`

## 1. 작업 범위

이번 작업은 BE-C 역할인 실시간 이벤트 처리 파이프라인에 한정한다.

- `POST /events` 요청 검증 및 Redis Stream 적재
- Stream Worker의 S1/S2 룰 평가
- intent score, booster, cooldown, pending intervention 처리
- `GET /decision/:session_id` 1회성 응답 처리
- 개입 결과를 `interventions_stream`에 기록
- `thresholds.yml` 구조 정리
- Docker compose 환경에서 worker가 `thresholds.yml`을 읽도록 설정
- `GEMINI_API_KEY`가 있을 때 Gemini 기반 팝업 문구 생성
- BE-C 스모크 테스트 자동화

프론트엔드 팝업 UI, 모델 학습, ClickHouse 직접 적재는 이번 작업 범위에 포함하지 않는다.

## 2. 변경 사항

| 항목 | 기존 | 변경 | 근거 |
|---|---|---|---|
| Ingestion API | payload 최소 검증 | `POST /events` schema 검증 추가 | PRD/API_SPEC 기준 이벤트 수집 안정화 |
| Redis Stream | event data 중심 적재 | `session_id`, `device`, `user_id`, `data` 필드 적재 | Worker 세션 상태 계산에 필요 |
| Stream Worker | `visibility_change hidden=true` 단일 룰 | S1/S2 룰 평가, intent score, booster, cooldown, pending decision 생성 | BE-C 실시간 개입 파이프라인 요구사항 |
| `thresholds.yml` | S1 중심 threshold | S1/S2 threshold + global config 정리 | PR #2 threshold 값 반영 및 S2 처리 준비 |
| Decision API | pending JSON 단순 반환 | `session_id` 검증, 1회 반환 후 삭제, payload sanitizing | FE Widget 연동 안정화 |
| Intervention 기록 | pending key만 생성 | `interventions_stream`에도 개입 결과 기록 | BE-B/Dashboard 연동용 |
| Docker compose | ClickHouse HTTP healthcheck, worker threshold 파일 미마운트 | ClickHouse query healthcheck, worker threshold read-only mount 추가 | compose 환경에서 BE-C 경로 정상 기동 |
| Gemini copy | fallback 문구만 사용 | `GEMINI_API_KEY`가 있으면 Gemini 호출, 실패 시 fallback 유지 | FE 없이도 Decision API JSON으로 생성 문구 검증 가능 |
| 테스트 | 수동 `test.http` 중심 | `smoke:be-c` 자동 스모크 테스트 추가 | S1/S2 E2E 검증 자동화 |

## 3. 포함 파일

```text
docker-compose.yml
docs/BE-C_WORK.md
packages/ingestion-api/src/index.js
packages/decision-api/src/index.js
packages/stream-worker/src/worker.js
packages/stream-worker/package.json
packages/stream-worker/scripts/smoke-be-c.js
packages/shared/config/thresholds.yml
```

## 4. 구현 상태

### Ingestion API

- 포트: `4000`
- 엔드포인트: `POST /events`
- 필수 필드 검증:
  - `session_id`
  - `device`
  - `events[]`
  - event 내부 `event_id`, `ts`, `type`, `payload`, `page_url`
- 정상 요청 시 Redis `events_stream`에 이벤트 적재
- 응답: `202 Accepted`

### Stream Worker

- Redis `events_stream`을 읽어서 세션 상태를 갱신한다.
- `thresholds.yml`을 런타임에 읽어서 S1/S2 룰에 반영한다.
- S1:
  - 장바구니 1개 이상
  - 탭 hidden 상태 10초 이상
  - intent score 0.6 이상
  - component: `coupon_modal`
- S2:
  - clipboard copy 또는 multi-tab signal
  - intent score 0.5 이상
  - component: `price_match_banner`
- 개입 생성 시:
  - Redis `pending:{session_id}` 저장
  - Redis `cooldown:{session_id}:{scenario_id}` 저장
  - Redis `interventions_stream` 기록
- `GEMINI_API_KEY`가 설정되어 있으면 개입 문구를 Gemini로 생성한다.
- Gemini API key가 없거나 호출 실패/timeout/응답 파싱 실패 시 fallback 문구를 사용한다.
- `copy_source`는 `gemini` 또는 `fallback`으로 내려간다.

### Decision API

- 포트: `4001`
- 엔드포인트: `GET /decision/:session_id`
- pending intervention이 있으면 `200 OK`로 JSON 반환 후 Redis key 삭제
- pending intervention이 없으면 `204 No Content`
- 깨진 pending JSON은 삭제 후 `500` 반환

## 5. 검증 결과

아래 검증은 통과했다.

```bash
node --check packages/ingestion-api/src/index.js
node --check packages/decision-api/src/index.js
node --check packages/stream-worker/src/worker.js
node --check packages/stream-worker/scripts/smoke-be-c.js
pnpm --filter @hover/stream-worker run smoke:be-c
docker compose up -d --build --force-recreate redis postgres clickhouse ingestion-api stream-worker decision-api
```

검증 범위:

- invalid payload `400`
- S1 `coupon_modal` 생성
- S2 `price_match_banner` 생성
- decision API 1회 반환 후 두 번째 요청 `204`
- `interventions_stream` 기록
- Redis, Postgres, ClickHouse, ingestion-api, decision-api, stream-worker compose 기동
- `GEMINI_API_KEY` 미설정 시 fallback 경로 정상 동작
- `GEMINI_API_KEY` 설정 후 Gemini 실호출 성공
- Decision API 응답에서 `copy_source: gemini` 확인

Gemini 실호출 확인 결과:

```text
Scenario S2
CopySource gemini
```

응답 예시:

```json
{
  "title": "신라호텔, 최저가 놓치지 마세요!",
  "body": "다른 곳에서 본 가격과 비교해보세요. 추가 혜택이 있을 수 있어요.",
  "cta": "가격 비교하기"
}
```

## 6. 남은 이슈

### Frontend

백엔드는 decision JSON을 제공하는 상태다. 실제 브라우저 팝업 표시는 FE Widget SDK에서 처리해야 한다.

### Gemini API

Gemini 호출은 `GEMINI_API_KEY` 환경변수가 있을 때만 활성화된다. 키는 Git에 올리지 않는다.

설정 예시:

```bash
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=10000
```

API 실패, key 없음, timeout, 응답 파싱 실패 시 fallback 문구를 유지한다.

현재 사용 가능한 모델 목록 기준으로 `gemini-2.5-flash`를 사용한다. `gemini-1.5-flash`는 현재 키에서 404가 발생했고, `gemini-2.5-flash`는 출력 토큰을 충분히 확보해야 JSON 응답이 잘리지 않는다.

### ClickHouse 적재

이번 작업에서는 ClickHouse에 직접 적재하지 않는다. 대신 `interventions_stream`에 개입 결과를 기록하므로, BE-B/Dashboard 쪽에서 해당 stream을 소비해 저장소와 연결하면 된다.

## 7. PR 설명 예시

```text
## Summary
Based on #2 / be-a/thresholds-pr-2.

- Added validation to ingestion-api POST /events.
- Implemented BE-C stream-worker S1/S2 rule evaluation, session state, cooldown, pending intervention, and intervention stream output.
- Hardened decision-api GET /decision/:session_id one-shot delivery.
- Added BE-C smoke test and work summary document.
- Fixed BE-C compose path by using ClickHouse query healthcheck and mounting thresholds.yml into stream-worker.
- Added Gemini copy generation when GEMINI_API_KEY is set, with fallback on missing key, timeout, or invalid response.
- Updated Gemini runtime config to use gemini-2.5-flash with enough output tokens for JSON copy generation.

## Verified
- node --check for ingestion-api, decision-api, stream-worker, smoke script
- pnpm --filter @hover/stream-worker run smoke:be-c
- docker compose up -d --build --force-recreate redis postgres clickhouse ingestion-api stream-worker decision-api
- compose S1/S2 E2E through localhost:4000 and localhost:4001
- fallback copy path verified without GEMINI_API_KEY
- live Gemini copy generation verified with GEMINI_API_KEY; Decision API returned copy_source=gemini

## Notes
- Frontend popup rendering is not included; FE should consume GET /decision/:session_id.
- Gemini API key is not committed; set GEMINI_API_KEY in the runtime environment.
- ClickHouse direct persistence is not included; worker emits intervention records to interventions_stream.
```
