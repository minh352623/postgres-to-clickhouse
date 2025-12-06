#!/bin/bash

# ClickHouse Cloud Credentials
CLICKHOUSE_URL="https://h2zp7fbmjw.asia-southeast1.gcp.clickhouse.cloud:8443"
CLICKHOUSE_USER="default"
CLICKHOUSE_PASSWORD="CryI6p0oB.Cd6"

echo "🚀 Initializing ClickHouse Cloud Database..."

# Function to run query
run_query() {
    local query="$1"
    local description="$2"
    echo "📝 $description"
    curl -s -u "$CLICKHOUSE_USER:$CLICKHOUSE_PASSWORD" \
         "$CLICKHOUSE_URL" \
         --data "$query"
    echo ""
}

# 1. Drop existing request_spans table
echo "================================================"
run_query "DROP TABLE IF EXISTS request_spans" \
          "Dropping old request_spans table..."

# 2. Create request_spans table with UUID
echo "================================================"
run_query "CREATE TABLE IF NOT EXISTS request_spans (
    trace_id UUID,
    span_id UUID,
    parent_span_id Nullable(UUID),

    user_id String,
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
ORDER BY (trace_id, start_time)" \
          "Creating request_spans table with UUID..."

# 3. Create orders table
echo "================================================"
run_query "CREATE TABLE IF NOT EXISTS orders (
    order_id String,
    user_id String,
    amount Float64,
    status String,
    created_at DateTime,
    ingested_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (created_at, order_id)
SETTINGS index_granularity = 8192" \
          "Creating orders table..."

# 4. Drop old otel_traces if exists
echo "================================================"
run_query "DROP TABLE IF EXISTS otel_traces_trace_id_ts_mv" \
          "Dropping old materialized view..."
run_query "DROP TABLE IF EXISTS otel_traces_trace_id_ts" \
          "Dropping old trace tracking table..."
run_query "DROP TABLE IF EXISTS otel_traces" \
          "Dropping old otel_traces table..."

# 5. Create optimized otel_traces table
echo "================================================"
run_query "CREATE TABLE IF NOT EXISTS otel_traces (
    \`Timestamp\` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    \`TraceId\` String CODEC(ZSTD(1)),
    \`SpanId\` String CODEC(ZSTD(1)),
    \`ParentSpanId\` String CODEC(ZSTD(1)),
    \`TraceState\` String CODEC(ZSTD(1)),
    \`SpanName\` LowCardinality(String) CODEC(ZSTD(1)),
    \`SpanKind\` LowCardinality(String) CODEC(ZSTD(1)),
    \`ServiceName\` LowCardinality(String) CODEC(ZSTD(1)),
    \`ResourceAttributes\` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    \`ScopeName\` String CODEC(ZSTD(1)),
    \`ScopeVersion\` String CODEC(ZSTD(1)),
    \`SpanAttributes\` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    \`Duration\` Int64 CODEC(ZSTD(1)),
    \`StatusCode\` LowCardinality(String) CODEC(ZSTD(1)),
    \`StatusMessage\` String CODEC(ZSTD(1)),
    \`Events.Timestamp\` Array(DateTime64(9)) CODEC(ZSTD(1)),
    \`Events.Name\` Array(LowCardinality(String)) CODEC(ZSTD(1)),
    \`Events.Attributes\` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    \`Links.TraceId\` Array(String) CODEC(ZSTD(1)),
    \`Links.SpanId\` Array(String) CODEC(ZSTD(1)),
    \`Links.TraceState\` Array(String) CODEC(ZSTD(1)),
    \`Links.Attributes\` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_res_attr_key mapKeys(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_res_attr_value mapValues(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_key mapKeys(SpanAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_value mapValues(SpanAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_duration Duration TYPE minmax GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, SpanName, toUnixTimestamp(Timestamp), TraceId)" \
          "Creating optimized otel_traces table..."

# 6. Create trace tracking table
echo "================================================"
run_query "CREATE TABLE IF NOT EXISTS otel_traces_trace_id_ts (
    \`TraceId\` String CODEC(ZSTD(1)),
    \`Start\` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    \`End\` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    INDEX idx_trace_id TraceId TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree()
ORDER BY (TraceId, toUnixTimestamp(Start))" \
          "Creating trace tracking table..."

# 7. Create materialized view
echo "================================================"
run_query "CREATE MATERIALIZED VIEW IF NOT EXISTS otel_traces_trace_id_ts_mv TO otel_traces_trace_id_ts
AS SELECT
    TraceId,
    min(Timestamp) AS Start,
    max(Timestamp) AS End
FROM otel_traces
WHERE TraceId != ''
GROUP BY TraceId" \
          "Creating materialized view for trace tracking..."

# 8. Verify tables creation
echo "================================================"
echo "✅ Verifying request_spans table structure..."
curl -s -u "$CLICKHOUSE_USER:$CLICKHOUSE_PASSWORD" \
     "$CLICKHOUSE_URL" \
     --data "DESCRIBE TABLE request_spans FORMAT Pretty"
echo ""

echo "================================================"
echo "✅ Verifying orders table structure..."
curl -s -u "$CLICKHOUSE_USER:$CLICKHOUSE_PASSWORD" \
     "$CLICKHOUSE_URL" \
     --data "DESCRIBE TABLE orders FORMAT Pretty"
echo ""

echo "================================================"
echo "✅ Verifying otel_traces table structure..."
curl -s -u "$CLICKHOUSE_USER:$CLICKHOUSE_PASSWORD" \
     "$CLICKHOUSE_URL" \
     --data "DESCRIBE TABLE otel_traces FORMAT Pretty"
echo ""

echo "================================================"
echo "✅ ClickHouse Cloud initialization complete!"
