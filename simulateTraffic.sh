#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-https://pizza-service.cs329.afoodsite.click}"
BASE_URL="${BASE_URL%/}"
PASSWORD="pizzapass"

PRIMARY_EMAIL="loadtest_primary_$RANDOM@jwt.com"
SECONDARY_EMAIL="loadtest_secondary_$RANDOM@jwt.com"
PRIMARY_NAME="Load Tester Primary"
SECONDARY_NAME="Load Tester Secondary"

PIZZA_SOLD=0
PIZZA_FAILURES=0
REVENUE_CENTS=0
HTTP_GET=0
HTTP_POST=0
HTTP_PUT=0
HTTP_DELETE=0

register_user() {
  local name="$1"
  local email="$2"

  local register_payload
  register_payload=$(cat <<JSON
{"name":"$name","email":"$email","password":"$PASSWORD"}
JSON
)

  local register_response
  register_response=$(curl -sS -X POST "$BASE_URL/api/auth" -H 'Content-Type: application/json' -d "$register_payload")
  ((HTTP_POST += 1))

  local token
  token=$(echo "$register_response" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  if [[ -z "$token" ]]; then
    echo "Failed to register user ($email). Response: $register_response"
    exit 1
  fi

  printf "%s" "$token"
}

echo "Using API: $BASE_URL"
echo "Creating users: $PRIMARY_EMAIL and $SECONDARY_EMAIL"

PRIMARY_TOKEN=$(register_user "$PRIMARY_NAME" "$PRIMARY_EMAIL")
SECONDARY_TOKEN=$(register_user "$SECONDARY_NAME" "$SECONDARY_EMAIL")

echo "Users registered. Generating auth traffic..."

for _ in {1..5}; do
  curl -sS -X PUT "$BASE_URL/api/auth" -H 'Content-Type: application/json' -d "{\"email\":\"$PRIMARY_EMAIL\",\"password\":\"$PASSWORD\"}" >/dev/null
  ((HTTP_PUT += 1))
  curl -sS -X PUT "$BASE_URL/api/auth" -H 'Content-Type: application/json' -d "{\"email\":\"$PRIMARY_EMAIL\",\"password\":\"wrong-password\"}" >/dev/null || true
  ((HTTP_PUT += 1))
done

echo "Generating HTTP request traffic..."

for _ in {1..20}; do
  curl -sS "$BASE_URL/api/docs" >/dev/null
  ((HTTP_GET += 1))
  curl -sS "$BASE_URL/api/order/menu" >/dev/null
  ((HTTP_GET += 1))
  curl -sS -X GET "$BASE_URL/api/order" -H "Authorization: Bearer $PRIMARY_TOKEN" >/dev/null
  ((HTTP_GET += 1))
  sleep 0.2
done

echo "Generating successful pizza purchases..."

for _ in {1..10}; do
  order_status=$(curl -sS -o /tmp/pizza_order_response.json -w "%{http_code}" -X POST "$BASE_URL/api/order" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $PRIMARY_TOKEN" \
    -d '{"franchiseId":1,"storeId":1,"items":[{"menuId":1,"description":"Veggie","price":0.05},{"menuId":1,"description":"Veggie","price":0.05}]}' || true)
  ((HTTP_POST += 1))

  if [[ "$order_status" =~ ^2 ]]; then
    ((PIZZA_SOLD += 2))
    ((REVENUE_CENTS += 10))
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
  -H "Authorization: Bearer $PRIMARY_TOKEN" \
  -d "{\"franchiseId\":1,\"storeId\":1,\"items\":[${items}]}" || true)
((HTTP_POST += 1))

if [[ "$failure_status" =~ ^2 ]]; then
  ((PIZZA_SOLD += 25))
  ((REVENUE_CENTS += 125))
else
  ((PIZZA_FAILURES += 1))
fi

echo "Generating DELETE traffic while keeping one active user..."
curl -sS -X DELETE "$BASE_URL/api/auth" -H "Authorization: Bearer $PRIMARY_TOKEN" >/dev/null || true
((HTTP_DELETE += 1))

REVENUE_DOLLARS=$(awk "BEGIN { printf \"%.2f\", $REVENUE_CENTS / 100 }")

echo "Traffic simulation complete."
echo "HTTP summary: GET=$HTTP_GET POST=$HTTP_POST PUT=$HTTP_PUT DELETE=$HTTP_DELETE"
echo "Pizza fake data summary: sold=$PIZZA_SOLD failures=$PIZZA_FAILURES revenue=$REVENUE_DOLLARS"
echo "I'm going to run this a few times over 5-10 minutes for richer Grafana charts."
