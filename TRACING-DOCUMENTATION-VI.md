# Tài Liệu Distributed Tracing - Bảng request_spans

## Tổng Quan
Bảng `request_spans` trong ClickHouse lưu trữ dữ liệu distributed tracing để theo dõi các request qua các microservices. Mỗi hàng đại diện cho một "span" - một đơn vị công việc trong một giao dịch phân tán.

## Schema Bảng

```sql
CREATE TABLE IF NOT EXISTS request_spans (
    trace_id String,
    span_id String,
    parent_span_id String,

    user_id UInt32,
    service_id UInt16,

    operation String,
    status_code UInt16,
    success UInt8,

    start_time DateTime64(3),
    end_time DateTime64(3),
    duration_ms UInt32,

    request_payload String,
    response_payload String,

    meta_tags Map(String, String)
)
ENGINE = MergeTree()
ORDER BY (trace_id, start_time);
```

---

## Mô Tả Các Trường

### Các Định Danh Cốt Lõi

#### `trace_id` (String)
- **Mục đích**: Định danh duy nhất cho toàn bộ giao dịch phân tán qua tất cả các service
- **Định dạng**: Chuỗi hex 64-bit (16 ký tự)
- **Cấu trúc bit**: `user_id (32 bits) | service_id (10 bits) | random (22 bits)`
- **Ví dụ**: `00030d4000800abc1234`
- **Cách dùng**: Nhóm tất cả các span thuộc cùng một luồng request
- **Ghi chú**: Tất cả services xử lý một client request sẽ chia sẻ cùng `trace_id`

#### `span_id` (String)
- **Mục đích**: Định danh duy nhất cho operation/span cụ thể này
- **Định dạng**: Chuỗi hex 64-bit (16 ký tự)
- **Tạo ra**: Được tạo bởi mỗi service cho mỗi operation nó thực hiện
- **Ví dụ**: `00030d4000c00def5678`
- **Cách dùng**: Xác định một công việc cụ thể trong một trace
- **Ghi chú**: Mỗi service tạo `span_id` riêng khi xử lý request

#### `parent_span_id` (String)
- **Mục đích**: Liên kết span này với span cha (operation đã kích hoạt span này)
- **Định dạng**: Chuỗi hex 64-bit, hoặc chuỗi rỗng cho root span
- **Ví dụ**: `00030d4000800abc1234` (tham chiếu đến `span_id` của span khác)
- **Cách dùng**: Tạo mối quan hệ cha-con giữa các span
- **Ghi chú**: 
  - Root span (span đầu tiên): `parent_span_id = ""`
  - Child spans: `parent_span_id = <span_id của cha>`
  - Cho phép xây dựng cây phân cấp cuộc gọi

---

### Ngữ Cảnh User & Service

#### `user_id` (UInt32)
- **Mục đích**: Xác định user nào thực hiện request
- **Phạm vi**: 0 đến 4,294,967,295
- **Nguồn**: Trích xuất từ JWT token hoặc session
- **Ví dụ**: `12345`
- **Cách dùng**: 
  - Theo dõi hành vi của từng user
  - Lọc traces theo user
  - Tính toán metrics theo user
- **Ghi chú**: `0` nghĩa là chưa xác thực hoặc không có user ID

#### `service_id` (UInt16)
- **Mục đích**: Xác định microservice nào tạo span này
- **Phạm vi**: 0 đến 1,023 (chỉ dùng 10 bits trong trace ID)
- **Phân bổ hiện tại**:
  - `1` = Frontend
  - `2` = Backend (Order Service)
  - `3` = Payment Service
- **Ví dụ**: `2` (Backend service)
- **Cách dùng**: 
  - Nhóm spans theo service
  - Trực quan hóa dependencies giữa các service
  - Tính toán độ trễ theo service
- **Ghi chú**: Được sử dụng trong thuật toán tạo trace ID

---

### Chi Tiết Operation

#### `operation` (String)
- **Mục đích**: Mô tả operation mà span này đại diện
- **Định dạng**: Thường là `HTTP_METHOD /path` hoặc tên function
- **Ví dụ**: 
  - `POST /api/orders`
  - `GET /api/traces`
  - `POST /api/payments/process`
- **Cách dùng**: 
  - Xác định các endpoint chậm
  - Nhóm các operation tương tự
  - Debug các operation cụ thể
- **Ghi chú**: Nên mô tả rõ ràng nhưng ngắn gọn

#### `status_code` (UInt16)
- **Mục đích**: HTTP status code hoặc mã kết quả operation
- **Phạm vi**: 0 đến 65,535
- **Giá trị phổ biến**:
  - `200` = OK
  - `201` = Created
  - `400` = Bad Request
  - `401` = Unauthorized
  - `500` = Internal Server Error
- **Ví dụ**: `200`
- **Cách dùng**: 
  - Xác định các request thất bại
  - Tính tỷ lệ lỗi
  - Cảnh báo lỗi 5xx
- **Ghi chú**: Với operation không phải HTTP, dùng mã status phù hợp

#### `success` (UInt8)
- **Mục đích**: Boolean cho biết operation có thành công không
- **Giá trị**:
  - `1` = Thành công (status code 200-399)
  - `0` = Thất bại (status code 400+)
- **Ví dụ**: `1`
- **Cách dùng**: 
  - Lọc nhanh thành công/thất bại
  - Tính tỷ lệ thành công
  - Giám sát SLA
- **Ghi chú**: Được tính từ `status_code` khi tạo span

---

### Thông Tin Thời Gian

#### `start_time` (DateTime64(3))
- **Mục đích**: Thời điểm operation bắt đầu
- **Độ chính xác**: Milliseconds (3 chữ số thập phân)
- **Định dạng**: ISO 8601 datetime
- **Ví dụ**: `2025-12-05T08:00:00.123Z`
- **Cách dùng**: 
  - Tính duration
  - Tạo trực quan hóa timeline
  - Sắp xếp spans theo thứ tự thời gian
- **Ghi chú**: Nên dùng UTC timezone

#### `end_time` (DateTime64(3))
- **Mục đích**: Thời điểm operation hoàn thành
- **Độ chính xác**: Milliseconds (3 chữ số thập phân)
- **Định dạng**: ISO 8601 datetime
- **Ví dụ**: `2025-12-05T08:00:00.532Z`
- **Cách dùng**: 
  - Tính duration
  - Xác định các operation chồng chéo
  - Trực quan hóa timeline
- **Ghi chú**: Phải >= `start_time`

#### `duration_ms` (UInt32)
- **Mục đích**: Thời gian operation mất bao lâu
- **Đơn vị**: Milliseconds
- **Phạm vi**: 0 đến 4,294,967,295 ms (~49 ngày tối đa)
- **Công thức**: `end_time - start_time`
- **Ví dụ**: `409` (409ms)
- **Cách dùng**: 
  - Xác định operations chậm
  - Tính percentiles (p50, p95, p99)
  - Tối ưu performance
- **Ghi chú**: Dư thừa với start/end time nhưng hữu ích cho queries

---

### Dữ Liệu Payload

#### `request_payload` (String)
- **Mục đích**: Lưu dữ liệu request để debug
- **Định dạng**: Chuỗi JSON
- **Nội dung**: HTTP method, path, query params, headers (đã làm sạch)
- **Ví dụ**: 
  ```json
  "{\"method\":\"POST\",\"path\":\"/api/orders\",\"query\":{}}"
  ```
- **Cách dùng**: 
  - Debug các request thất bại
  - Tái tạo lại vấn đề
  - Audit trail
- **Ghi chú**: 
  - **Bảo mật**: KHÔNG BAO GIỜ lưu passwords, API keys, hoặc PII
  - Payload lớn nên được cắt ngắn
  - Cân nhắc chính sách lưu trữ dữ liệu

#### `response_payload` (String)
- **Mục đích**: Lưu dữ liệu response để debug
- **Định dạng**: Chuỗi JSON
- **Nội dung**: Status code, response body (đã làm sạch)
- **Ví dụ**: 
  ```json
  "{\"status\":201,\"body\":{\"order_id\":\"12345\"}}"
  ```
- **Cách dùng**: 
  - Debug response không mong đợi
  - Xác minh data transformations
  - Audit trail
- **Ghi chú**: 
  - **Bảo mật**: Làm sạch dữ liệu nhạy cảm
  - Cắt ngắn response lớn
  - Giám sát dung lượng lưu trữ

---

### Metadata

#### `meta_tags` (Map(String, String))
- **Mục đích**: Các cặp key-value linh hoạt cho ngữ cảnh bổ sung
- **Định dạng**: ClickHouse Map type
- **Keys phổ biến**:
  - `pod_id`: Định danh container/instance
  - `version`: Phiên bản service (vd: "v1.0.0")
  - `region`: Vùng triển khai
  - `customer_tier`: Tier khách hàng (free/pro/enterprise)
- **Ví dụ**: 
  ```json
  {
    "pod_id": "backend-01",
    "version": "v1.0.0",
    "region": "us-west-2"
  }
  ```
- **Cách dùng**: 
  - Lọc traces theo deployment
  - So sánh các versions
  - Lọc multi-tenant
- **Ghi chú**: Có thể mở rộng cho metadata tùy chỉnh

---

## Ví Dụ Luồng Request

### Kịch Bản
User tạo đơn hàng, kích hoạt xử lý thanh toán.

### Sơ Đồ Luồng
```
Client
  │
  ├─ [Span 1] Frontend nhận request
  │   trace_id: abc123...
  │   span_id: abc123...
  │   parent_span_id: (rỗng)
  │   service_id: 1
  │   operation: POST /create-order
  │   user_id: 12345
  │
  └─→ [Span 2] Backend xử lý đơn hàng
      │   trace_id: abc123... (giống)
      │   span_id: def456...
      │   parent_span_id: abc123...
      │   service_id: 2
      │   operation: POST /api/orders
      │   user_id: 12345
      │
      └─→ [Span 3] Payment service xử lý thanh toán
          trace_id: abc123... (giống)
          span_id: ghi789...
          parent_span_id: def456...
          service_id: 3
          operation: POST /api/payments/process
          user_id: 12345
```

### Dữ Liệu Kết Quả
```sql
-- Span 1: Frontend
INSERT INTO request_spans VALUES (
  'abc123...', -- trace_id
  'abc123...', -- span_id (giống trace cho root)
  '',          -- parent_span_id (root span)
  12345,       -- user_id
  1,           -- service_id (Frontend)
  'POST /create-order',
  200,         -- status_code
  1,           -- success
  '2025-12-05T08:00:00.000Z', -- start_time
  '2025-12-05T08:00:00.450Z', -- end_time
  450,         -- duration_ms
  '{"method":"POST","path":"/create-order"}',
  '{"status":200}',
  {'pod_id': 'frontend-01', 'version': 'v1.0.0'}
);

-- Span 2: Backend
INSERT INTO request_spans VALUES (
  'abc123...', -- trace_id (giống)
  'def456...', -- span_id (mới)
  'abc123...', -- parent_span_id (tham chiếu Span 1)
  12345,       -- user_id
  2,           -- service_id (Backend)
  'POST /api/orders',
  201,         -- status_code
  1,           -- success
  '2025-12-05T08:00:00.050Z', -- start_time
  '2025-12-05T08:00:00.400Z', -- end_time
  350,         -- duration_ms
  '{"method":"POST","path":"/api/orders","body":{"amount":100}}',
  '{"status":201,"order_id":"ord_123"}',
  {'pod_id': 'backend-02', 'version': 'v1.0.0'}
);

-- Span 3: Payment
INSERT INTO request_spans VALUES (
  'abc123...', -- trace_id (giống)
  'ghi789...', -- span_id (mới)
  'def456...', -- parent_span_id (tham chiếu Span 2)
  12345,       -- user_id
  3,           -- service_id (Payment)
  'POST /api/payments/process',
  200,         -- status_code
  1,           -- success
  '2025-12-05T08:00:00.250Z', -- start_time
  '2025-12-05T08:00:00.380Z', -- end_time
  130,         -- duration_ms
  '{"order_id":"ord_123","amount":100}',
  '{"status":"completed","payment_id":"pay_456"}',
  {'pod_id': 'payment-01', 'version': 'v1.0.0'}
);
```

---

## Các Query Phổ Biến

### 1. Lấy tất cả spans của một trace
```sql
SELECT * 
FROM request_spans 
WHERE trace_id = 'abc123...'
ORDER BY start_time;
```

### 2. Tìm operations chậm
```sql
SELECT 
  service_id,
  operation,
  avg(duration_ms) as avg_duration,
  max(duration_ms) as max_duration,
  count() as count
FROM request_spans
WHERE start_time >= now() - INTERVAL 1 HOUR
GROUP BY service_id, operation
ORDER BY avg_duration DESC
LIMIT 10;
```

### 3. Tính tỷ lệ thành công
```sql
SELECT 
  service_id,
  operation,
  sum(success) as successful,
  count() as total,
  (sum(success) / count()) * 100 as success_rate
FROM request_spans
WHERE start_time >= now() - INTERVAL 1 DAY
GROUP BY service_id, operation;
```

### 4. Tìm traces có lỗi
```sql
SELECT DISTINCT trace_id
FROM request_spans
WHERE success = 0
  AND start_time >= now() - INTERVAL 1 HOUR;
```

### 5. Theo dõi hoạt động user
```sql
SELECT 
  user_id,
  count(DISTINCT trace_id) as requests,
  avg(duration_ms) as avg_latency
FROM request_spans
WHERE user_id > 0
  AND start_time >= now() - INTERVAL 1 DAY
GROUP BY user_id
ORDER BY requests DESC
LIMIT 100;
```

---

## Best Practices

### 1. Lưu Trữ Dữ Liệu
- Giữ spans chi tiết trong 7-30 ngày
- Tổng hợp dữ liệu cũ vào bảng summary
- Lưu trữ traces quan trọng lâu hơn nếu cần

### 2. Làm Sạch Payload
```typescript
// Tốt: Đã làm sạch
request_payload: JSON.stringify({
  method: req.method,
  path: req.path,
  // KHÔNG BAO GỒM: passwords, tokens, thẻ tín dụng
});

// Không tốt: Request thô
request_payload: JSON.stringify(req.body); // Có thể chứa dữ liệu nhạy cảm
```

### 3. Sử Dụng Meta Tags
- Thêm thông tin deployment (`pod_id`, `version`)
- Thêm ngữ cảnh business (`customer_tier`, `feature_flag`)
- Giữ tên tags nhất quán giữa các services
- Giới hạn 5-10 tags mỗi span

### 4. Performance
- Index trên `(trace_id, start_time)` cho trace queries
- Index trên `user_id` nếu queries theo user phổ biến
- Partition theo ngày cho queries lịch sử nhanh hơn
- Giám sát kích thước bảng và tốc độ insert

---

## Trực Quan Hóa

Biểu đồ waterfall hiển thị:
- **Trục X**: Thời gian (milliseconds)
- **Trục Y**: Services
- **Thanh**: Duration của mỗi span
- **Màu sắc**: Các services khác nhau

Ví dụ trực quan từ [http://localhost:3000/tracing](http://localhost:3000/tracing):
```
Frontend:  |====40ms====|
Backend:            |=====350ms=====|
Payment:                       |==130ms==|
```
