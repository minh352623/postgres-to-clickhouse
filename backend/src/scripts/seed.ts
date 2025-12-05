import { v4 as uuidv4 } from 'uuid';
import { createOrder } from '../services/orderService';

const SEED_COUNT = 50;

async function seed() {
  console.log(`🌱 Seeding ${SEED_COUNT} demo orders...`);

  const statuses = ['created', 'paid', 'shipped', 'delivered'];
  const names = ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Eve Davis'];
  
  try {
    for (let i = 0; i < SEED_COUNT; i++) {
      const user_id = uuidv4();
      const name = names[Math.floor(Math.random() * names.length)];
      
      await createOrder({
        user_id,
        amount: parseFloat((Math.random() * 500 + 10).toFixed(2)),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        email: `${name.toLowerCase().replace(' ', '.')}@demo.com`,
        name,
      });

      if ((i + 1) % 10 === 0) {
        console.log(`  Created ${i + 1}/${SEED_COUNT} orders`);
      }
    }

    console.log(`✓ Seeding complete! Created ${SEED_COUNT} orders`);
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
