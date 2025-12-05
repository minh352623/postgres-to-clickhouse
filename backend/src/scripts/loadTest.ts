import { v4 as uuidv4 } from 'uuid';
import { createOrder } from '../services/orderService';

const LOAD_TEST_COUNT = 1000;

async function loadTest() {
  console.log(`⚡ Starting load test: ${LOAD_TEST_COUNT} orders`);
  console.log(`   Start time: ${new Date().toISOString()}`);

  const startTime = Date.now();
  const statuses = ['created', 'paid', 'shipped', 'delivered', 'cancelled'];
  
  try {
    for (let i = 0; i < LOAD_TEST_COUNT; i++) {
      const user_id = uuidv4();
      
      await createOrder({
        user_id,
        amount: parseFloat((Math.random() * 1000 + 10).toFixed(2)),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        email: `loadtest_${user_id.slice(0, 8)}@demo.com`,
        name: `LoadTest User ${i + 1}`,
      });

      if ((i + 1) % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const rate = ((i + 1) / parseFloat(elapsed)).toFixed(2);
        console.log(`  Progress: ${i + 1}/${LOAD_TEST_COUNT} | ${elapsed}s elapsed | ${rate} orders/sec`);
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const avgRate = (LOAD_TEST_COUNT / parseFloat(totalTime)).toFixed(2);

    console.log(`\n✓ Load test complete!`);
    console.log(`  Orders created: ${LOAD_TEST_COUNT}`);
    console.log(`  Total time: ${totalTime}s`);
    console.log(`  Average rate: ${avgRate} orders/sec`);
    console.log(`  End time: ${new Date().toISOString()}`);

    process.exit(0);
  } catch (error) {
    console.error('Load test failed:', error);
    process.exit(1);
  }
}

loadTest();
