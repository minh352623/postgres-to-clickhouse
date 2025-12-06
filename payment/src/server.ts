import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authMiddleware, AuthRequest } from './middleware/auth';
import { tracer } from './utils/tracing';
import { createClient } from '@clickhouse/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

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
      { method: req.method, path: req.path },
      { status: res.statusCode, message: res.statusMessage },
      { pod_id: process.env.HOSTNAME || 'payment-local' }
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
  res.json({ status: 'healthy', service: 'payment', timestamp: new Date().toISOString() });
});

// Process payment (protected with JWT)
app.post('/api/payments/process', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { order_id, amount } = req.body;
    if (amount > 1000) {
      return res.status(400).json({ error: 'amount is too large' });
    }
    const userId = req.user!.user_id;

    if (!order_id || !amount) {
      return res.status(400).json({ error: 'order_id and amount are required' });
    }

    // Simulate payment processing
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Processing payment for user ${userId}, order ${order_id}, amount $${amount}`);
    
    // Simulate async payment processing (100-300ms)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

    const payment = {
      payment_id: paymentId,
      order_id,
      user_id: userId,
      amount,
      status: 'completed',
      processed_at: new Date().toISOString(),
    };

    res.status(200).json(payment);
  } catch (error:any) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: error?.message || 'Failed to process payment' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`💳 Payment service running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API: http://localhost:${PORT}/api/payments/process`);
});
