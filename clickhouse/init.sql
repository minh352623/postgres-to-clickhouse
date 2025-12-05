-- ============================================================================
-- ClickHouse Schema for Order Events Streaming Pipeline
-- ============================================================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS default;

-- ============================================================================
-- Kafka Engine Table (Consumer)
-- ============================================================================
-- This table consumes messages from Kafka topic 'order_events'
-- It acts as a bridge between Kafka and ClickHouse

CREATE TABLE IF NOT EXISTS order_events_kafka (
    order_id String,
    user_id String,
    amount Float64,
    status String,
    created_at Int64
)
ENGINE = Kafka
SETTINGS 
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'order_events',
    kafka_group_name = 'clickhouse-consumer-group',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 1,
    kafka_skip_broken_messages = 10;

-- ============================================================================
-- Target MergeTree Table (Persistent Storage)
-- ============================================================================
-- This is where the actual data is stored for analytics

CREATE TABLE IF NOT EXISTS orders (
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
SETTINGS index_granularity = 8192;

-- ============================================================================
-- Materialized View (Real-time Ingestion)
-- ============================================================================
-- Automatically moves data from Kafka table to MergeTree table

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_orders TO orders AS
SELECT 
    order_id,
    user_id,
    amount,
    status,
    toDateTime(created_at) as created_at
FROM order_events_kafka;

-- ============================================================================
-- User Statistics Aggregation Table
-- ============================================================================
-- Aggregates order stats by user for faster queries

CREATE TABLE IF NOT EXISTS user_stats (
    user_id String,
    total_orders UInt64,
    total_amount Float64,
    last_order_at DateTime
)
ENGINE = SummingMergeTree()
ORDER BY user_id;

-- Materialized view to populate user stats
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_stats TO user_stats AS
SELECT 
    user_id,
    count() as total_orders,
    sum(amount) as total_amount,
    max(created_at) as last_order_at
FROM orders
GROUP BY user_id;

-- ============================================================================
-- Order Status Aggregation Table
-- ============================================================================
-- Aggregates orders by status for dashboard metrics

CREATE TABLE IF NOT EXISTS status_stats (
    status String,
    order_count UInt64,
    total_amount Float64
)
ENGINE = SummingMergeTree()
ORDER BY status;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_status_stats TO status_stats AS
SELECT 
    status,
    count() as order_count,
    sum(amount) as total_amount
FROM orders
GROUP BY status;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Add indexes to improve query performance
ALTER TABLE orders ADD INDEX idx_user_id (user_id) TYPE bloom_filter(0.01) GRANULARITY 1;
ALTER TABLE orders ADD INDEX idx_status (status) TYPE set(0) GRANULARITY 1;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check if data is flowing
-- SELECT count() FROM orders;
-- SELECT status, count() FROM orders GROUP BY status;
-- SELECT toStartOfMinute(created_at) as minute, count() FROM orders GROUP BY minute ORDER BY minute DESC LIMIT 10;
