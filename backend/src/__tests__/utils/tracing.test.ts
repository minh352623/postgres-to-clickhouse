import { TraceGenerator } from '../../utils/tracing';

describe('TraceGenerator', () => {
  let tracer: TraceGenerator;

  beforeEach(() => {
    tracer = new TraceGenerator(1, 'test-service');
  });

  describe('generateId', () => {
    it('should generate a valid UUID v4', () => {
      const id = tracer.generateId();

      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = tracer.generateId();
      const id2 = tracer.generateId();
      const id3 = tracer.generateId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should accept userId parameter', () => {
      const id = tracer.generateId(12345);
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('should generate different IDs for same userId', () => {
      const id1 = tracer.generateId(100);
      const id2 = tracer.generateId(100);
      expect(id1).not.toBe(id2);
    });
  });

  describe('parseTraceHeader', () => {
    it('should generate new trace when header is undefined', () => {
      const result = tracer.parseTraceHeader(undefined);

      expect(result.traceId).toBeTruthy();
      expect(result.parentSpanId).toBeUndefined();
      expect(result.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should parse trace header with only traceId', () => {
      const traceId = 'abc-123-def-456';
      const result = tracer.parseTraceHeader(traceId);

      expect(result.traceId).toBe(traceId);
      expect(result.parentSpanId).toBeUndefined();
    });

    it('should parse trace header with traceId and parentSpanId', () => {
      const traceId = 'trace-id-123';
      const parentSpanId = 'parent-span-456';
      const header = `${traceId},${parentSpanId}`;
      const result = tracer.parseTraceHeader(header);

      expect(result.traceId).toBe(traceId);
      expect(result.parentSpanId).toBe(parentSpanId);
    });

    it('should handle header with multiple commas', () => {
      const header = 'trace-123,span-456,extra-data';
      const result = tracer.parseTraceHeader(header);

      expect(result.traceId).toBe('trace-123');
      expect(result.parentSpanId).toBe('span-456');
    });

    it('should handle empty string header', () => {
      const result = tracer.parseTraceHeader('');

      expect(result.traceId).toBe('');
      expect(result.parentSpanId).toBeUndefined();
    });
  });

  describe('createOtelSpan', () => {
    const traceId = 'trace-abc-123';
    const spanId = 'span-def-456';
    const parentSpanId = 'parent-ghi-789';
    const userId = '12345';
    const operation = 'POST /api/orders';
    const statusCode = 200;
    const startTime = 1700000000000;
    const endTime = 1700000000150; // 150ms later

    it('should create valid OTEL span structure', () => {
      const span = tracer.createOtelSpan(
        traceId,
        spanId,
        parentSpanId,
        userId,
        operation,
        statusCode,
        startTime,
        endTime
      );

      expect(span.TraceId).toBe(traceId);
      expect(span.SpanId).toBe(spanId);
      expect(span.ParentSpanId).toBe(parentSpanId);
      expect(span.SpanName).toBe(operation);
      expect(span.ServiceName).toBe('test-service');
      expect(span.SpanKind).toBe('SERVER');
    });

    it('should calculate duration in nanoseconds correctly', () => {
      const span = tracer.createOtelSpan(
        traceId,
        spanId,
        parentSpanId,
        userId,
        operation,
        statusCode,
        startTime,
        endTime
      );

      // 150ms = 150,000,000 nanoseconds
      expect(span.Duration).toBe(150 * 1000000);
    });

    it('should format timestamp as ISO string', () => {
      const span = tracer.createOtelSpan(
        traceId,
        spanId,
        parentSpanId,
        userId,
        operation,
        statusCode,
        startTime,
        endTime
      );

      expect(span.Timestamp).toBe(new Date(startTime).toISOString());
    });

    it('should set StatusCode to OK for 2xx responses', () => {
      const span200 = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, 200, startTime, endTime
      );
      const span201 = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, 201, startTime, endTime
      );

      expect(span200.StatusCode).toBe('OK');
      expect(span201.StatusCode).toBe('OK');
    });

    it('should set StatusCode to OK for 3xx responses', () => {
      const span = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, 302, startTime, endTime
      );

      expect(span.StatusCode).toBe('OK');
    });

    it('should set StatusCode to ERROR for 4xx responses', () => {
      const span400 = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, 400, startTime, endTime
      );
      const span404 = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, 404, startTime, endTime
      );

      expect(span400.StatusCode).toBe('ERROR');
      expect(span404.StatusCode).toBe('ERROR');
    });

    it('should set StatusCode to ERROR for 5xx responses', () => {
      const span = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, 500, startTime, endTime
      );

      expect(span.StatusCode).toBe('ERROR');
    });

    it('should include request payload in SpanAttributes', () => {
      const reqPayload = { method: 'POST', path: '/api/orders' };
      const span = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, statusCode,
        startTime, endTime, reqPayload
      );

      expect(span.SpanAttributes['http.method']).toBe('POST');
      expect(span.SpanAttributes['http.url']).toBe('/api/orders');
    });

    it('should include response payload in SpanAttributes', () => {
      const resPayload = { message: 'Order created successfully' };
      const span = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, statusCode,
        startTime, endTime, {}, resPayload
      );

      expect(span.SpanAttributes['http.message']).toBe('Order created successfully');
    });

    it('should include meta tags in ResourceAttributes and SpanAttributes', () => {
      const metaTags = { pod_id: 'pod-123', version: 'v2.0.0', region: 'us-east-1' };
      const span = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, statusCode,
        startTime, endTime, {}, {}, metaTags
      );

      expect(span.ResourceAttributes['host.name']).toBe('pod-123');
      expect(span.ResourceAttributes['service.version']).toBe('v2.0.0');
      expect(span.SpanAttributes.region).toBe('us-east-1');
    });

    it('should use default values when meta tags are missing', () => {
      const span = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, statusCode,
        startTime, endTime
      );

      expect(span.ResourceAttributes['host.name']).toBe('localhost');
      expect(span.ResourceAttributes['service.version']).toBe('v1.0.0');
    });

    it('should handle undefined parentSpanId', () => {
      const span = tracer.createOtelSpan(
        traceId, spanId, undefined, userId, operation, statusCode,
        startTime, endTime
      );

      expect(span.ParentSpanId).toBe('');
    });

    it('should set user.id in SpanAttributes', () => {
      const span = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, statusCode,
        startTime, endTime
      );

      expect(span.SpanAttributes['user.id']).toBe(userId);
    });

    it('should initialize empty arrays for Events and Links', () => {
      const span = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, statusCode,
        startTime, endTime
      );

      expect(span['Events.Timestamp']).toEqual([]);
      expect(span['Events.Name']).toEqual([]);
      expect(span['Events.Attributes']).toEqual([]);
      expect(span['Links.TraceId']).toEqual([]);
      expect(span['Links.SpanId']).toEqual([]);
      expect(span['Links.TraceState']).toEqual([]);
      expect(span['Links.Attributes']).toEqual([]);
    });

    it('should set StatusMessage for error responses', () => {
      const span = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, 500,
        startTime, endTime
      );

      expect(span.StatusMessage).toBe('HTTP 500');
    });

    it('should use custom StatusMessage from response payload', () => {
      const resPayload = { message: 'Custom error message' };
      const span = tracer.createOtelSpan(
        traceId, spanId, parentSpanId, userId, operation, 400,
        startTime, endTime, {}, resPayload
      );

      expect(span.StatusMessage).toBe('Custom error message');
    });
  });

  describe('TraceGenerator constructor', () => {
    it('should accept serviceId and serviceName', () => {
      const customTracer = new TraceGenerator(99, 'custom-service');
      const span = customTracer.createOtelSpan(
        'trace', 'span', undefined, 'user', 'op', 200, 0, 100
      );

      expect(span.ServiceName).toBe('custom-service');
    });

    it('should use default serviceName if not provided', () => {
      const defaultTracer = new TraceGenerator(5);
      const span = defaultTracer.createOtelSpan(
        'trace', 'span', undefined, 'user', 'op', 200, 0, 100
      );

      expect(span.ServiceName).toBe('backend');
    });
  });
});