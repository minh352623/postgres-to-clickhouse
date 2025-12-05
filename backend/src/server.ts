import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { createOrder, getOrder, getOrders } from './services/orderService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Create single order
app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const { user_id, amount, status, email, name } = req.body;

    if (!amount || !status) {
      return res.status(400).json({ error: 'amount and status are required' });
    }

    const finalUserId = user_id || uuidv4();

    const order = await createOrder({
      user_id: finalUserId,
      amount: parseFloat(amount),
      status,
      email,
      name,
    });

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Bulk order creation (for load testing)
app.post('/api/orders/bulk', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 100;
    const statuses = ['created', 'paid', 'shipped', 'delivered'];
    const orders = [];

    console.log(`Starting bulk order creation: ${count} orders`);

    for (let i = 0; i < count; i++) {
      const user_id = uuidv4();
      const order = await createOrder({
        user_id,
        amount: parseFloat((Math.random() * 1000 + 10).toFixed(2)),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        email: `user_${user_id.slice(0, 8)}@demo.com`,
        name: `User ${i + 1}`,
      });
      orders.push(order);

      // Log progress every 100 orders
      if ((i + 1) % 100 === 0) {
        console.log(`Created ${i + 1}/${count} orders`);
      }
    }

    console.log(`✓ Bulk creation complete: ${orders.length} orders`);
    res.json({ 
      message: `Created ${orders.length} orders`,
      count: orders.length,
      sample: orders.slice(0, 5),
    });
  } catch (error) {
    console.error('Error in bulk creation:', error);
    res.status(500).json({ error: 'Failed to create bulk orders' });
  }
});

// Get single order
app.get('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const order = await getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Get recent orders
app.get('/api/orders', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const orders = await getOrders(limit);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend service running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API: http://localhost:${PORT}/api/orders`);
});
