# BE-C 작업 요약

작성일: 2026-05-20  
브랜치: `be-c/worker`

## 1. 작업 범위

이번 작업은 BE-C 역할인 실시간 이벤트 처리 파이프라인에 한정한다.

- `POST /events` 요청 검증 및 Redis Stream 적재
- Stream Worker의 S1/S2 룰 평가
- intent score, booster, cooldown, pending intervention 처리
- `GET /decision/:session_id` 1회성 응답 처리
- 개입 결과를 `interventions_stream`에 기록
- `thresholds.yml` 구조 정리
- BE-C 스모크 테스트 자동화

프론트엔드 팝업 UI, Gemini API 실호출, 모델 학습, ClickHouse 적재는 이번 작업 범위에 포함하지 않는다.

## 2. 변경 파일

PR에 포함해야 하는 BE-C 관련 파일은 아래만 선별한다.

```text
packages/ingestion-api/src/index.js
packages/decision-api/src/index.js
packages/stream-worker/src/worker.js
packages/stream-worker/package.json
packages/stream-worker/scripts/smoke-be-c.js
packages/shared/config/thresholds.yml
docs/BE-C_WORK_SUMMARY.md
```

현재 작업트리에 `admin-dashboard`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.pnpm-store` 등 BE-C와 무관한 변경이 섞여 있을 수 있다. 해당 파일은 이번 PR에 포함하지 않는다.

## 3. 구현 상태

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

### Decision API

- 포트: `4001`
- 엔드포인트: `GET /decision/:session_id`
- pending intervention이 있으면 `200 OK`로 JSON 반환 후 Redis key 삭제
- pending intervention이 없으면 `204 No Content`
- 깨진 pending JSON은 삭제 후 `500` 반환

## 4. 검증 결과

아래 검증은 통과했다.

```bash
node --check packages/ingestion-api/src/index.js
node --check packages/decision-api/src/index.js
node --check packages/stream-worker/src/worker.js
node --check packages/stream-worker/scripts/smoke-be-c.js
pnpm --filter @hover/stream-worker run smoke:be-c
docker compose build stream-worker
```

스모크 테스트 확인 범위:

- invalid payload `400`
- S1 `coupon_modal` 생성
- S2 `price_match_banner` 생성
- decision API 1회 반환 후 두 번째 요청 `204`
- `interventions_stream` 기록

## 5. 남은 이슈

### Docker compose 전체 기동

`docker compose up` 전체 기동 검증은 로컬 Redis `6379` 포트 충돌로 실패했다.

이는 코드 오류가 아니라 로컬 실행 환경에서 이미 `6379` 포트를 사용 중이어서 Redis 컨테이너가 바인딩하지 못한 문제다. 전체 compose 검증을 하려면 기존 Redis 프로세스를 종료하거나 팀 합의 후 compose의 Redis host port를 변경해야 한다.

### Gemini API

현재는 Gemini API 실호출이 없다. `copy_source`는 `fallback`으로 내려간다.

Gemini를 추가할 경우 필요한 작업:

- `GEMINI_API_KEY` 환경변수 사용
- API 실패 또는 key 없음이면 fallback 유지
- timeout 설정
- 호출 비용과 빈도 제한 정책 합의

### Frontend

백엔드는 decision JSON을 제공하는 상태다. 실제 브라우저 팝업 표시는 FE Widget SDK에서 처리해야 한다.

## 6. PR 설명 예시

```text
## Summary
- Added validation to ingestion-api POST /events.
- Implemented BE-C stream-worker S1/S2 rule evaluation, session state, cooldown, pending intervention, and intervention stream output.
- Hardened decision-api GET /decision/:session_id one-shot delivery.
- Added BE-C smoke test.

## Verified
- node --check for ingestion-api, decision-api, stream-worker, smoke script
- pnpm --filter @hover/stream-worker run smoke:be-c
- docker compose build stream-worker

## Notes
- Full docker compose up is blocked locally by Redis 6379 port conflict.
- Frontend popup rendering is not included; FE should consume GET /decision/:session_id.
- Gemini API call is not implemented yet; current copy_source is fallback.
```
