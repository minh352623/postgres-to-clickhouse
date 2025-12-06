import { TraceGenerator } from '../../lib/tracing';

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn();
global.crypto = {
  randomUUID: mockRandomUUID,
} as any;

describe('Frontend TraceGenerator', () => {
  let tracer: TraceGenerator;

  beforeEach(() => {
    tracer = new TraceGenerator(1);
    mockRandomUUID.mockReset();
  });

  describe('constructor', () => {
    it('should initialize with service ID', () => {
      const customTracer = new TraceGenerator(99);
      expect(customTracer).toBeDefined();
    });
  });

  describe('generateId', () => {
    it('should use crypto.randomUUID when available', () => {
      mockRandomUUID.mockReturnValue('crypto-generated-uuid');

      const id = tracer.generateId();

      expect(mockRandomUUID).toHaveBeenCalled();
      expect(id).toBe('crypto-generated-uuid');
    });

    it('should fallback to custom UUID generation when crypto unavailable', () => {
      // Temporarily remove crypto
      const originalCrypto = global.crypto;
      (global as any).crypto = undefined;

      const id = tracer.generateId();

      expect(id).toBeTruthy();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i);

      // Restore crypto
      global.crypto = originalCrypto;
    });

    it('should generate UUID v4 format in fallback', () => {
      (global as any).crypto = undefined;

      const id = tracer.generateId();
      const parts = id.split('-');

      expect(parts).toHaveLength(5);
      expect(parts[2][0]).toBe('4'); // Version 4
      expect(['8', '9', 'a', 'b']).toContain(parts[3][0]); // Variant bits

      global.crypto = { randomUUID: mockRandomUUID } as any;
    });

    it('should generate unique IDs in fallback mode', () => {
      (global as any).crypto = undefined;

      const ids = Array.from({ length: 100 }, () => tracer.generateId());
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBeGreaterThan(95); // Allow for slight collision chance

      global.crypto = { randomUUID: mockRandomUUID } as any;
    });

    it('should accept userId parameter', () => {
      mockRandomUUID.mockReturnValue('test-uuid');

      const id1 = tracer.generateId(0);
      const id2 = tracer.generateId(12345);

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
    });
  });

  describe('parseTraceHeader', () => {
    beforeEach(() => {
      mockRandomUUID.mockReturnValue('generated-trace-id');
    });

    it('should generate new trace for null header', () => {
      const result = tracer.parseTraceHeader(null);

      expect(result.traceId).toBe('generated-trace-id');
      expect(result.parentSpanId).toBeUndefined();
    });

    it('should generate new trace for undefined header', () => {
      const result = tracer.parseTraceHeader(undefined);

      expect(result.traceId).toBe('generated-trace-id');
      expect(result.parentSpanId).toBeUndefined();
    });

    it('should parse trace header with only traceId', () => {
      const result = tracer.parseTraceHeader('frontend-trace-123');

      expect(result.traceId).toBe('frontend-trace-123');
      expect(result.parentSpanId).toBeUndefined();
    });

    it('should parse trace header with traceId and parentSpanId', () => {
      const result = tracer.parseTraceHeader('trace-abc,span-def');

      expect(result.traceId).toBe('trace-abc');
      expect(result.parentSpanId).toBe('span-def');
    });

    it('should handle empty string', () => {
      const result = tracer.parseTraceHeader('');

      expect(result.traceId).toBe('');
      expect(result.parentSpanId).toBeUndefined();
    });

    it('should parse header with multiple commas correctly', () => {
      const result = tracer.parseTraceHeader('trace,span,extra');

      expect(result.traceId).toBe('trace');
      expect(result.parentSpanId).toBe('span');
    });

    it('should handle header with trailing comma', () => {
      const result = tracer.parseTraceHeader('trace-123,');

      expect(result.traceId).toBe('trace-123');
      expect(result.parentSpanId).toBe('');
    });

    it('should handle header with only comma', () => {
      const result = tracer.parseTraceHeader(',');

      expect(result.traceId).toBe('');
      expect(result.parentSpanId).toBe('');
    });

    it('should preserve special characters in IDs', () => {
      const result = tracer.parseTraceHeader('trace-with_special.chars,span-with_special.chars');

      expect(result.traceId).toBe('trace-with_special.chars');
      expect(result.parentSpanId).toBe('span-with_special.chars');
    });
  });

  describe('browser environment compatibility', () => {
    it('should work in environments without crypto', () => {
      const originalCrypto = global.crypto;
      (global as any).crypto = undefined;

      const tracer = new TraceGenerator(1);
      const id = tracer.generateId();
      const parsed = tracer.parseTraceHeader(null);

      expect(id).toBeTruthy();
      expect(parsed.traceId).toBeTruthy();

      global.crypto = originalCrypto;
    });

    it('should handle crypto with missing randomUUID method', () => {
      const originalCrypto = global.crypto;
      global.crypto = {} as any;

      const tracer = new TraceGenerator(1);
      const id = tracer.generateId();

      expect(id).toBeTruthy();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i);

      global.crypto = originalCrypto;
    });
  });

  describe('tracer export', () => {
    it('should export a default tracer instance', () => {
      // Import the tracer export
      const { tracer: exportedTracer } = require('../../lib/tracing');

      expect(exportedTracer).toBeDefined();
      expect(exportedTracer.generateId).toBeInstanceOf(Function);
      expect(exportedTracer.parseTraceHeader).toBeInstanceOf(Function);
    });
  });
});