#!/bin/sh
# Auto-register Debezium connector

set -e

echo "⏳ Waiting for Kafka Connect..."
sleep 30

until curl -s -f "http://kafka-connect:8083/connectors" > /dev/null; do
    echo "   Waiting for Kafka Connect..."
    sleep 5
done

echo "🚀 Registering Debezium connector..."
curl -X POST \
    -H "Content-Type: application/json" \
    --data @/config/connector-config.json \
    "http://kafka-connect:8083/connectors"

echo ""
echo "✅ Connector registered!"
