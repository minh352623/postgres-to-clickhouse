#!/bin/bash

# Setup script for ClickHouse Cloud connection
# Your ClickHouse Cloud instance: h2zp7fbmjw.asia-southeast1.gcp.clickhouse.cloud:8443

set -e

echo "🚀 Setting up Streaming Demo with ClickHouse Cloud"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ClickHouse Cloud credentials
CLICKHOUSE_HOST="h2zp7fbmjw.asia-southeast1.gcp.clickhouse.cloud"
CLICKHOUSE_PORT="8443"
CLICKHOUSE_USER="default"
CLICKHOUSE_PASSWORD="CryI6p0oB.Cd6"
CLICKHOUSE_URL="https://${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}"

echo -e "${YELLOW}Step 1: Creating frontend .env file${NC}"
cat > frontend/.env << EOF
CLICKHOUSE_URL=${CLICKHOUSE_URL}
CLICKHOUSE_USER=${CLICKHOUSE_USER}
CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD}
CLICKHOUSE_DATABASE=default
EOF
echo -e "${GREEN}✓ Frontend .env created${NC}"

echo ""
echo -e "${YELLOW}Step 2: Testing ClickHouse Cloud connection${NC}"
curl --user "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" \
  --data-binary 'SELECT 1' \
  ${CLICKHOUSE_URL} && echo -e "\n${GREEN}✓ Connection successful${NC}" || echo -e "\n${RED}✗ Connection failed${NC}"

echo ""
echo -e "${YELLOW}Step 3: Initializing ClickHouse Cloud database${NC}"
echo "Running SQL schema..."

# Execute the init SQL
curl --user "${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}" \
  --data-binary @clickhouse/init.sql \
  ${CLICKHOUSE_URL}

echo -e "${GREEN}✓ Database initialized${NC}"

echo ""
echo -e "${YELLOW}Step 4: Starting Docker services (Postgres, Kafka, Vector, Backend)${NC}"
docker-compose up -d postgres kafka zookeeper vector backend

echo ""
echo -e "${YELLOW}Step 5: Waiting for services to be ready...${NC}"
sleep 15

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "  1. Test backend: curl http://localhost:3001/health"
echo "  2. Create test order: curl -X POST http://localhost:3001/api/orders -H 'Content-Type: application/json' -d '{\"amount\": 99.99, \"status\": \"created\"}'"
echo "  3. Check ClickHouse: curl --user '${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}' --data-binary 'SELECT count() FROM orders' ${CLICKHOUSE_URL}"
echo "  4. Start frontend: cd frontend && npm install && npm run dev"
echo "  5. Open dashboard: http://localhost:3000"
echo ""
