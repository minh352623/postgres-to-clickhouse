# Hướng Dẫn Khởi Động Hệ Thống CDC Streaming

## 🚀 Quick Start

### 1. Khởi động tất cả services

```bash
cd /Users/tekix/Documents/company/clickhouse/streaming-demo

# Dọn dẹp (nếu cần)
docker-compose down

# Build và khởi động
docker-compose up -d --build
```

**Thời gian khởi động**: ~2-3 phút

### 2. Kiểm tra trạng thái services

```bash
# Xem tất cả containers
docker-compose ps

# Kiểm tra Debezium connector
curl http://localhost:8083/connectors

# Xem status chi tiết
curl http://localhost:8083/connectors/postgres-orders-connector/status | python3 -m json.tool
```

### 3. Test tạo order

```bash
# Tạo order mới
curl -X POST http://localhost:3001/api/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": 299.99,
    "status": "created"
  }'

# Tạo nhiều orders
curl -X POST "http://localhost:3001/api/orders/bulk?count=20"
```

### 4. Kiểm tra dữ liệu

**Trong Postgres**:
```bash
docker exec streaming-postgres psql -U postgres -d orders_db \
  -c "SELECT count(*) FROM orders;"
```

**Đợi 3-5 giây cho CDC sync**

**Trong ClickHouse Cloud**:
```bash
curl --user "default:my-passwork" \
  --data-binary "SELECT count() FROM orders" \
  "https://h2zp7fbmjw.asia-southeast1.gcp.clickhouse.cloud:8443"
```

### 5. Mở Dashboard

```bash
# Frontend dashboard
open http://localhost:3000

# Kafka UI (monitoring)
open http://localhost:8080
```

---

## 📊 Danh Sách Services

| Service | Port | URL | Mục đích |
|---------|------|-----|----------|
| **postgres** | 5432 | - | Database nguồn |
| **kafka** | 9092 | - | Message broker |
| **kafka-ui** | 8080 | http://localhost:8080 | Kafka monitoring |
| **kafka-connect** | 8083 | http://localhost:8083 | Debezium runtime |
| **clickhouse-bridge** | - | - | Kafka → ClickHouse Cloud |
| **backend** | 3001 | http://localhost:3001 | Order API |
| **frontend** | 3000 | http://localhost:3000 | Dashboard |

---

## 🔍 Monitoring & Debugging

### Xem Logs

```bash
# Tất cả services
docker-compose logs -f

# Một service cụ thể
docker-compose logs -f clickhouse-bridge
docker-compose logs -f kafka-connect
docker-compose logs -f backend
```

### Kiểm tra Kafka Topics

```bash
# List topics
docker exec streaming-kafka kafka-topics \
  --list --bootstrap-server localhost:9092

# Xem messages trong topic
docker exec streaming-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic orderserver.public.orders \
  --from-beginning --max-messages 5
```

### Monitor Bridge Service

```bash
# Xem logs real-time
docker-compose logs -f clickhouse-bridge

# Tìm messages đã sync
docker-compose logs clickhouse-bridge | grep "Synced"
```

### Kiểm tra ClickHouse Cloud

```bash
# Count records
curl --user "default:my-passwork" \
  --data-binary "SELECT count() as total FROM orders" \
  "https://h2zp7fbmjw.asia-southeast1.gcp.clickhouse.cloud:8443"

# View latest orders
curl --user "default:my-passwork" \
  --data-binary "SELECT * FROM orders ORDER BY created_at DESC LIMIT 5" \
  "https://h2zp7fbmjw.asia-southeast1.gcp.clickhouse.cloud:8443"
```

---

## ⚠️ Troubleshooting

### Lỗi: Connector không start

**Kiểm tra**:
```bash
curl http://localhost:8083/connectors/postgres-orders-connector/status
```

**Nếu status = FAILED**:
```bash
# Restart connector
curl -X POST http://localhost:8083/connectors/postgres-orders-connector/restart

# Hoặc xóa và register lại
curl -X DELETE http://localhost:8083/connectors/postgres-orders-connector
docker-compose restart connector-registrar
```

### Lỗi: Bridge không sync data

**Kiểm tra logs**:
```bash
docker-compose logs clickhouse-bridge
```

**Common issues**:
1. **Kafka chưa có topics**: Đợi Debezium tạo topics (1-2 phút)
2. **ClickHouse credentials sai**: Kiểm tra `CLICKHOUSE_PASSWORD` trong docker-compose.yml
3. **Network issues**: Restart bridge service

```bash
docker-compose restart clickhouse-bridge
```

### Lỗi: Frontend không hiển thị data

**Kiểm tra**:
1. ClickHouse Cloud có data chưa?
2. Frontend `.env` đúng credentials chưa?
3. CORS issues? → Kiểm tra backend logs

---

## 🛑 Dừng Hệ Thống

```bash
# Dừng tất cả services
docker-compose down

# Dừng và xóa volumes (CẢNH BÁO: Mất dữ liệu!)
docker-compose down -v

# Dừng và xóa images
docker-compose down --rmi all
```

---

## 📝 Kiến Trúc Recap

```
Client 
  ↓ HTTP POST
Backend API
  ↓ INSERT
PostgreSQL (với WAL enabled)
  ↓ Logical Replication
Debezium CDC Connector
  ↓ Publish events
Kafka Topics
  ↓ Consume events
ClickHouse Bridge Service
  ↓ HTTP API
ClickHouse Cloud
  ↑ Query
Frontend Dashboard
```

**Latency trung bình**: 200-500ms từ Postgres → ClickHouse Cloud

---

## 🎯 Next Steps

1. **Test end-to-end**:
   - Tạo orders → Verify trong ClickHouse → Xem Dashboard
   
2. **Load testing**:
   ```bash
   # Tạo 1000 orders
   for i in {1..50}; do
     curl -X POST "http://localhost:3001/api/orders/bulk?count=20" &
   done
   wait
   ```

3. **Monitor performance**:
   - Kafka UI: http://localhost:8080
   - Consumer lag
   - Bridge throughput

4. **Production deployment**:
   - Xem file `GUIDE-VI.md` phần "Best Practices"
   - Configure TLS/SSL
   - Set up monitoring (Prometheus + Grafana)

---

**Hệ thống đã sẵn sàng!** 🎉

Mọi thay đổi trong Postgres sẽ tự động sync sang ClickHouse Cloud trong vài giây.
