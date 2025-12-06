#!/bin/bash

# Script khởi động hệ thống CDC Streaming

set -e

echo "🚀 Khởi Động Hệ Thống CDC Streaming"
echo "===================================="
echo ""

# Bước 1: Dọn dẹp
echo "📦 Bước 1: Dọn dẹp containers cũ..."
docker-compose down 2>/dev/null || true
echo "✅ Hoàn tất"
echo ""

# Bước 2: Build và khởi động
echo "🔨 Bước 2: Building và Starting services..."
docker-compose up -d --build

echo ""
echo "⏳ Đợi services khởi động (60 giây)..."
sleep 60

# Bước 3: Kiểm tra services
echo ""
echo "🔍 Bước 3: Kiểm tra trạng thái services..."
docker-compose ps

# Bước 4: Kiểm tra database
echo ""
echo "💾 Bước 4: Kiểm tra Postgres database..."
sleep 5
docker exec streaming-postgres psql -U postgres -l | grep orders_db && echo "✅ Database orders_db đã sẵn sàng!" || echo "⚠️  Database chưa sẵn sàng, cần thêm thời gian..."

# Bước 5: Kiểm tra Debezium connector
echo ""
echo "🔌 Bước 5: Kiểm tra Debezium connector..."
sleep 10
CONNECTORS=$(curl -s http://localhost:8083/connectors 2>/dev/null || echo "[]")
echo "Connectors: $CONNECTORS"

if echo "$CONNECTORS" | grep -q "postgres-orders-connector"; then
    echo "✅ Debezium connector đã được đăng ký!"
    echo ""
    echo "📊 Status:"
    curl -s http://localhost:8083/connectors/postgres-orders-connector/status | python3 -m json.tool 2>/dev/null || echo "Đang khởi động..."
else
    echo "⚠️  Connector chưa được đăng ký, đợi thêm..."
fi

# Bước 6: Hướng dẫn test
echo ""
echo "==============================================="
echo "✅ Hệ Thống Đã Khởi Động!"
echo "==============================================="
echo ""
echo "📝 Các  bước test:"
echo ""
echo "1. Test tạo orders:"
echo "   curl -X POST http://localhost:3001/api/orders/bulk?count=10"
echo ""
echo "2. Kiểm tra Postgres:"
echo "   docker exec streaming-postgres psql -U postgres -d orders_db -c 'SELECT count(*) FROM orders;'"
echo ""
echo "3. Đợi 5 giây, kiểm tra ClickHouse Cloud:"
echo "   curl --user 'default:my-password' --data-binary 'SELECT count() FROM orders' https://h2zp7fbmjw.asia-southeast1.gcp.clickhouse.cloud:8443"
echo ""
echo "4. Mở Dashboard:"
echo "   http://localhost:3000"
echo ""
echo "5. Mở Kafka UI:"
echo "   http://localhost:8080"
echo ""
echo "📚 Đọc thêm: QUICKSTART-VI.md và GUIDE-VI.md"
echo ""
