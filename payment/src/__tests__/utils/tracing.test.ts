import { TraceGenerator } from '../../utils/tracing';

describe('Payment Service - TraceGenerator', () => {
  let tracer: TraceGenerator;

  beforeEach(() => {
    tracer = new TraceGenerator(3, 'payment-service');
  });

  describe('constructor', () => {
    it('should initialize with service ID and name', () => {
      const span = tracer.createOtelSpan(
        'trace', 'span', undefined, 'user', 'op', 200, 0, 100
      );

      expect(span.ServiceName).toBe('payment-service');
    });

    it('should use default service name if not provided', () => {
      const defaultTracer = new TraceGenerator(3);
      const span = defaultTracer.createOtelSpan(
        'trace', 'span', undefined, 'user', 'op', 200, 0, 100
      );

      expect(span.ServiceName).toBe('payment');
    });
  });

  describe('generateId', () => {
    it('should generate valid UUID v4', () => {
      const id = tracer.generateId();

      expect(id).toBeTruthy();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const ids = Array.from({ length: 100 }, () => tracer.generateId());
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100);
    });

    it('should work with userId parameter', () => {
      const id1 = tracer.generateId(0);
      const id2 = tracer.generateId(999);

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
  });

  describe('parseTraceHeader', () => {
    it('should generate new trace for undefined header', () => {
      const result = tracer.parseTraceHeader(undefined);

      expect(result.traceId).toBeTruthy();
      expect(result.parentSpanId).toBeUndefined();
    });

    it('should parse trace header with traceId only', () => {
      const result = tracer.parseTraceHeader('payment-trace-123');

      expect(result.traceId).toBe('payment-trace-123');
      expect(result.parentSpanId).toBeUndefined();
    });

    it('should parse trace header with traceId and parentSpanId', () => {
      const result = tracer.parseTraceHeader('trace-456,span-789');

      expect(result.traceId).toBe('trace-456');
      expect(result.parentSpanId).toBe('span-789');
    });

    it('should handle empty string', () => {
      const result = tracer.parseTraceHeader('');

      expect(result.traceId).toBe('');
      expect(result.parentSpanId).toBeUndefined();
    });

    it('should ignore extra comma-separated values', () => {
      const result = tracer.parseTraceHeader('trace,span,extra,values');

      expect(result.traceId).toBe('trace');
      expect(result.parentSpanId).toBe('span');
    });
  });

  describe('createOtelSpan', () => {
    const baseParams = {
      traceId: 'payment-trace',
      spanId: 'payment-span',
      parentSpanId: 'parent-span',
      userId: '12345',
      operation: 'POST /api/payments/process',
      statusCode: 200,
      startTime: 1700000000000,
      endTime: 1700000000250, // 250ms
    };

    it('should create valid OpenTelemetry span', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId,
        baseParams.spanId,
        baseParams.parentSpanId,
        baseParams.userId,
        baseParams.operation,
        baseParams.statusCode,
        baseParams.startTime,
        baseParams.endTime
      );

      expect(span.TraceId).toBe('payment-trace');
      expect(span.SpanId).toBe('payment-span');
      expect(span.ParentSpanId).toBe('parent-span');
      expect(span.SpanName).toBe('POST /api/payments/process');
      expect(span.ServiceName).toBe('payment-service');
      expect(span.SpanKind).toBe('SERVER');
    });

    it('should calculate duration correctly in nanoseconds', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.endTime
      );

      expect(span.Duration).toBe(250 * 1000000); // 250ms in nanoseconds
    });

    it('should format timestamp as ISO string', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.endTime
      );

      expect(span.Timestamp).toBe(new Date(baseParams.startTime).toISOString());
    });

    it('should set OK status for successful payments (2xx)', () => {
      const span200 = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, 200,
        baseParams.startTime, baseParams.endTime
      );
      const span201 = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, 201,
        baseParams.startTime, baseParams.endTime
      );

      expect(span200.StatusCode).toBe('OK');
      expect(span201.StatusCode).toBe('OK');
    });

    it('should set ERROR status for failed payments (4xx)', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, 400,
        baseParams.startTime, baseParams.endTime
      );

      expect(span.StatusCode).toBe('ERROR');
      expect(span.StatusMessage).toBe('HTTP 400');
    });

    it('should set ERROR status for server errors (5xx)', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, 500,
        baseParams.startTime, baseParams.endTime
      );

      expect(span.StatusCode).toBe('ERROR');
      expect(span.StatusMessage).toBe('HTTP 500');
    });

    it('should include request payload in attributes', () => {
      const reqPayload = { method: 'POST', path: '/api/payments/process' };
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.endTime, reqPayload
      );

      expect(span.SpanAttributes['http.method']).toBe('POST');
      expect(span.SpanAttributes['http.url']).toBe('/api/payments/process');
    });

    it('should include response payload message', () => {
      const resPayload = { message: 'Payment processed successfully' };
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.endTime, {}, resPayload
      );

      expect(span.SpanAttributes['http.message']).toBe('Payment processed successfully');
      expect(span.StatusMessage).toBe('Payment processed successfully');
    });

    it('should include meta tags in attributes', () => {
      const metaTags = { 
        pod_id: 'payment-pod-123', 
        version: 'v2.5.0',
        region: 'us-west-2' 
      };
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.endTime, {}, {}, metaTags
      );

      expect(span.ResourceAttributes['host.name']).toBe('payment-pod-123');
      expect(span.ResourceAttributes['service.version']).toBe('v2.5.0');
      expect(span.SpanAttributes.region).toBe('us-west-2');
    });

    it('should use defaults when meta tags are missing', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.endTime
      );

      expect(span.ResourceAttributes['host.name']).toBe('localhost');
      expect(span.ResourceAttributes['service.version']).toBe('v1.0.0');
    });

    it('should handle undefined parentSpanId', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, undefined,
        baseParams.userId, baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.endTime
      );

      expect(span.ParentSpanId).toBe('');
    });

    it('should include user ID in span attributes', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        '98765', baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.endTime
      );

      expect(span.SpanAttributes['user.id']).toBe('98765');
    });

    it('should initialize empty event and link arrays', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.endTime
      );

      expect(span['Events.Timestamp']).toEqual([]);
      expect(span['Events.Name']).toEqual([]);
      expect(span['Events.Attributes']).toEqual([]);
      expect(span['Links.TraceId']).toEqual([]);
      expect(span['Links.SpanId']).toEqual([]);
      expect(span['Links.TraceState']).toEqual([]);
      expect(span['Links.Attributes']).toEqual([]);
    });

    it('should set correct ScopeName and ScopeVersion', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.endTime
      );

      expect(span.ScopeName).toBe('@opentelemetry/instrumentation-http');
      expect(span.ScopeVersion).toBe('1.0.0');
    });

    it('should handle zero duration', () => {
      const span = tracer.createOtelSpan(
        baseParams.traceId, baseParams.spanId, baseParams.parentSpanId,
        baseParams.userId, baseParams.operation, baseParams.statusCode,
        baseParams.startTime, baseParams.startTime // Same start and end
      );

      expect(span.Duration).toBe(0);
    });
  });
});