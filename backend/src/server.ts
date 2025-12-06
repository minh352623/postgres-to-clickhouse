import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { createOrder, getOrder, getOrders } from './services/orderService';
import { tracer } from './utils/tracing';
import { createClient } from '@clickhouse/client';
import { authMiddleware, AuthRequest, generateToken } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ClickHouse client for logging spans
const clickhouse = createClient({
  host: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
});

// Middleware
app.use(cors());
app.use(express.json());

// Distributed Tracing Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Parse trace header or generate new trace
  const traceHeader = req.headers['x-trace-id'] as string | undefined;
  const { traceId, parentSpanId } = tracer.parseTraceHeader(traceHeader);
  const spanId = tracer.generateId();
  
  // Attach to request for downstream use
  (req as any).tracing = { traceId, spanId, parentSpanId };
  
  // Set response header
  res.setHeader('X-Trace-ID', `${traceId},${spanId}`);
  
  // Log span on response finish
  res.on('finish', async () => {
    const endTime = Date.now();
    const userId = (req as AuthRequest).user?.user_id || 0;
    
    const spanLog = tracer.createOtelSpan(
      traceId,
      spanId,
      parentSpanId,
      userId.toString(),
      `${req.method} ${req.path}`,
      res.statusCode,
      startTime,
      endTime,
      { method: req.method, path: req.path, query: req.query },
      { status: res.statusCode, message: res.statusMessage },
      { pod_id: process.env.HOSTNAME || 'backend-local' }
    );
    
    // Log to console
    console.log('[TRACE]', JSON.stringify(spanLog));
    
    // Insert to ClickHouse asynchronously
    try {
      await clickhouse.insert({
        table: 'otel_traces',
        values: [spanLog],
        format: 'JSONEachRow',
      });
    } catch (error) {
      console.error('[TRACE] Failed to insert span:', error);
    }
  });
  
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'order', timestamp: new Date().toISOString() });
});

// Generate demo JWT token
app.post('/api/auth/token', (req: Request, res: Response) => {
  const { user_id, email } = req.body;
  
  if (!user_id || !email) {
    return res.status(400).json({ error: 'user_id and email are required' });
  }
  
  const token = generateToken(user_id, email);
  res.json({ token, user_id, email });
});

// Create single order (protected with JWT)
app.post('/api/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, status } = req.body;
    if (amount > 10000) {
      throw new Error('Amount too high');
    }
    const userId = req.user!.user_id;
    const userEmail = req.user!.email;

    if (!amount || !status) {
      return res.status(400).json({ error: 'amount and status are required' });
    }

    // Create order
    const order = await createOrder({
      user_id: userId.toString(),
      amount: parseFloat(amount),
      status,
      email: userEmail,
      name: `User ${userId}`,
    });

    // Call payment service
    try {
      const tracing = (req as any).tracing;
      const paymentUrl = process.env.PAYMENT_SERVICE_URL || 'http://payment:3002';
      
      const paymentResponse = await axios.post(
        `${paymentUrl}/api/payments/process`,
        {
          order_id: order.order_id,
          amount: order.amount,
        },
        {
          headers: {
            'Authorization': req.headers.authorization,
            'X-Trace-ID': `${tracing.traceId},${tracing.spanId}`,
          },
        }
      );
      
      (order as any).payment_info = paymentResponse.data;
    } catch (paymentError) {
      console.error('Payment service error:', paymentError);
      // Continue even if payment fails
      (order as any).payment_info = { error: 'Payment service unavailable' };
    }

    res.status(201).json(order);
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error?.message });
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
