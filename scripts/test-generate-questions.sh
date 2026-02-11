#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ENDPOINT="$BASE_URL/api/questions/generate"

json_get() {
  local path="$1"
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const keys=process.argv[1].split('.');let cur=data;for(const k of keys){if(k==='') continue; cur=cur?.[k];} if(cur===undefined){process.exit(2)} if(typeof cur==='object') console.log(JSON.stringify(cur)); else console.log(String(cur));" "$path"
}

echo "[1/4] 默认生成（应返回 questions 数组）"
RESP_DEFAULT=$(curl -sS -X POST "$ENDPOINT" -H 'Content-Type: application/json' --data '{}')
printf '%s' "$RESP_DEFAULT" | json_get "questions.0.initialsText" >/dev/null
printf '%s' "$RESP_DEFAULT" | json_get "questions.0.answer" >/dev/null
printf '%s' "$RESP_DEFAULT" | json_get "questions.0.category" >/dev/null


echo "[2/4] 按长度筛选（length=3）"
RESP_LEN=$(curl -sS -X POST "$ENDPOINT" -H 'Content-Type: application/json' --data '{"length":3,"count":3}')
LEN_ANSWER=$(printf '%s' "$RESP_LEN" | json_get "questions.0.answer")
if [[ ${#LEN_ANSWER} -ne 3 ]]; then
  echo "❌ length filter failed: got '$LEN_ANSWER'"
  exit 1
fi


echo "[3/4] 按分类筛选（category=水果）"
RESP_CAT=$(curl -sS -X POST "$ENDPOINT" -H 'Content-Type: application/json' --data '{"category":"水果","count":2}')
CAT0=$(printf '%s' "$RESP_CAT" | json_get "questions.0.category")
if [[ "$CAT0" != "水果" ]]; then
  echo "❌ category filter failed: got '$CAT0'"
  exit 1
fi


echo "[4/4] 无结果报错（length=4, category=水果）"
HTTP_CODE=$(curl -sS -o /tmp/question-empty.out -w '%{http_code}' -X POST "$ENDPOINT" -H 'Content-Type: application/json' --data '{"length":4,"category":"水果"}')
if [[ "$HTTP_CODE" != "422" ]]; then
  echo "❌ expected 422, got $HTTP_CODE"
  cat /tmp/question-empty.out
  exit 1
fi

printf '✅ Question generation API smoke passed\n'
