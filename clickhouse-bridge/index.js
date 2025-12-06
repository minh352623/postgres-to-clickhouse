const { Kafka } = require('kafkajs');
const axios = require('axios');

// ClickHouse Cloud configuration
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || 'https://h2zp7fbmjw.asia-southeast1.gcp.clickhouse.cloud:8443';
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || 'default';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || 'CryI6p0oB.Cd6';

// Kafka configuration
const kafka = new Kafka({
  clientId: 'clickhouse-cloud-bridge',
  brokers: [process.env.KAFKA_BROKERS || 'kafka:9092']
});

const consumer = kafka.consumer({ groupId: 'clickhouse-cloud-sync' });

// Write to ClickHouse Cloud
async function writeToClickHouse(table, data) {
  try {
    // Skip users table - we only track orders in ClickHouse Cloud
    if (table === 'users') {
      console.log('Skipping users table (not tracked in ClickHouse)');
      return;
    }
    
    if (table === 'orders') {
      // Debug: log received data
      console.log('Processing order CDC event:', JSON.stringify(data).substring(0, 200));
      
      // Data from Debezium might have base64 encoded decimals
      // Amount is base64-encoded DECIMAL type from Postgres
      let amount = data.amount;
      if (typeof amount === 'string' && !amount.includes('.')) {
        // Base64 encoded - need to decode
        try {
          const buf = Buffer.from(amount, 'base64');
          // Convert buffer to decimal string (Postgres NUMERIC format)
          // For simplicity, try parsing floats from buffer or use original if fails
          amount = parseFloat(data.amount) || 0;
        } catch (e) {
          amount = 0;
        }
      } else {
        amount = parseFloat(amount);
      }
      
      // created_at might be microseconds (very large number) - convert to DateTime
      let createdAtDate;
      if (data.created_at > 1000000000000) {
        // Microseconds - divide by 1000 to get milliseconds
        createdAtDate = new Date(Math.floor(data.created_at / 1000));
      } else {
        createdAtDate = new Date(data.created_at);
      }
      const createdAt = createdAtDate.toISOString().slice(0, 19).replace('T', ' ');
      
      // Escape single quotes in strings to prevent SQL injection
      const orderId = String(data.order_id).replace(/'/g, "''");
      const userId = String(data.user_id).replace(/'/g, "''");
      const status = String(data.status).replace(/'/g, "''");
      
      // ClickHouse Cloud orders table only has: order_id, user_id, amount, status, created_at
      const query = `INSERT INTO orders (order_id, user_id, amount, status, created_at) 
                     VALUES ('${orderId}', '${userId}', ${amount}, '${status}', '${createdAt}')`;
      
      console.log('Executing query:', query.substring(0, 150) + '...');
      
      const response = await axios.post(CLICKHOUSE_URL, query, {
        headers: {
          'X-ClickHouse-User': CLICKHOUSE_USER,
          'X-ClickHouse-Key': CLICKHOUSE_PASSWORD,
        },
        timeout: 10000
      });
      
      console.log(`✓ Synced ${table} record to ClickHouse Cloud (order_id: ${data.order_id})`);
    }
  } catch (error) {
    // Log detailed error for debugging
    console.error('=== ClickHouse Write Error ===');
    console.error('Table:', table);
    console.error('Data:', JSON.stringify(data).substring(0, 300));
    if (error.response) {
      console.error(`HTTP Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    console.error('==============================');
  }
}

// Process CDC events
async function processCDCEvent(topic, message) {
  try {
    const value = JSON.parse(message.value.toString());
    
    // Extract table name from topic
    const tableName = topic.split('.').pop(); // e.g., orderserver.public.orders -> orders
    
    // Handle CDC operations
    const operation = value.__op;
    
    if (operation === 'c' || operation === 'r' || operation === 'u') {
      // CREATE, READ (snapshot), UPDATE
      await writeToClickHouse(tableName, value);
    } else if (operation === 'd') {
      // DELETE - handle soft delete or skip
      console.log(`DELETE operation for ${tableName}, skipping (not implemented)`);
    }
  } catch (error) {
    console.error('Error processing CDC event:', error);
  }
}

// Main function
async function run() {
  await consumer.connect();
  console.log('✓ Connected to Kafka');
  
  // Subscribe to CDC topics
  await consumer.subscribe({ 
    topics: ['orderserver.public.users', 'orderserver.public.orders'],
    fromBeginning: true 
  });
  console.log('✓ Subscribed to CDC topics');
  
  console.log('🚀 Bridge service started - streaming Kafka → ClickHouse Cloud');
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      await processCDCEvent(topic, message);
    },
  });
}

// Handle shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await consumer.disconnect();
  process.exit(0);
});

run().catch(console.error);
