#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-https://pizza-service.cs329.afoodsite.click}"
BASE_URL="${BASE_URL%/}"
EMAIL="loadtest_$RANDOM@jwt.com"
PASSWORD="pizzapass"
NAME="Load Tester"

PIZZA_SOLD=0
PIZZA_FAILURES=0
REVENUE_CENTS=0

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
  order_status=$(curl -sS -o /tmp/pizza_order_response.json -w "%{http_code}" -X POST "$BASE_URL/api/order" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"franchiseId":1,"storeId":1,"items":[{"menuId":1,"description":"Veggie","price":0.05}]}' || true)

  if [[ "$order_status" =~ ^2 ]]; then
    ((PIZZA_SOLD += 1))
    ((REVENUE_CENTS += 5))
  else
    ((PIZZA_FAILURES += 1))
  fi

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

failure_status=$(curl -sS -o /tmp/pizza_failure_response.json -w "%{http_code}" -X POST "$BASE_URL/api/order" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"franchiseId\":1,\"storeId\":1,\"items\":[${items}]}" || true)

if [[ "$failure_status" =~ ^2 ]]; then
  ((PIZZA_SOLD += 25))
  ((REVENUE_CENTS += 125))
else
  ((PIZZA_FAILURES += 1))
fi

echo "Generating logout traffic..."
curl -sS -X DELETE "$BASE_URL/api/auth" -H "Authorization: Bearer $TOKEN" >/dev/null || true

REVENUE_DOLLARS=$(awk "BEGIN { printf \"%.2f\", $REVENUE_CENTS / 100 }")

echo "Traffic simulation complete."
echo "Pizza fake data summary: sold=$PIZZA_SOLD failures=$PIZZA_FAILURES revenue=$REVENUE_DOLLARS"
echo "I'm going to run this a few times over 5-10 minutes for richer Grafana charts."
