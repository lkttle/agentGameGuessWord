#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

if [[ -z "${ROOM_ID:-}" ]]; then
  echo "ROOM_ID is required"
  exit 1
fi

if [[ -z "${MATCH_ID:-}" ]]; then
  echo "MATCH_ID is required"
  exit 1
fi

echo "[1/4] GET /api/rooms/${ROOM_ID}/state"
curl -sS "${BASE_URL}/api/rooms/${ROOM_ID}/state" | head -c 300; echo

echo "[2/4] GET /api/matches/${MATCH_ID}/result"
curl -sS "${BASE_URL}/api/matches/${MATCH_ID}/result" | head -c 300; echo

echo "[3/4] GET /api/leaderboard?period=all_time"
curl -sS "${BASE_URL}/api/leaderboard?period=all_time" | head -c 300; echo

echo "[4/4] GET /api/metrics/summary"
curl -sS "${BASE_URL}/api/metrics/summary" | head -c 300; echo
