# ClickHouse Cloud Configuration

## Environment Variables

Set these in your frontend `.env` file:

```env
CLICKHOUSE_URL=https://your-instance.clickhouse.cloud:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your_password
CLICKHOUSE_DATABASE=default
```

## Initialize ClickHouse Cloud

1. **Connect to your ClickHouse Cloud instance:**

```bash
clickhouse-client --host your-instance.clickhouse.cloud \
  --port 9440 \
  --secure \
  --user default \
  --password your_password
```

2. **Run the initialization SQL:**

```bash
clickhouse-client --host your-instance.clickhouse.cloud \
  --port 9440 \
  --secure \
  --user default \
  --password your_password \
  --multiquery < clickhouse/init.sql
```

Or copy the contents of `clickhouse/init.sql` and run them in the ClickHouse Cloud console.

## Update Kafka Connection

Since ClickHouse Cloud cannot directly access your local Kafka broker, you have two options:

### Option 1: Expose Kafka Publicly (Not Recommended for Production)

Use a tunnel service or modify docker-compose to expose Kafka with a public IP.

### Option 2: Use Kafka Cloud Service

Deploy Kafka to a cloud service (Confluent Cloud, AWS MSK, etc.) that ClickHouse Cloud can access.

Update the `init.sql` Kafka Engine settings:

```sql
CREATE TABLE order_events_kafka (
    order_id String,
    user_id String,
    amount Float64,
    status String,
    created_at Int64
)
ENGINE = Kafka
SETTINGS 
    kafka_broker_list = 'your-kafka-cloud-instance:9092',  -- Update this
    kafka_topic_list = 'order_events',
    kafka_group_name = 'clickhouse-consumer-group',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 1,
    kafka_skip_broken_messages = 10;
```

## Testing Connection

Test your frontend connection:

```bash
cd frontend
npm install
CLICKHOUSE_URL=https://your-instance.clickhouse.cloud:8443 \
CLICKHOUSE_USER=default \
CLICKHOUSE_PASSWORD=your_password \
npm run dev
```

Visit http://localhost:3000 to verify the dashboard connects to ClickHouse Cloud.
