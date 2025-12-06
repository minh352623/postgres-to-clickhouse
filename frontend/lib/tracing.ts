// Simple UUID generation for browser environment
export class TraceGenerator {
  private serviceId: number;

  constructor(serviceId: number) {
    this.serviceId = serviceId;
  }

  // Generate UUID for trace/span IDs
  generateId(userId: number = 0): string {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback to simple UUID v4 generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  parseTraceHeader(header?: string | null): { traceId: string; parentSpanId?: string } {
    if (!header) {
      return { traceId: this.generateId() };
    }
    const parts = header.split(',');
    return {
      traceId: parts[0],
      parentSpanId: parts[1] || undefined,
    };
  }
}

export const tracer = new TraceGenerator(1); // Frontend Service ID = 1
