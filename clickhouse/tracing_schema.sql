CREATE TABLE IF NOT EXISTS request_spans (
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
ORDER BY (trace_id, start_time);

