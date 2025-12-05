import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection';

export interface CreateOrderInput {
  user_id: string;
  amount: number;
  status: string;
  email?: string;
  name?: string;
}

export interface Order {
  order_id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: Date;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Upsert user if email/name provided
    if (input.email || input.name) {
      await client.query(
        `INSERT INTO users (user_id, email, name) 
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE 
         SET email = COALESCE($2, users.email),
             name = COALESCE($3, users.name),
             updated_at = CURRENT_TIMESTAMP`,
        [input.user_id, input.email, input.name]
      );
    } else {
      // Ensure user exists
      await client.query(
        `INSERT INTO users (user_id, email, name) 
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO NOTHING`,
        [input.user_id, `user_${input.user_id}@demo.com`, `User ${input.user_id.slice(0, 8)}`]
      );
    }

    // Insert order
    const order_id = uuidv4();
    const result = await client.query(
      `INSERT INTO orders (order_id, user_id, amount, status)
       VALUES ($1, $2, $3, $4)
       RETURNING order_id, user_id, amount, status, created_at`,
      [order_id, input.user_id, input.amount, input.status]
    );

    await client.query('COMMIT');

    const order = result.rows[0];

    return order;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrder(order_id: string): Promise<Order | null> {
  const result = await pool.query(
    'SELECT * FROM orders WHERE order_id = $1',
    [order_id]
  );
  return result.rows[0] || null;
}

export async function getOrders(limit: number = 100): Promise<Order[]> {
  const result = await pool.query(
    'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return result.rows;
}
