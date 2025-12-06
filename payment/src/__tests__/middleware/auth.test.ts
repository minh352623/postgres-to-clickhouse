import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, generateToken, JWTPayload, AuthRequest } from '../../middleware/auth';

const JWT_SECRET = 'test-secret-key';
process.env.JWT_SECRET = JWT_SECRET;

describe('Payment Service - Auth Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('authMiddleware', () => {
    it('should reject requests without authorization header', () => {
      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing or invalid authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid authorization format', () => {
      mockRequest.headers = { authorization: 'Basic token123' };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept valid Bearer token', () => {
      const payload: JWTPayload = { user_id: 789, email: 'payment@test.com' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      mockRequest.headers = { authorization: `Bearer ${token}` };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.user_id).toBe(789);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject expired tokens', (done) => {
      const token = jwt.sign(
        { user_id: 123, email: 'test@test.com' },
        JWT_SECRET,
        { expiresIn: '1ms' }
      );

      setTimeout(() => {
        mockRequest.headers = { authorization: `Bearer ${token}` };
        authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should reject malformed tokens', () => {
      mockRequest.headers = { authorization: 'Bearer malformed.token' };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
    });

    it('should handle missing Bearer prefix', () => {
      const token = jwt.sign({ user_id: 1, email: 'test@test.com' }, JWT_SECRET);
      mockRequest.headers = { authorization: token };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should extract correct user data from token', () => {
      const payload: JWTPayload = { 
        user_id: 999, 
        email: 'specific@payment.com' 
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      mockRequest.headers = { authorization: `Bearer ${token}` };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user?.user_id).toBe(999);
      expect(mockRequest.user?.email).toBe('specific@payment.com');
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const token = generateToken(456, 'payment@example.com');

      expect(token).toBeTruthy();
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      expect(decoded.user_id).toBe(456);
      expect(decoded.email).toBe('payment@example.com');
    });

    it('should set 24 hour expiration', () => {
      const token = generateToken(100, 'test@test.com');
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      const expiresIn = decoded.exp! - decoded.iat!;
      expect(expiresIn).toBe(86400); // 24 hours in seconds
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken(1, 'user1@test.com');
      const token2 = generateToken(1, 'user1@test.com');

      expect(token1).not.toBe(token2);
    });

    it('should handle numeric user IDs', () => {
      const token = generateToken(0, 'zero@test.com');
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      expect(decoded.user_id).toBe(0);
    });

    it('should handle large user IDs', () => {
      const largeId = 999999999;
      const token = generateToken(largeId, 'large@test.com');
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      expect(decoded.user_id).toBe(largeId);
    });
  });
});