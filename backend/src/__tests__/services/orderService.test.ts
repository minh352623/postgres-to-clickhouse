import { createOrder, getOrder, getOrders, CreateOrderInput } from '../../services/orderService';
import pool from '../../db/connection';

// Mock the database pool
jest.mock('../../db/connection', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    query: jest.fn(),
  },
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('OrderService', () => {
  let mockClient: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  describe('createOrder', () => {
    const validInput: CreateOrderInput = {
      user_id: 'user-123',
      amount: 99.99,
      status: 'pending',
      email: 'test@example.com',
      name: 'Test User',
    };

    it('should create order successfully with email and name', async () => {
      const mockOrderResult = {
        rows: [{
          order_id: 'mock-uuid-1234',
          user_id: 'user-123',
          amount: 99.99,
          status: 'pending',
          created_at: new Date('2024-01-01T00:00:00Z'),
        }],
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // Upsert user
        .mockResolvedValueOnce(mockOrderResult) // Insert order
        .mockResolvedValueOnce({}); // COMMIT

      const result = await createOrder(validInput);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['user-123', 'test@example.com', 'Test User']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO orders'),
        ['mock-uuid-1234', 'user-123', 99.99, 'pending']
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();

      expect(result.order_id).toBe('mock-uuid-1234');
      expect(result.user_id).toBe('user-123');
      expect(result.amount).toBe(99.99);
    });

    it('should create order without email and name', async () => {
      const inputWithoutEmail: CreateOrderInput = {
        user_id: 'user-456',
        amount: 50.00,
        status: 'completed',
      };

      const mockOrderResult = {
        rows: [{
          order_id: 'mock-uuid-1234',
          user_id: 'user-456',
          amount: 50.00,
          status: 'completed',
          created_at: new Date(),
        }],
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // Insert user with defaults
        .mockResolvedValueOnce(mockOrderResult) // Insert order
        .mockResolvedValueOnce({}); // COMMIT

      const result = await createOrder(inputWithoutEmail);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['user-456', 'user_user-456@demo.com', 'User user-456']
      );
      expect(result.status).toBe('completed');
    });

    it('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // Error on user insert

      await expect(createOrder(validInput)).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle large amounts', async () => {
      const largeAmountInput: CreateOrderInput = {
        user_id: 'user-999',
        amount: 9999999.99,
        status: 'pending',
      };

      const mockOrderResult = {
        rows: [{
          order_id: 'mock-uuid-1234',
          user_id: 'user-999',
          amount: 9999999.99,
          status: 'pending',
          created_at: new Date(),
        }],
      };

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(mockOrderResult)
        .mockResolvedValueOnce({});

      const result = await createOrder(largeAmountInput);

      expect(result.amount).toBe(9999999.99);
    });

    it('should handle zero amount', async () => {
      const zeroAmountInput: CreateOrderInput = {
        user_id: 'user-000',
        amount: 0,
        status: 'cancelled',
      };

      const mockOrderResult = {
        rows: [{
          order_id: 'mock-uuid-1234',
          user_id: 'user-000',
          amount: 0,
          status: 'cancelled',
          created_at: new Date(),
        }],
      };

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(mockOrderResult)
        .mockResolvedValueOnce({});

      const result = await createOrder(zeroAmountInput);

      expect(result.amount).toBe(0);
    });

    it('should handle special characters in email and name', async () => {
      const specialCharsInput: CreateOrderInput = {
        user_id: 'user-special',
        amount: 100,
        status: 'pending',
        email: "test+special@example.com",
        name: "O'Brien",
      };

      const mockOrderResult = {
        rows: [{
          order_id: 'mock-uuid-1234',
          user_id: 'user-special',
          amount: 100,
          status: 'pending',
          created_at: new Date(),
        }],
      };

      mockClient.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(mockOrderResult)
        .mockResolvedValueOnce({});

      const result = await createOrder(specialCharsInput);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['user-special', 'test+special@example.com', "O'Brien"]
      );
      expect(result.order_id).toBeTruthy();
    });

    it('should release client even on commit failure', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // User insert
        .mockResolvedValueOnce({ rows: [{ order_id: 'test', user_id: 'test', amount: 100, status: 'pending', created_at: new Date() }] }) // Order insert
        .mockRejectedValueOnce(new Error('Commit failed')); // COMMIT fails

      await expect(createOrder(validInput)).rejects.toThrow('Commit failed');

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getOrder', () => {
    it('should return order when found', async () => {
      const mockOrder = {
        order_id: 'order-123',
        user_id: 'user-456',
        amount: 150.00,
        status: 'completed',
        created_at: new Date('2024-01-01T00:00:00Z'),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockOrder] });

      const result = await getOrder('order-123');

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM orders WHERE order_id = $1',
        ['order-123']
      );
      expect(result).toEqual(mockOrder);
    });

    it('should return null when order not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getOrder('non-existent-order');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      await expect(getOrder('order-123')).rejects.toThrow('Connection failed');
    });

    it('should handle special characters in order_id', async () => {
      const orderId = "order-with-'quotes";
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await getOrder(orderId);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM orders WHERE order_id = $1',
        [orderId]
      );
    });
  });

  describe('getOrders', () => {
    it('should return list of orders with default limit', async () => {
      const mockOrders = [
        { order_id: '1', user_id: 'user-1', amount: 100, status: 'completed', created_at: new Date() },
        { order_id: '2', user_id: 'user-2', amount: 200, status: 'pending', created_at: new Date() },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: mockOrders });

      const result = await getOrders();

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1',
        [100]
      );
      expect(result).toEqual(mockOrders);
      expect(result).toHaveLength(2);
    });

    it('should return list of orders with custom limit', async () => {
      const mockOrders = Array(50).fill(null).map((_, i) => ({
        order_id: `order-${i}`,
        user_id: `user-${i}`,
        amount: 100 + i,
        status: 'completed',
        created_at: new Date(),
      }));

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: mockOrders });

      const result = await getOrders(50);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1',
        [50]
      );
      expect(result).toHaveLength(50);
    });

    it('should return empty array when no orders exist', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getOrders();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle limit of 1', async () => {
      const mockOrder = {
        order_id: 'order-1',
        user_id: 'user-1',
        amount: 100,
        status: 'completed',
        created_at: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockOrder] });

      const result = await getOrders(1);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1',
        [1]
      );
      expect(result).toHaveLength(1);
    });

    it('should handle very large limit', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await getOrders(10000);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1',
        [10000]
      );
    });

    it('should handle database errors', async () => {
      (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Query timeout'));

      await expect(getOrders()).rejects.toThrow('Query timeout');
    });
  });
});