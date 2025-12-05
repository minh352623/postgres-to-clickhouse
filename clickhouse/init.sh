#!/bin/bash
# ClickHouse initialization script
# This script waits for ClickHouse to be ready and then runs init.sql

set -e

echo "Waiting for ClickHouse to be ready..."

# Wait for ClickHouse to accept connections
until clickhouse-client --host clickhouse --query "SELECT 1" > /dev/null 2>&1; do
  echo "  ClickHouse is unavailable - sleeping"
  sleep 2
done

echo "✓ ClickHouse is ready!"

# Run initialization SQL
echo "Running initialization SQL..."
clickhouse-client --host clickhouse --multiquery < /docker-entrypoint-initdb.d/init.sql

echo "✓ ClickHouse initialization complete!"
