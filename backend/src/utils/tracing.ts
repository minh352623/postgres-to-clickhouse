import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class TraceGenerator {
  private serviceId: number;
  private serviceName: string;

  constructor(serviceId: number, serviceName: string = 'backend') {
    this.serviceId = serviceId;
    this.serviceName = serviceName;
  }

  // Generate UUID for trace/span IDs
  generateId(userId: number = 0): string {
    return uuidv4();
  }

  parseTraceHeader(header?: string): { traceId: string; parentSpanId?: string } {
    if (!header) {
      return { traceId: this.generateId() };
    }
    const parts = header.split(',');
    return {
      traceId: parts[0],
      parentSpanId: parts[1] || undefined,
    };
  }

  createOtelSpan(
    traceId: string,
    spanId: string,
    parentSpanId: string | undefined,
    userId: string,
    operation: string,
    statusCode: number,
    startTime: number,
    endTime: number,
    reqPayload: any = {},
    resPayload: any = {},
    metaTags: Record<string, string> = {}
  ) {
    const timestamp = new Date(startTime);
    const durationNs = (endTime - startTime) * 1000000; // Convert ms to nanoseconds
    
    return {
      Timestamp: timestamp.toISOString(),
      TraceId: traceId,
      SpanId: spanId,
      ParentSpanId: parentSpanId || '',
      TraceState: '',
      SpanName: operation,
      SpanKind: 'SERVER',
      ServiceName: this.serviceName,
      ResourceAttributes: {
        'service.name': this.serviceName,
        'service.version': metaTags.version || 'v1.0.0',
        'host.name': metaTags.pod_id || 'localhost',
      },
      ScopeName: '@opentelemetry/instrumentation-http',
      ScopeVersion: '1.0.0',
      SpanAttributes: {
        'http.method': reqPayload.method || '',
        'http.url': reqPayload.path || '',
        'http.status_code': statusCode.toString(),
        'user.id': userId,
        "http.message": resPayload.message || '',
        ...metaTags,
      },
      Duration: durationNs,
      StatusCode: statusCode >= 200 && statusCode < 400 ? 'OK' : 'ERROR',
      StatusMessage: resPayload.message || (statusCode >= 400 ? `HTTP ${statusCode}` : ''),
      'Events.Timestamp': [],
      'Events.Name': [],
      'Events.Attributes': [],
      'Links.TraceId': [],
      'Links.SpanId': [],
      'Links.TraceState': [],
      'Links.Attributes': [],
    };
  }
}

export const tracer = new TraceGenerator(2, 'order-service'); // Backend Service
