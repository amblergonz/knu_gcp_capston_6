#!/usr/bin/env bash
# Docker 없이 백엔드 4종을 로컬에서 띄운다.
# 루트 .env 가 있으면 읽어서 GEMINI_API_KEY 등을 워커에 전달한다.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  echo "[dev-backend] .env 로드됨 · GEMINI_API_KEY ${GEMINI_API_KEY:+설정됨}${GEMINI_API_KEY:-미설정}"
fi

REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export REDIS_URL

PORT=4000 node packages/ingestion-api/src/index.js &
PORT=4001 node packages/decision-api/src/index.js &
THRESHOLDS_PATH="$ROOT/packages/shared/config/thresholds.yml" node packages/stream-worker/src/worker.js &
PORT=4002 node packages/dashboard-api/src/index.js &

wait
