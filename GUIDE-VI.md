# Tài Liệu Hệ Thống CDC Streaming - Chi Tiết Kỹ Thuật

## Tổng Quan Kiến Trúc

Hệ thống sử dụng **Change Data Capture (CDC)** để đồng bộ dữ liệu real-time từ PostgreSQL sang ClickHouse Cloud thông qua Kafka.

### Luồng Dữ Liệu Tổng Thể

```
Client → Backend API → PostgreSQL → Debezium CDC → Kafka → Bridge Service → ClickHouse Cloud → Frontend Dashboard
```

---

## Phần 1: Chi Tiết Cấu Hình Từng Service

### 1.1. PostgreSQL Configuration (postgresql.conf)

**Vị trí**: `postgres/postgresql.conf`

```conf
wal_level = logical
max_replication_slots = 4
max_wal_senders = 4
listen_addresses = '*'
max_connections = 100
shared_buffers = 128MB
log_replication_commands = on
```

#### Giải Thích Chi Tiết:

**`wal_level = logical`**
- **Mục đích**: Bật chế độ logical replication
- **Giải thích**: WAL (Write-Ahead Log) là nhật ký ghi lại mọi thay đổi dữ liệu trước khi commit
- **Tại sao cần**: Debezium cần đọc WAL để biết được INSERT/UPDATE/DELETE nào đã xảy ra
- **Các mức WAL**:
  - `minimal`: Chỉ ghi crash recovery (không dùng được cho CDC)
  - `replica`: Cho physical replication
  - `logical`: Cho CDC và logical replication ✅

**`max_replication_slots = 4`**
- **Mục đích**: Số lượng replication slot tối đa
- **Giải thích**: Mỗi consumer CDC (như Debezium) cần 1 slot để theo dõi vị trí đọc WAL
- **Tại sao cần 4**: Cho phép tối đa 4 consumer đồng thời (dev, staging, production, backup)
- **Nếu thiếu slot**: Connector mới không thể kết nối

**`max_wal_senders = 4`**
- **Mục đích**: Số process gửi WAL tối đa
- **Giải thích**: Mỗi replication connection cần 1 WAL sender process
- **Quy tắc**: Nên bằng hoặc lớn hơn `max_replication_slots`

**`listen_addresses = '*'`**
- **Mục đích**: Cho phép kết nối từ mọi IP
- **Giải thích**: Cần thiết trong Docker network để các container khác kết nối được
- **Production**: Nên giới hạn IP cụ thể vì lý do bảo mật

**`shared_buffers = 128MB`**
- **Mục đích**: Bộ nhớ cache cho Postgres
- **Giải thích**: Lưu trữ dữ liệu thường xuyên truy cập trong RAM
- **Khuyến nghị**: 25% RAM cho DB server chuyên dụng

**`log_replication_commands = on`**
- **Mục đích**: Ghi log các lệnh replication
- **Tại sao cần**: Debug CDC issues, monitor replication health

---

### 1.2. Database Schema Configuration (schema.sql)

```sql
CREATE PUBLICATION dbz_publication FOR TABLE users, orders;
```

#### Giải Thích:

**`CREATE PUBLICATION`**
- **Mục đích**: Tạo "kênh phát" cho CDC
- **Cơ chế hoạt động**:
  1. Postgres tạo một publication (kênh phát sóng)
  2. Debezium subscribe vào publication này
  3. Mọi thay đổi trên `users` và `orders` được "phát" cho Debezium

**`FOR TABLE users, orders`**
- **Mục đích**: Chỉ định bảng nào cần track
- **Tại sao**: Không phải bảng nào cũng cần CDC (ví dụ: bảng log, cache)
- **Thêm bảng mới**: Alter publication
  ```sql
  ALTER PUBLICATION dbz_publication ADD TABLE new_table;
  ```

---

### 1.3. Debezium Connector Configuration

**Vị trí**: `debezium/connector-config.json`

```json
{
  "name": "postgres-orders-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "tasks.max": "1",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "postgres",
    "database.password": "postgres",
    "database.dbname": "orders_db",
    "database.server.name": "orderserver",
    "topic.prefix": "orderserver",
    "plugin.name": "pgoutput",
    "publication.name": "dbz_publication",
    "slot.name": "orders_debezium_slot",
    "table.include.list": "public.users,public.orders",
    "snapshot.mode": "initial",
    "heartbeat.interval.ms": "10000",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.drop.tombstones": "false",
    "transforms.unwrap.delete.handling.mode": "rewrite",
    "transforms.unwrap.add.fields": "op,source.ts_ms"
  }
}
```

#### Giải Thích Chi Tiết Từng Tham Số:

##### Cấu Hình Connector Cơ Bản

**`connector.class`**
- **Giá trị**: `io.debezium.connector.postgresql.PostgresConnector`
- **Mục đích**: Chỉ định loại connector (PostgreSQL)
- **Các loại khác**: MySQL, MongoDB, SQL Server, Oracle...

**`tasks.max`**
- **Giá trị**: `1`
- **Mục đích**: Số task song song xử lý CDC
- **Tại sao dùng 1**: 
  - Đủ cho dev environment
  - Đảm bảo thứ tự events cho 1 bảng
- **Khi nào tăng**: Production với throughput cao (tăng lên 3-5)

##### Cấu Hình Kết Nối Database

**`database.hostname`**
- **Giá trị**: `postgres`
- **Mục đích**: Tên host của Postgres container
- **Docker**: Sử dụng tên service trong docker-compose

**`database.server.name` & `topic.prefix`**
- **Giá trị**: `orderserver`
- **Mục đích**: Prefix cho Kafka topic names
- **Ví dụ topic**: `orderserver.public.users`, `orderserver.public.orders`
- **Tại sao cần**: Phân biệt nhiều database sources

##### Cấu Hình CDC

**`plugin.name: "pgoutput"`**
- **Mục đích**: Plugin logical decoding
- **Giải thích**: 
  - `pgoutput`: Plugin native của Postgres (từ version 10+)
  - Không cần cài thêm extension
- **Lựa chọn khác**: `wal2json`, `decoderbufs` (cần cài extension)
- **Ưu điểm pgoutput**: Đơn giản, không dependency

**`publication.name: "dbz_publication"`**
- **Mục đích**: Chỉ định publication đã tạo trong schema.sql
- **Phải khớp**: Với tên publication trong database

**`slot.name: "orders_debezium_slot"`**
- **Mục đích**: Tên replication slot
- **Replication slot là gì**:
  - "Bookmark" trong WAL
  - Postgres giữ WAL từ vị trí này trở đi
  - Consumer có thể ngắt kết nối và quay lại đúng vị trí
- **Quan trọng**: Mỗi connector cần 1 slot riêng

**`snapshot.mode: "initial"`**
- **Mục đích**: Cách xử lý dữ liệu có sẵn
- **Các mode**:
  - `initial`: Snapshot toàn bộ data trước, sau đó CDC (khuyên dùng) ✅
  - `never`: Chỉ CDC từ thời điểm start, bỏ qua data cũ
  - `always`: Luôn snapshot mỗi lần restart
  - `exported`: Snapshot với transaction cô lập
- **Luồng hoạt động**:
  1. Lock bảng (read-only)
  2. Đọc toàn bộ data hiện tại
  3. Ghi vào Kafka
  4. Unlock bảng
  5. Chuyển sang CDC mode

**`heartbeat.interval.ms: "10000"`**
- **Mục đích**: Gửi heartbeat signal mỗi 10 giây
- **Tại sao cần**: 
  - Đảm bảo connector vẫn sống
  - Update position trong replication slot (ngay cả khi không có data mới)
  - Tránh WAL bị giữ lại quá lâu

##### Cấu Hình Transformations

**`transforms: "unwrap"`**
- **Mục đích**: Áp dụng transformation để đơn giản hóa CDC event
- **Tại sao cần**: Event gốc của Debezium rất phức tạp

**CDC Event Gốc (trước transform)**:
```json
{
  "before": null,
  "after": {
    "order_id": "uuid",
    "amount": 99.99,
    "status": "created"
  },
  "source": {
    "version": "2.5",
    "connector": "postgresql",
    "ts_ms": 1234567890
  },
  "op": "c",
  "ts_ms": 1234567890,
  "transaction": null
}
```

**`transforms.unwrap.type: "ExtractNewRecordState"`**
- **Mục đích**: "Mở" nested structure
- **Kết quả**: Chỉ lấy phần `after` + metadata

**Sau transform**:
```json
{
  "order_id": "uuid",
  "amount": 99.99,
  "status": "created",
  "__op": "c",
  "__source_ts_ms": 1234567890
}
```

**`transforms.unwrap.delete.handling.mode: "rewrite"`**
- **Mục đích**: Xử lý DELETE events
- **Các mode**:
  - `drop`: Bỏ qua DELETE events
  - `none`: Giữ nguyên (chỉ có tombstone)
  - `rewrite`: Tạo event với `before` data + `__deleted` flag ✅

**DELETE event sau transform**:
```json
{
  "order_id": "uuid",
  "amount": 99.99,
  "status": "created",
  "__op": "d",
  "__deleted": "true"
}
```

**`transforms.unwrap.add.fields: "op,source.ts_ms"`**
- **Mục đích**: Thêm metadata vào event
- **Fields**:
  - `op`: Operation type (c=create, u=update, d=delete, r=read/snapshot)
  - `source.ts_ms`: Timestamp khi event xảy ra trong database

---

### 1.4. Docker Compose Configuration

**Vị trí**: `docker-compose.yml`

#### Service: Kafka Connect

```yaml
kafka-connect:
  image: debezium/connect:2.5
  depends_on:
    postgres:
      condition: service_healthy
    kafka:
      condition: service_healthy
  environment:
    BOOTSTRAP_SERVERS: kafka:9092
    GROUP_ID: 1
    CONFIG_STORAGE_TOPIC: connect_configs
    OFFSET_STORAGE_TOPIC: connect_offsets
    STATUS_STORAGE_TOPIC: connect_statuses
```

**Giải thích Environment Variables**:

**`BOOTSTRAP_SERVERS: kafka:9092`**
- **Mục đích**: Địa chỉ Kafka broker
- **Kafka Connect role**: Producer (gửi CDC events vào Kafka)

**`GROUP_ID: 1`**
- **Mục đích**: ID của Kafka Connect cluster
- **Khi nào dùng>1**: Scale Kafka Connect horizontally

**`CONFIG_STORAGE_TOPIC: connect_configs`**
- **Mục đích**: Topic lưu connector configurations
- **Tại sao cần**: Chia sẻ config giữa nhiều Kafka Connect workers
- **Replication**: Nên set replication factor = 3 trong production

**`OFFSET_STORAGE_TOPIC: connect_offsets`**
- **Mục đích**: Topic lưu vị trí đọc (offset) của mỗi connector
- **Quan trọng**: Nếu mất topic này, connector phải đọc lại từ đầu

**`STATUS_STORAGE_TOPIC: connect_statuses`**
- **Mục đích**: Topic lưu trạng thái connector
- **Dùng để**: Health check, monitoring

#### Service: ClickHouse Bridge

```yaml
clickhouse-bridge:
  build:
    context: ./clickhouse-bridge
  environment:
    KAFKA_BROKERS: kafka:9092
    CLICKHOUSE_URL: https://...clickhouse.cloud:8443
    CLICKHOUSE_USER: default
    CLICKHOUSE_PASSWORD: ***
```

**Giải thích**:

**`KAFKA_BROKERS`**
- **Mục đích**: Địa chỉ Kafka để consume CDC events
- **Bridge role**: Consumer (đọc từ Kafka)

**`CLICKHOUSE_URL`**
- **Mục đích**: ClickHouse Cloud endpoint
- **Tại sao HTTPS**: ClickHouse Cloud yêu cầu secure connection
- **Port 8443**: HTTPS port của ClickHouse

---

## Phần 2: Luồng Dữ Liệu Chi Tiết

### 2.1. Luồng Tạo Order Mới

#### Bước 1: Client Gửi Request

**Client (Browser/Mobile)**
```bash
POST http://localhost:3001/api/orders
Content-Type: application/json

{
  "amount": 199.99,
  "status": "created"
}
```

**Thời gian**: 0ms

---

#### Bước 2: Backend API Nhận và Xử Lý

**File**: `backend/src/services/orderService.ts`

```typescript
export async function createOrder(input: CreateOrderInput) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Tạo hoặc cập nhật user
    await client.query(
      `INSERT INTO users (user_id, email, name) 
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE...`,
      [user_id, email, name]
    );
    
    // 2. Tạo order
    const order_id = uuidv4();
    const result = await client.query(
      `INSERT INTO orders (order_id, user_id, amount, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [order_id, user_id, amount, status]
    );
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
```

**Điểm quan trọng**:
- Backend **CHỈ** viết vào Postgres
- **KHÔNG** viết trực tiếp vào ClickHouse
- CDC sẽ lo việc sync

**Thời gian**: ~10-20ms

---

#### Bước 3: PostgreSQL Ghi Dữ Liệu

**3.1. Write-Ahead Log (WAL)**

Postgres thực hiện 2 bước:

1. **Ghi vào WAL**:
   ```
   WAL Entry:
   - LSN (Log Sequence Number): 0/1A2B3C4D
   - Timestamp: 1234567890
   - Transaction ID: 12345
   - Operation: INSERT
   - Table: public.orders
   - Data: (order_id, user_id, amount, status, created_at)
   ```

2. **Commit vào Table**:
   - Dữ liệu được ghi vào data file
   - Index được cập nhật
   - Transaction hoàn tất

**Tại sao WAL quan trọng cho CDC**:
- WAL là nguồn truth duy nhất
- Debezium đọc WAL, không query table
- Đảm bảo không miss bất kỳ thay đổi nào

**Thời gian**: ~5-10ms

---

#### Bước 4: Debezium Đọc WAL

**Cơ chế hoạt động**:

```
┌─────────────┐
│  Postgres   │
│   WAL       │──┐
└─────────────┘  │
                 │ Logical Decoding Protocol
                 ↓
┌─────────────────────────────┐
│  Replication Slot           │
│  Position: 0/1A2B3C4D       │
│  Consumer: Debezium         │
└─────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────┐
│  Debezium Connector         │
│  - Đọc WAL từ slot          │
│  - Parse logical changes    │
│  - Transform to CDC event   │
└─────────────────────────────┘
```

**Debezium tạo CDC Event**:

```json
{
  "order_id": "abc-123",
  "user_id": "user-456",
  "amount": 199.99,
  "status": "created",
  "created_at": "2024-01-01T10:30:00Z",
  "updated_at": "2024-01-01T10:30:00Z",
  "__op": "c",
  "__source_ts_ms": 1704104400000
}
```

**Metadata giải thích**:
- `__op: "c"` - CREATE operation (INSERT)
- `__source_ts_ms` - Timestamp khi INSERT xảy ra trong Postgres

**Thời gian**: ~50-100ms (latency từ Postgres commit đến Kafka publish)

---

#### Bước 5: Gửi vào Kafka

**Debezium → Kafka Producer**

```
Topic: orderserver.public.orders
Partition: 0 (hash based on order_id)
Offset: 12345

Message Key: {"order_id": "abc-123"}
Message Value: {CDC event JSON}
```

**Kafka Internals**:

1. **Producer gửi message**:
   - Serialization: JSON → bytes
   - Compression: Snappy (tiết kiệm bandwidth)
   - Batching: Gom nhiều messages gửi cùng lúc

2. **Kafka Broker nhận**:
   - Ghi vào log file
   - Replicate sang brokers khác (nếu có)
   - ACK (acknowledge) về cho producer

3. **Message được lưu**:
   - Retention: 7 ngày (168 hours)
   - Có thể replay nếu cần

**Thời gian**: ~10-30ms

---

#### Bước 6: Bridge Service Consume từ Kafka

**File**: `clickhouse-bridge/index.js`

```javascript
const consumer = kafka.consumer({ 
  groupId: 'clickhouse-cloud-sync' 
});

await consumer.subscribe({ 
  topics: ['orderserver.public.orders'],
  fromBeginning: true 
});

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const value = JSON.parse(message.value.toString());
    
    // Xử lý CDC event
    await processCDCEvent(topic, value);
  }
});
```

**Consumer Group Pattern**:
- `groupId: 'clickhouse-cloud-sync'`: Tên consumer group
- Kafka track offset cho từng group
- Nhiều instance bridge → scale horizontally

**Processing CDC Event**:

```javascript
async function processCDCEvent(topic, event) {
  const operation = event.__op;
  
  if (operation === 'c' || operation === 'u') {
    // CREATE hoặc UPDATE → INSERT vào ClickHouse
    await writeToClickHouse('orders', event);
  } else if (operation === 'd') {
    // DELETE → Soft delete hoặc skip
    console.log('DELETE event, skipping...');
  }
}
```

**Thời gian**: ~5-10ms

---

#### Bước 7: Ghi vào ClickHouse Cloud

**Bridge Service → ClickHouse Cloud HTTP API**

```javascript
async function writeToClickHouse(table, data) {
  const query = `
    INSERT INTO orders 
    (order_id, user_id, amount, status, created_at, updated_at) 
    VALUES (
      '${data.order_id}',
      '${data.user_id}',
      ${data.amount},
      '${data.status}',
      '${toDateTime(data.created_at)}',
      '${toDateTime(data.updated_at)}'
    )
  `;
  
  await axios.post(CLICKHOUSE_URL, query, {
    headers: {
      'X-ClickHouse-User': CLICKHOUSE_USER,
      'X-ClickHouse-Key': CLICKHOUSE_PASSWORD
    }
  });
}
```

**ClickHouse Cloud xử lý**:

1. **Nhận HTTP request**:
   - Authenticate user
   - Parse SQL query

2. **Insert data**:
   - Ghi vào buffer
   - Sau đó flush vào Parts (ClickHouse storage)
   - Tự động merge các Parts nhỏ

3. **Indexing**:
   - Primary key: (order_id)
   - Skip index nếu có

**Thời gian**: ~50-100ms

---

#### Bước 8: Frontend Query ClickHouse

**Dashboard tự động refresh mỗi 2 giây**

```typescript
// frontend/app/api/stats/route.ts
const query = `
  SELECT 
    count() as totalOrders,
    sum(amount) as totalRevenue,
    avg(amount) as avgOrderValue
  FROM orders
  WHERE created_at >= now() - INTERVAL 24 HOUR
`;

const response = await clickhouse.query({ query });
```

**ClickHouse xử lý query**:
1. Parse SQL
2. Scan data files (với skip index rất nhanh)
3. Aggregate (COUNT, SUM, AVG)
4. Return results

**Thời gian**: ~10-50ms (ClickHouse cực nhanh cho analytical queries)

---

### 2.2. Tổng Thời Gian End-to-End

```
Client request       :    0ms
Backend process      :  +20ms
Postgres write       :  +10ms
Debezium read WAL    :  +80ms  ← Latency chủ yếu ở đây
Kafka publish        :  +20ms
Bridge consume       :  +10ms
ClickHouse write     :  +80ms
─────────────────────────────
Total latency        : ~220ms ≈ 0.2 giây
```

**Frontend thấy data mới**: 2-5 giây (do auto-refresh interval)

---

## Phần 3: Monitoring và Troubleshooting

### 3.1. Kiểm Tra Replication Slot

```sql
-- Trong Postgres
SELECT * FROM pg_replication_slots;
```

**Các field quan trọng**:
- `slot_name`: Tên slot (orders_debezium_slot)
- `active`: true/false (Debezium đang connected?)
- `restart_lsn`: Vị trí hiện tại trong WAL
- `confirmed_flush_lsn`: Vị trí đã acknowledge

**Cảnh báo**: Nếu slot `active = false` nhưng vẫn tồn tại → WAL sẽ tích lũy → disk đầy!

### 3.2. Kiểm Tra Kafka Topics

```bash
docker exec streaming-kafka kafka-topics \
  --list --bootstrap-server localhost:9092
```

**Expected topics**:
- `orderserver.public.users`
- `orderserver.public.orders`
- `connect_configs`
- `connect_offsets`
- `connect_statuses`

### 3.3. Kiểm Tra Consumer Lag

```bash
docker exec streaming-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group clickhouse-cloud-sync \
  --describe
```

**Các metrics quan trọng**:
- `CURRENT-OFFSET`: Offset hiện tại của consumer
- `LOG-END-OFFSET`: Offset mới nhất trong topic
- `LAG`: LOG-END - CURRENT (càng thấp càng tốt)

**Lag > 1000**: Cần scale bridge service hoặc tối ưu ClickHouse write

---

## Phần 4: Best Practices

### 4.1. Production Checklist

**PostgreSQL**:
- ✅ Backup replication slot config
- ✅ Monitor WAL disk usage
- ✅ Set appropriate WAL retention

**Debezium**:
- ✅ Tăng `tasks.max` lên 3-5 nếu có nhiều bảng
- ✅ Tune `max.batch.size` và `max.queue.size`
- ✅ Monitor connector health

**Kafka**:
- ✅ Replication factor ≥ 3
- ✅ Set up monitoring (Kafka UI, Prometheus)
- ✅ Configure retention policy

**Bridge Service**:
- ✅ Add retry logic với exponential backoff
- ✅ Dead Letter Queue cho failed messages
- ✅ Metrics và logging

**ClickHouse**:
- ✅ Batch inserts (gom nhiều records)
- ✅ Use async inserts
- ✅ Monitor query performance

### 4.2. Tối Ưu Performance

**Giảm Latency**:
```json
{
  "poll.interval.ms": "100",           // Poll Kafka thường xuyên hơn
  "max.batch.size": "2048",            // Batch lớn hơn
  "linger.ms": "10"                    // Wait time trước khi send batch
}
```

**Tăng Throughput**:
```json
{
  "tasks.max": "3",                    // Parallel processing
  "max.queue.size": "8192",            // Buffer lớn hơn
  "compression.type": "snappy"         // Compress data
}
```

---

## Kết Luận

Hệ thống CDC này cung cấp:
- ✅ **Real-time sync** với latency ~200-500ms
- ✅ **Reliable**: Không mất data nhờ WAL và Kafka
- ✅ **Scalable**: Có thể scale từng component độc lập
- ✅ **Maintainable**: Backend đơn giản, chỉ lo business logic

Bất kỳ thay đổi nào trong Postgres đều tự động được đồng bộ sang ClickHouse Cloud mà không cần code thêm!
