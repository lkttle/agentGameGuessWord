#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TMP_DIR="$(mktemp -d)"
HOST_COOKIE="${TMP_DIR}/host.cookie"
PLAYER_COOKIE="${TMP_DIR}/player.cookie"

wait_for_server() {
  local retries=30
  while (( retries > 0 )); do
    if curl -sS "$BASE_URL" >/dev/null 2>&1; then
      return 0
    fi
    retries=$((retries - 1))
    sleep 1
  done
  echo "Server not ready at $BASE_URL"
  return 1
}

wait_for_server

json_get() {
  local path="$1"
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const path=process.argv[1].split('.');let cur=data;for(const k of path){cur=cur[k];if(cur===undefined){process.exit(2)}};if(typeof cur==='object') console.log(JSON.stringify(cur)); else console.log(String(cur));" "$path"
}

echo "[1/12] mock login host"
HOST_LOGIN_JSON=$(curl -sS -c "$HOST_COOKIE" -X POST "$BASE_URL/api/dev/mock-login" -H 'Content-Type: application/json' --data '{"secondmeUserId":"demo-host","name":"Demo Host","email":"host@example.com"}')
HOST_USER_ID=$(printf '%s' "$HOST_LOGIN_JSON" | json_get "user.id")

echo "[2/12] mock login player"
PLAYER_LOGIN_JSON=$(curl -sS -c "$PLAYER_COOKIE" -X POST "$BASE_URL/api/dev/mock-login" -H 'Content-Type: application/json' --data '{"secondmeUserId":"demo-player","name":"Demo Player","email":"player@example.com"}')
PLAYER_USER_ID=$(printf '%s' "$PLAYER_LOGIN_JSON" | json_get "user.id")

echo "[3/12] create A2A room"
CREATE_A2A_JSON=$(curl -sS -b "$HOST_COOKIE" -X POST "$BASE_URL/api/rooms" -H 'Content-Type: application/json' --data '{"mode":"AGENT_VS_AGENT","displayName":"Agent Alpha"}')
A2A_ROOM_ID=$(printf '%s' "$CREATE_A2A_JSON" | json_get "room.id")

echo "[4/12] player joins A2A as AGENT"
JOIN_A2A_JSON=$(curl -sS -b "$PLAYER_COOKIE" -X POST "$BASE_URL/api/rooms/$A2A_ROOM_ID/join" -H 'Content-Type: application/json' --data '{"participantType":"AGENT","displayName":"Agent Beta"}')

printf '%s' "$JOIN_A2A_JSON" | json_get "participant.id" >/dev/null

echo "[5/12] start A2A room"
A2A_START_JSON=$(curl -sS -b "$HOST_COOKIE" -X POST "$BASE_URL/api/rooms/$A2A_ROOM_ID/start" -H 'Content-Type: application/json' --data '{}')
A2A_MATCH_ID=$(printf '%s' "$A2A_START_JSON" | json_get "match.id")

echo "[6/12] run A2A agent round"
curl -sS -b "$HOST_COOKIE" -X POST "$BASE_URL/api/matches/$A2A_MATCH_ID/agent-round" -H 'Content-Type: application/json' --data '{"targetWord":"吃饭","roundIndex":1}' | json_get "roundIndex" >/dev/null

echo "[7/12] finish A2A room"
curl -sS -b "$HOST_COOKIE" -X POST "$BASE_URL/api/rooms/$A2A_ROOM_ID/finish" -H 'Content-Type: application/json' --data "{\"winnerUserId\":\"$HOST_USER_ID\",\"totalRounds\":1}" | json_get "room.status" >/dev/null

echo "[8/12] create Human vs Agent room"
CREATE_HVA_JSON=$(curl -sS -b "$HOST_COOKIE" -X POST "$BASE_URL/api/rooms" -H 'Content-Type: application/json' --data '{"mode":"HUMAN_VS_AGENT","displayName":"Human Host"}')
HVA_ROOM_ID=$(printf '%s' "$CREATE_HVA_JSON" | json_get "room.id")
HVA_HUMAN_ID=$(printf '%s' "$CREATE_HVA_JSON" | json_get "room.participants.0.id")

echo "[9/12] player joins HVA as AGENT"
JOIN_HVA_JSON=$(curl -sS -b "$PLAYER_COOKIE" -X POST "$BASE_URL/api/rooms/$HVA_ROOM_ID/join" -H 'Content-Type: application/json' --data '{"participantType":"AGENT","displayName":"Agent Rival"}')
HVA_AGENT_ID=$(printf '%s' "$JOIN_HVA_JSON" | json_get "participant.id")

echo "[10/12] start HVA room, submit human move, then trigger agent round"
HVA_START_JSON=$(curl -sS -b "$HOST_COOKIE" -X POST "$BASE_URL/api/rooms/$HVA_ROOM_ID/start" -H 'Content-Type: application/json' --data '{}')
HVA_MATCH_ID=$(printf '%s' "$HVA_START_JSON" | json_get "match.id")

HVA_HUMAN_MOVE_JSON=$(curl -sS -b "$HOST_COOKIE" -X POST "$BASE_URL/api/matches/$HVA_MATCH_ID/human-move" -H 'Content-Type: application/json' --data "{\"participantId\":\"$HVA_HUMAN_ID\",\"targetWord\":\"吃饭\",\"guessWord\":\"出发\",\"roundIndex\":1,\"autoAgentResponse\":false}")
HVA_ROUND_INDEX=$(printf '%s' "$HVA_HUMAN_MOVE_JSON" | json_get "roundIndex")

curl -sS -b "$HOST_COOKIE" -X POST "$BASE_URL/api/matches/$HVA_MATCH_ID/agent-round" -H 'Content-Type: application/json' --data "{\"targetWord\":\"吃饭\",\"roundIndex\":$HVA_ROUND_INDEX}" | json_get "roundIndex" >/dev/null

echo "[11/12] finish HVA room"
curl -sS -b "$HOST_COOKIE" -X POST "$BASE_URL/api/rooms/$HVA_ROOM_ID/finish" -H 'Content-Type: application/json' --data "{\"winnerUserId\":\"$PLAYER_USER_ID\",\"totalRounds\":1}" | json_get "room.status" >/dev/null

echo "[12/12] verify result/leaderboard/metrics endpoints"
curl -sS "$BASE_URL/api/matches/$A2A_MATCH_ID/result" | json_get "matchId" >/dev/null
curl -sS "$BASE_URL/api/leaderboard?period=all_time" | json_get "entries" >/dev/null
curl -sS -b "$HOST_COOKIE" "$BASE_URL/api/metrics/summary" | json_get "startedMatchCount" >/dev/null

echo "✅ E2E demo flow passed"
echo "A2A_ROOM_ID=$A2A_ROOM_ID"
echo "A2A_MATCH_ID=$A2A_MATCH_ID"
echo "HVA_ROOM_ID=$HVA_ROOM_ID"
echo "HVA_MATCH_ID=$HVA_MATCH_ID"
