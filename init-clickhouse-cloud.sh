#!/bin/bash

# Initialize ClickHouse Cloud with SQL statements executed one by one
# ClickHouse Cloud doesn't support multi-statement via HTTP API

set -e

CLICKHOUSE_HOST="h2zp7fbmjw.asia-southeast1.gcp.clickhouse.cloud"
CLICKHOUSE_PORT="8443"
CLICKHOUSE_USER="default"
CLICKHOUSE_PASSWORD="CryI6p0oB.Cd6"
CLICKHOUSE_URL="https://${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Initializing ClickHouse Cloud Database...${NC}"

# Note: Kafka Engine tables cannot be used with ClickHouse Cloud if Kafka is local
# We'll only create the orders table which can be populated via HTTP API

echo "Creating orders table..."
curl --user "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" \
  --data-binary "CREATE TABLE IF NOT EXISTS orders (
    order_id String,
    user_id String,
    amount Float64,
    status String,
    created_at DateTime,
    ingested_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (created_at, order_id)
SETTINGS index_granularity = 8192" \
  ${CLICKHOUSE_URL}

echo -e "${GREEN}✓ Orders table created${NC}"

echo "Creating user_stats table..."
curl --user "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" \
  --data-binary "CREATE TABLE IF NOT EXISTS user_stats (
    user_id String,
    total_orders UInt64,
    total_amount Float64,
    last_order_at DateTime
) ENGINE = SummingMergeTree()
ORDER BY user_id" \
  ${CLICKHOUSE_URL}

echo -e "${GREEN}✓ User stats table created${NC}"

echo "Creating status_stats table..."
curl --user "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" \
  --data-binary "CREATE TABLE IF NOT EXISTS status_stats (
    status String,
    order_count UInt64,
    total_amount Float64
) ENGINE = SummingMergeTree()
ORDER BY status" \
  ${CLICKHOUSE_URL}

echo -e "${GREEN}✓ Status stats table created${NC}"

echo "Verifying tables..."
curl --user "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" \
  --data-binary "SHOW TABLES" \
  ${CLICKHOUSE_URL}

echo -e "\n${GREEN}✅ ClickHouse Cloud database initialized successfully!${NC}"
