#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
EMAIL="loadtest_$RANDOM@jwt.com"
PASSWORD="pizzapass"
NAME="Load Tester"

echo "Using API: $BASE_URL"
echo "Creating user: $EMAIL"

register_payload=$(cat <<JSON
{"name":"$NAME","email":"$EMAIL","password":"$PASSWORD"}
JSON
)

register_response=$(curl -sS -X POST "$BASE_URL/api/auth" -H 'Content-Type: application/json' -d "$register_payload")
TOKEN=$(echo "$register_response" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [[ -z "$TOKEN" ]]; then
  echo "Failed to register user. Response: $register_response"
  exit 1
fi

echo "User registered. Generating auth traffic..."

for _ in {1..5}; do
  curl -sS -X PUT "$BASE_URL/api/auth" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" >/dev/null
  curl -sS -X PUT "$BASE_URL/api/auth" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"wrong-password\"}" >/dev/null || true
done

echo "Generating HTTP request traffic..."

for _ in {1..20}; do
  curl -sS "$BASE_URL/api/docs" >/dev/null
  curl -sS "$BASE_URL/api/order/menu" >/dev/null
  curl -sS -X GET "$BASE_URL/api/order" -H "Authorization: Bearer $TOKEN" >/dev/null
  sleep 0.2
done

echo "Generating successful pizza purchases..."

for _ in {1..8}; do
  curl -sS -X POST "$BASE_URL/api/order" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"franchiseId":1,"storeId":1,"items":[{"menuId":1,"description":"Veggie","price":0.05}]}' >/dev/null || true
  sleep 0.3
done

echo "Generating failure + high-latency pizza purchase (>20 items)..."

items=''
for i in {1..25}; do
  if [[ -n "$items" ]]; then
    items+=','
  fi
  items+='{"menuId":1,"description":"Veggie","price":0.05}'
done

curl -sS -X POST "$BASE_URL/api/order" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"franchiseId\":1,\"storeId\":1,\"items\":[${items}]}" >/dev/null || true

echo "Generating logout traffic..."
curl -sS -X DELETE "$BASE_URL/api/auth" -H "Authorization: Bearer $TOKEN" >/dev/null || true

echo "Traffic simulation complete."
echo "I'm going to run this a few times over 5-10 minutes for richer Grafana charts."
