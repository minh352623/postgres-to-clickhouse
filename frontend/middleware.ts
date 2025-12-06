import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { tracer } from './lib/tracing';

export function middleware(request: NextRequest) {
  // Parse existing trace or generate new one
  const traceHeader = request.headers.get('x-trace-id');
  const { traceId, parentSpanId } = tracer.parseTraceHeader(traceHeader);
  const spanId = tracer.generateId();

  // Clone request headers and add trace ID
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-trace-id', `${traceId},${spanId}`);

  // Forward to backend with trace context
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set trace header in response for client
  response.headers.set('x-trace-id', `${traceId},${spanId}`);

  return response;
}

// Apply middleware to API routes
export const config = {
  matcher: '/api/:path*',
};
