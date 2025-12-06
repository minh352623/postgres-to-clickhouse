# Distributed Tracing Documentation - request_spans Table

## Overview
The `request_spans` table in ClickHouse stores distributed tracing data for tracking requests across microservices. Each row represents a single "span" - a unit of work in a distributed transaction.

## Table Schema

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

## Field Descriptions

### Core Identifiers

#### `trace_id` (String)
- **Purpose**: Unique identifier for an entire distributed transaction across all services
- **Format**: 64-bit hex string (16 characters)
- **Bit Layout**: `user_id (32 bits) | service_id (10 bits) | random (22 bits)`
- **Example**: `00030d4000800abc1234`
- **Usage**: Groups all spans that belong to the same request flow
- **Notes**: All services involved in handling a single client request share the same `trace_id`

#### `span_id` (String)
- **Purpose**: Unique identifier for this specific operation/span
- **Format**: 64-bit hex string (16 characters)
- **Generation**: Created by each service for each operation it performs
- **Example**: `00030d4000c00def5678`
- **Usage**: Identifies a specific piece of work within a trace
- **Notes**: Each service generates its own `span_id` when processing a request

#### `parent_span_id` (String)
- **Purpose**: Links this span to its parent span (the operation that triggered this one)
- **Format**: 64-bit hex string, or empty string for root spans
- **Example**: `00030d4000800abc1234` (references another span's `span_id`)
- **Usage**: Creates parent-child relationships between spans
- **Notes**: 
  - Root span (first span in a trace): `parent_span_id = ""`
  - Child spans: `parent_span_id = <parent's span_id>`
  - Enables building the call hierarchy

---

### User & Service Context

#### `user_id` (UInt32)
- **Purpose**: Identifies which user made the request
- **Range**: 0 to 4,294,967,295
- **Source**: Extracted from JWT token or session
- **Example**: `12345`
- **Usage**: 
  - Track individual user behavior
  - Filter traces by user
  - Calculate per-user metrics
- **Notes**: `0` means unauthenticated or user ID not available

#### `service_id` (UInt16)
- **Purpose**: Identifies which microservice created this span
- **Range**: 0 to 1,023 (only 10 bits used in trace ID)
- **Current Assignments**:
  - `1` = Frontend
  - `2` = Backend (Order Service)
  - `3` = Payment Service
- **Example**: `2` (Backend service)
- **Usage**: 
  - Group spans by service
  - Visualize service dependencies
  - Calculate per-service latency
- **Notes**: Used in trace ID generation algorithm

---

### Operation Details

#### `operation` (String)
- **Purpose**: Describes what operation this span represents
- **Format**: Typically `HTTP_METHOD /path` or function name
- **Examples**: 
  - `POST /api/orders`
  - `GET /api/traces`
  - `POST /api/payments/process`
- **Usage**: 
  - Identify slow endpoints
  - Group similar operations
  - Debug specific operations
- **Notes**: Should be descriptive but concise

#### `status_code` (UInt16)
- **Purpose**: HTTP status code or operation result code
- **Range**: 0 to 65,535
- **Common Values**:
  - `200` = OK
  - `201` = Created
  - `400` = Bad Request
  - `401` = Unauthorized
  - `500` = Internal Server Error
- **Example**: `200`
- **Usage**: 
  - Identify failed requests
  - Calculate error rates
  - Alert on 5xx errors
- **Notes**: For non-HTTP operations, use appropriate status codes

#### `success` (UInt8)
- **Purpose**: Boolean indicating if the operation succeeded
- **Values**:
  - `1` = Success (status code 200-399)
  - `0` = Failure (status code 400+)
- **Example**: `1`
- **Usage**: 
  - Quick success/failure filtering
  - Calculate success rates
  - SLA monitoring
- **Notes**: Derived from `status_code` during span creation

---

### Timing Information

#### `start_time` (DateTime64(3))
- **Purpose**: When the operation started
- **Precision**: Milliseconds (3 decimal places)
- **Format**: ISO 8601 datetime
- **Example**: `2025-12-05T08:00:00.123Z`
- **Usage**: 
  - Calculate duration
  - Create timeline visualizations
  - Order spans chronologically
- **Notes**: UTC timezone recommended

#### `end_time` (DateTime64(3))
- **Purpose**: When the operation completed
- **Precision**: Milliseconds (3 decimal places)
- **Format**: ISO 8601 datetime
- **Example**: `2025-12-05T08:00:00.532Z`
- **Usage**: 
  - Calculate duration
  - Identify overlapping operations
  - Timeline visualization
- **Notes**: Must be >= `start_time`

#### `duration_ms` (UInt32)
- **Purpose**: How long the operation took
- **Unit**: Milliseconds
- **Range**: 0 to 4,294,967,295 ms (~49 days max)
- **Calculation**: `end_time - start_time`
- **Example**: `409` (409ms)
- **Usage**: 
  - Identify slow operations
  - Calculate percentiles (p50, p95, p99)
  - Performance optimization
- **Notes**: Redundant with start/end times but useful for queries

---

### Payload Data

#### `request_payload` (String)
- **Purpose**: Stores request data for debugging
- **Format**: JSON string
- **Content**: HTTP method, path, query params, headers (sanitized)
- **Example**: 
  ```json
  "{\"method\":\"POST\",\"path\":\"/api/orders\",\"query\":{}}"
  ```
- **Usage**: 
  - Debug failed requests
  - Reproduce issues
  - Audit trail
- **Notes**: 
  - **Security**: Never store passwords, API keys, or PII
  - Large payloads should be truncated
  - Consider data retention policies

#### `response_payload` (String)
- **Purpose**: Stores response data for debugging
- **Format**: JSON string
- **Content**: Status code, response body (sanitized)
- **Example**: 
  ```json
  "{\"status\":201,\"body\":{\"order_id\":\"12345\"}}"
  ```
- **Usage**: 
  - Debug unexpected responses
  - Verify data transformations
  - Audit trail
- **Notes**: 
  - **Security**: Sanitize sensitive data
  - Truncate large responses
  - Monitor storage growth

---

### Metadata

#### `meta_tags` (Map(String, String))
- **Purpose**: Flexible key-value pairs for additional context
- **Format**: ClickHouse Map type
- **Common Keys**:
  - `pod_id`: Container/instance identifier
  - `version`: Service version (e.g., "v1.0.0")
  - `region`: Deployment region
  - `customer_tier`: Customer tier (free/pro/enterprise)
- **Example**: 
  ```json
  {
    "pod_id": "backend-01",
    "version": "v1.0.0",
    "region": "us-west-2"
  }
  ```
- **Usage**: 
  - Filter traces by deployment
  - Compare versions
  - Multi-tenant filtering
- **Notes**: Extensible for custom metadata

---

## Request Flow Example

### Scenario
User creates an order, triggering payment processing.

### Flow Diagram
```
Client
  │
  ├─ [Span 1] Frontend receives request
  │   trace_id: abc123...
  │   span_id: abc123...
  │   parent_span_id: (empty)
  │   service_id: 1
  │   operation: POST /create-order
  │   user_id: 12345
  │
  └─→ [Span 2] Backend processes order
      │   trace_id: abc123... (same)
      │   span_id: def456...
      │   parent_span_id: abc123...
      │   service_id: 2
      │   operation: POST /api/orders
      │   user_id: 12345
      │
      └─→ [Span 3] Payment service processes payment
          trace_id: abc123... (same)
          span_id: ghi789...
          parent_span_id: def456...
          service_id: 3
          operation: POST /api/payments/process
          user_id: 12345
```

### Resulting Data
```sql
-- Span 1: Frontend
INSERT INTO request_spans VALUES (
  'abc123...', -- trace_id
  'abc123...', -- span_id (same as trace for root)
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
  'abc123...', -- trace_id (same)
  'def456...', -- span_id (new)
  'abc123...', -- parent_span_id (references Span 1)
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
  'abc123...', -- trace_id (same)
  'ghi789...', -- span_id (new)
  'def456...', -- parent_span_id (references Span 2)
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

## Common Queries

### 1. Get all spans for a trace
```sql
SELECT * 
FROM request_spans 
WHERE trace_id = 'abc123...'
ORDER BY start_time;
```

### 2. Find slow operations
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

### 3. Calculate success rate
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

### 4. Find traces with errors
```sql
SELECT DISTINCT trace_id
FROM request_spans
WHERE success = 0
  AND start_time >= now() - INTERVAL 1 HOUR;
```

### 5. User activity tracking
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

### 1. Data Retention
- Keep detailed spans for 7-30 days
- Aggregate older data into summary tables
- Archive critical traces longer if needed

### 2. Payload Sanitization
```typescript
// Good: Sanitized
request_payload: JSON.stringify({
  method: req.method,
  path: req.path,
  // DO NOT include: passwords, tokens, credit cards
});

// Bad: Raw request
request_payload: JSON.stringify(req.body); // May contain sensitive data
```

### 3. Meta Tags Usage
- Add deployment info (`pod_id`, `version`)
- Add business context (`customer_tier`, `feature_flag`)
- Keep tag names consistent across services
- Limit to 5-10 tags per span

### 4. Performance
- Index on `(trace_id, start_time)` for trace queries
- Index on `user_id` if user-specific queries are common
- Partition by date for faster historical queries
- Monitor table size and insertion rate

---

## Visualization

The waterfall chart shows:
- **X-axis**: Time (milliseconds)
- **Y-axis**: Services
- **Bars**: Duration of each span
- **Colors**: Different services

Example visualization from [http://localhost:3000/tracing](http://localhost:3000/tracing):
```
Frontend:  |====40ms====|
Backend:            |=====350ms=====|
Payment:                       |==130ms==|
```
