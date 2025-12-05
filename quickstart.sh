#!/bin/bash

# Streaming Demo - Quick Setup Script
# This script automates the setup and initialization of the complete pipeline

set -e

echo "🚀 Starting Streaming Demo Setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose not found. Please install Docker Compose.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker Compose is available${NC}"
echo ""

# Stop any existing containers
echo -e "${YELLOW}🧹 Cleaning up existing containers...${NC}"
docker-compose down -v 2>/dev/null || true

# Start all services
echo -e "${YELLOW}🐳 Starting all services...${NC}"
docker-compose up -d

echo ""
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"

# Wait for Postgres
echo -n "  Waiting for Postgres..."
until docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}✓${NC}"

# Wait for Kafka
echo -n "  Waiting for Kafka..."
sleep 10
until docker-compose exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}✓${NC}"

# Wait for ClickHouse
echo -n "  Waiting for ClickHouse..."
until docker-compose exec -T clickhouse clickhouse-client --query "SELECT 1" > /dev/null 2>&1; do
    echo -n "."
    sleep 2
done
echo -e " ${GREEN}✓${NC}"

# Initialize ClickHouse schema
echo -e "${YELLOW}📊 Initializing ClickHouse schema...${NC}"
docker-compose exec -T clickhouse clickhouse-client --queries-file /docker-entrypoint-initdb.d/init.sql

sleep 5

# Create sample data
echo -e "${YELLOW}📦 Creating sample orders...${NC}"
curl -s -X POST "http://localhost:3001/api/orders/bulk?count=50" > /dev/null

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "🌐 Access the services:"
echo "  - Dashboard:     http://localhost:3000"
echo "  - Backend API:   http://localhost:3001"
echo "  - Kafka UI:      http://localhost:8080"
echo "  - ClickHouse:    http://localhost:8123"
echo ""
echo "📝 Next steps:"
echo "  1. Open http://localhost:3000 to view the dashboard"
echo "  2. Create more orders: curl -X POST 'http://localhost:3001/api/orders/bulk?count=100'"
echo "  3. View logs: docker-compose logs -f"
echo "  4. Monitor Kafka: http://localhost:8080"
echo ""
echo "🛑 To stop: docker-compose down"
echo ""
