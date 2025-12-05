# Luồng Publish Message Vào Kafka - Giải Thích Chi Tiết

## Tổng Quan

Trong hệ thống CDC của chúng ta, **Debezium** là thành phần chịu trách nhiệm publish messages vào Kafka. Không phải backend, không phải Postgres, mà là **Debezium Connector** đọc WAL và tự động publish.

---

## Flow Chi Tiết: Từ Postgres INSERT đến Kafka Message

### Bước 1: Backend Tạo Order (Client → Backend → Postgres)

```typescript
// backend/src/services/orderService.ts
export async function createOrder(input: CreateOrderInput) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');  // ← Bắt đầu transaction
    
    // INSERT vào Postgres
    const result = await client.query(
      `INSERT INTO orders (order_id, user_id, amount, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [order_id, user_id, amount, status]
    );
    
    await client.query('COMMIT');  // ← COMMIT transaction
    
    return result.rows[0];
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
```

**Điểm quan trọng**: 
- Backend **KHÔNG** publish gì vào Kafka cả
- Backend chỉ viết vào Postgres
- Message sẽ được publish **SAU KHI** `COMMIT` thành công

---

### Bước 2: Postgres Ghi WAL (Write-Ahead Log)

**Khi `COMMIT` được thực thi, Postgres thực hiện:**

```
┌─────────────────────────────────────────┐
│  COMMIT Transaction                     │
└─────────────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│  1. Ghi vào WAL File                    │
│     - LSN: 0/1A2B3C4D                   │
│     - Operation: INSERT                 │
│     - Table: public.orders              │
│     - Data: (order_id, user_id, ...)   │
└─────────────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│  2. Flush WAL to Disk                   │
│     (fsync để đảm bảo durability)       │
└─────────────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│  3. Update Data Files                   │
│     Ghi data vào table file             │
└─────────────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│  4. COMMIT Success ✓                    │
│     Trả về kết quả cho Backend          │
└─────────────────────────────────────────┘
```

**File WAL sẽ chứa entry như sau** (logical decoding format):

```
BEGIN 12345;
table public.orders: INSERT: 
  order_id[text]:'abc-123' 
  user_id[text]:'user-456' 
  amount[numeric]:'199.99' 
  status[text]:'created'
  created_at[timestamp]:'2025-12-05 12:00:00'
  updated_at[timestamp]:'2025-12-05 12:00:00'
COMMIT 12345;
```

---

### Bước 3: Debezium Đọc WAL (Khi Nào?)

Debezium **liên tục** đọc WAL theo cơ chế **streaming replication**. Nó không đợi, không có delay cố định.

#### 3.1. Cơ Chế Streaming Replication

```
┌──────────────────────────────────────────────────┐
│  PostgreSQL WAL Writer Process                   │
│  - Continuously writes to WAL                    │
└──────────────────────────────────────────────────┘
                    │
                    │ Real-time Stream
                    ↓
┌──────────────────────────────────────────────────┐
│  Replication Slot: "orders_debezium_slot"       │
│  - Position: LSN 0/1A2B3C4D                     │
│  - Consumer: Debezium Connector                  │
└──────────────────────────────────────────────────┘
                    │
                    │ Logical Decoding Protocol
                    ↓
┌──────────────────────────────────────────────────┐
│  Debezium Connector (Kafka Connect)              │
│  - Receives WAL changes in real-time            │
│  - Uses pgoutput plugin                          │
└──────────────────────────────────────────────────┘
```

#### 3.2. Timeline Chi Tiết

| Thời gian | Sự kiện | Trạng thái |
|-----------|---------|------------|
| **T = 0ms** | Backend execute `COMMIT` | Transaction chưa commit |
| **T = 5ms** | Postgres ghi WAL entry | WAL entry created |
| **T = 6ms** | Postgres fsync WAL to disk | WAL persisted |
| **T = 7ms** | **COMMIT thành công** | Transaction committed ✓ |
| **T = 8ms** | **Debezium nhận WAL event** | Via streaming replication |
| **T = 10ms** | Debezium parse & transform | CDC event created |
| **T = 15ms** | **Publish vào Kafka** | Message in Kafka ✓ |

**Tổng latency từ COMMIT đến Kafka**: ~8-15ms (sub-second!)

---

### Bước 4: Debezium Parse và Transform

**Input từ WAL (logical decoding)**:

```json
{
  "change": [
    {
      "kind": "insert",
      "schema": "public",
      "table": "orders",
      "columnnames": ["order_id", "user_id", "amount", "status", "created_at", "updated_at"],
      "columntypes": ["text", "text", "numeric", "text", "timestamp", "timestamp"],
      "columnvalues": ["abc-123", "user-456", "199.99", "created", "2025-12-05 12:00:00", "2025-12-05 12:00:00"]
    }
  ]
}
```

**Debezium Transform (với ExtractNewRecordState)**:

```javascript
// Debezium internal processing
const event = {
  before: null,  // INSERT không có "before" value
  after: {
    order_id: "abc-123",
    user_id: "user-456",
    amount: "199.99",
    status: "created",
    created_at: 1733382000000000,  // microseconds
    updated_at: 1733382000000000
  },
  source: {
    version: "2.5",
    connector: "postgresql",
    name: "orderserver",
    ts_ms: 1733382000015,
    db: "orders_db",
    schema: "public",
    table: "orders",
    lsn: 123456789
  },
  op: "c",  // c = create
  ts_ms: 1733382000015
};

// Apply ExtractNewRecordState transform
const transformedEvent = {
  ...event.after,
  __op: "c",
  __source_ts_ms: event.source.ts_ms,
  __deleted: "false"
};
```

**Output (message sẽ publish vào Kafka)**:

```json
{
  "order_id": "abc-123",
  "user_id": "user-456",
  "amount": "ALDu",  // Base64-encoded NUMERIC
  "status": "created",
  "created_at": 1733382000000000,
  "updated_at": 1733382000000000,
  "__op": "c",
  "__source_ts_ms": 1733382000015,
  "__deleted": "false"
}
```

---

### Bước 5: Publish Vào Kafka

#### 5.1. Debezium Kafka Producer

```java
// Debezium internal (Java code - minh họa)
public void handleChangeEvent(ChangeEvent event) {
    // 1. Determine topic name
    String topicName = topicPrefix + "." + schema + "." + table;
    // Example: "orderserver.public.orders"
    
    // 2. Create Kafka record
    ProducerRecord<String, String> record = new ProducerRecord<>(
        topicName,
        event.key(),      // order_id as key
        event.value()     // JSON CDC event
    );
    
    // 3. Send to Kafka
    kafkaProducer.send(record, (metadata, exception) -> {
        if (exception == null) {
            // Success - update replication slot position
            updateSlotPosition(event.lsn);
        } else {
            // Failed - retry or log error
            handleError(exception);
        }
    });
}
```

#### 5.2. Kafka Broker Nhận Message

```
┌────────────────────────────────────────┐
│  Kafka Broker                          │
├────────────────────────────────────────┤
│  Topic: orderserver.public.orders      │
│  Partition 0:                          │
│    Offset 12344: [old message]         │
│    Offset 12345: [new CDC event] ← NEW │
│                                        │
│  Leader: kafka-1                       │
│  Replicas: [kafka-1, kafka-2]          │
└────────────────────────────────────────┘
```

**Kafka Write Process**:

1. **Receive**: Broker nhận message từ Debezium
2. **Append**: Ghi vào log segment file
3. **Replicate**: Copy sang replica brokers (nếu có)
4. **ACK**: Gửi acknowledgment về Debezium
5. **Available**: Message sẵn sàng cho consumers

---

## Khi Nào Message Được Publish?

### Trigger Điều Kiện

| Event | Publish? | Giải thích |
|-------|----------|------------|
| **INSERT** | ✅ YES | Ngay sau COMMIT |
| **UPDATE** | ✅ YES | Ngay sau COMMIT |
| **DELETE** | ✅ YES | Ngay sau COMMIT (với __deleted flag) |
| **ROLLBACK** | ❌ NO | Transaction bị hủy, không có WAL entry |
| **Uncommitted INSERT** | ❌ NO | Chưa COMMIT = chưa ghi WAL |

### Trường Hợp Đặc Biệt

#### 1. Transaction Dài

```sql
BEGIN;
  INSERT INTO orders VALUES (...);  -- Chưa publish
  -- Do something else...
  UPDATE orders SET status = 'paid'; -- Vẫn chưa publish
  -- More work...
COMMIT;  -- ← CHỈ KHI NÀY mới publish 2 events
```

**Kết quả**: 2 messages được publish **cùng lúc** sau COMMIT:
1. Message cho INSERT
2. Message cho UPDATE

#### 2. Batch Insert

```sql
BEGIN;
  INSERT INTO orders VALUES (...);  -- Order 1
  INSERT INTO orders VALUES (...);  -- Order 2
  INSERT INTO orders VALUES (...);  -- Order 3
COMMIT;  -- ← Publish 3 messages
```

**Kết quả**: 3 messages, mỗi order một message.

#### 3. Error Handling

```sql
BEGIN;
  INSERT INTO orders VALUES (...);  -- OK
  INSERT INTO invalid_table VALUES (...);  -- ERROR!
ROLLBACK;  -- ← Không publish gì cả
```

**Kết quả**: Không có message nào vào Kafka.

---

## Latency Analysis

### Từ Backend COMMIT đến Kafka Message

```
Backend COMMIT Request
  │
  ├─→ Postgres WAL Write        : +5ms
  ├─→ Postgres COMMIT Success   : +2ms
  ├─→ Debezium Read WAL         : +3ms  (streaming, near real-time)
  ├─→ Debezium Transform        : +2ms
  ├─→ Kafka Producer Send       : +5ms
  └─→ Kafka Broker Write        : +3ms
      ────────────────────────────────
      Total: ~20ms (average)
```

### Latency Factors

**Fast (< 20ms)**:
- Postgres WAL được cache trong RAM
- Debezium streaming connection active
- Kafka broker trong cùng datacenter
- Không có backpressure

**Slow (50-100ms)**:
- WAL flush to disk (fsync overhead)
- Network latency cao
- Kafka broker replication slow
- High throughput causing buffering

---

## Monitoring: Làm Sao Biết Message Đã Publish?

### 1. Kiểm Tra Replication Slot

```sql
-- Trong Postgres
SELECT 
  slot_name,
  active,
  restart_lsn,
  confirmed_flush_lsn,
  pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) as lag_bytes
FROM pg_replication_slots
WHERE slot_name = 'orders_debezium_slot';
```

**Output**:
```
slot_name              | active | restart_lsn | confirmed_flush_lsn | lag_bytes
-----------------------+--------+-------------+---------------------+-----------
orders_debezium_slot   | true   | 0/1A2B3C4D  | 0/1A2B3C4C          | 1
```

- `active = true`: Debezium đang connected
- `lag_bytes`: Số bytes WAL chưa được Debezium consume
  - `0` = Real-time, không có lag
  - `> 1000000` = Có lag, Debezium chậm hơn Postgres

### 2. Kiểm Tra Kafka Topics

```bash
# List messages trong topic
docker exec streaming-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic orderserver.public.orders \
  --from-beginning \
  --max-messages 1
```

### 3. Debezium Connector Status

```bash
curl http://localhost:8083/connectors/postgres-orders-connector/status
```

**Output**:
```json
{
  "name": "postgres-orders-connector",
  "connector": {
    "state": "RUNNING",  ← Phải là RUNNING
    "worker_id": "kafka-connect:8083"
  },
  "tasks": [{
    "id": 0,
    "state": "RUNNING",  ← Task đang chạy
    "worker_id": "kafka-connect:8083"
  }]
}
```

---

## Tóm Tắt

### Khi Nào Publish?

**Ngay lập tức sau `COMMIT`** - không có delay, không cần trigger thủ công.

### Ai Publish?

**Debezium Connector** - không phải backend, không phải Postgres.

### Publish Gì?

**CDC Event** chứa:
- Toàn bộ row data (order_id, user_id, amount, status, ...)
- Operation type (`__op`: c/u/d/r)
- Timestamp (`__source_ts_ms`)
- Deletion flag (`__deleted`)

### Bao Lâu?

**~20ms latency** từ COMMIT đến Kafka (trong điều kiện bình thường).

---

## So Sánh: CDC vs Direct Publish

| Aspect | CDC (Debezium) | Direct Publish |
|--------|----------------|----------------|
| **Khi nào publish** | Tự động sau COMMIT | Backend phải gọi manual |
| **Guaranteed delivery** | ✅ YES (WAL-based) | ❌ NO (có thể fail) |
| **Order của events** | ✅ Đảm bảo | ❌ Không đảm bảo |
| **Code complexity** | 🟢 Low (auto) | 🔴 High (manual) |
| **Latency** | ~20ms | ~10ms (nếu async) |
| **Reliability** | 🟢 Very high | 🟡 Medium |

**Kết luận**: CDC với Debezium publish **tự động, reliable, và đúng thứ tự** mà không cần code gì thêm!
