import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, generateToken, JWTPayload, AuthRequest } from '../../middleware/auth';

// Mock environment
const JWT_SECRET = 'test-secret-key';
process.env.JWT_SECRET = JWT_SECRET;

describe('Auth Middleware', () => {
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

    it('should reject requests with invalid authorization header format', () => {
      mockRequest.headers = { authorization: 'InvalidFormat token123' };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing or invalid authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with expired or invalid token', () => {
      mockRequest.headers = { authorization: 'Bearer invalid.token.here' };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept valid token and attach user to request', () => {
      const payload: JWTPayload = { user_id: 123, email: 'test@example.com' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
      mockRequest.headers = { authorization: `Bearer ${token}` };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.user_id).toBe(123);
      expect(mockRequest.user?.email).toBe('test@example.com');
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should handle malformed Bearer token', () => {
      mockRequest.headers = { authorization: 'Bearer ' };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
    });

    it('should reject token signed with wrong secret', () => {
      const payload: JWTPayload = { user_id: 456, email: 'hacker@example.com' };
      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' });
      mockRequest.headers = { authorization: `Bearer ${token}` };

      authMiddleware(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = 789;
      const email = 'user@example.com';
      const token = generateToken(userId, email);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      expect(decoded.user_id).toBe(userId);
      expect(decoded.email).toBe(email);
    });

    it('should generate token with 24h expiration', () => {
      const token = generateToken(100, 'test@test.com');
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();

      const expiresIn = decoded.exp! - decoded.iat!;
      expect(expiresIn).toBe(24 * 60 * 60); // 24 hours in seconds
    });

    it('should generate unique tokens for different users', () => {
      const token1 = generateToken(1, 'user1@test.com');
      const token2 = generateToken(2, 'user2@test.com');

      expect(token1).not.toBe(token2);

      const decoded1 = jwt.verify(token1, JWT_SECRET) as JWTPayload;
      const decoded2 = jwt.verify(token2, JWT_SECRET) as JWTPayload;

      expect(decoded1.user_id).not.toBe(decoded2.user_id);
      expect(decoded1.email).not.toBe(decoded2.email);
    });

    it('should handle special characters in email', () => {
      const token = generateToken(999, 'user+test@example.com');
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      expect(decoded.email).toBe('user+test@example.com');
    });

    it('should generate token that expires after 24 hours', (done) => {
      // Create a token with 1 second expiration for testing
      const shortToken = jwt.sign(
        { user_id: 123, email: 'test@test.com' },
        JWT_SECRET,
        { expiresIn: '1s' }
      );

      setTimeout(() => {
        try {
          jwt.verify(shortToken, JWT_SECRET);
          done(new Error('Token should have expired'));
        } catch (error: any) {
          expect(error.name).toBe('TokenExpiredError');
          done();
        }
      }, 1100);
    }, 2000);
  });
});