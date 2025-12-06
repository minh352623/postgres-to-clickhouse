import { NextResponse } from 'next/server';
import clickhouse from '@/lib/clickhouse';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const traceId = searchParams.get('traceId');
  const userId = searchParams.get('userId');
  const serviceName = searchParams.get('serviceName');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');

  try {
    // If traceId is provided, return all spans for that specific trace
    if (traceId) {
      const result = await clickhouse.query({
        query: `
          SELECT 
            Timestamp,
            TraceId,
            SpanId,
            ParentSpanId,
            SpanName,
            SpanKind,
            ServiceName,
            ResourceAttributes,
            SpanAttributes,
            Duration,
            StatusCode,
            StatusMessage
          FROM otel_traces
          WHERE TraceId = '${traceId}'
          ORDER BY Timestamp ASC
        `,
        format: 'JSONEachRow',
      });

      const spans = await result.json() as any[];
      return NextResponse.json(spans);
    }

    // Build HAVING clause for filtering (after GROUP BY)
    const havingConditions: string[] = [];
    if (userId) {
      havingConditions.push(`groupArray(SpanAttributes['user.id'])[1] = '${userId}'`);
    }
    if (serviceName) {
      havingConditions.push(`has(groupArray(DISTINCT ServiceName), '${serviceName}')`);
    }

    const havingClause = havingConditions.length > 0 
      ? `HAVING ${havingConditions.join(' AND ')}` 
      : '';

    // Get total count for pagination
    const countResult = await clickhouse.query({
      query: `
        SELECT count() as total
        FROM (
          SELECT TraceId
          FROM otel_traces
          GROUP BY TraceId
          ${havingClause}
        )
      `,
      format: 'JSONEachRow',
    });
    const countData = await countResult.json() as any[];
    const total = countData[0]?.total || 0;

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Get trace summaries with filtering
    const result = await clickhouse.query({
      query: `
        SELECT 
          TraceId,
          min(Timestamp) as Start,
          max(Timestamp) as End,
          multiply(toUnixTimestamp64Nano(max(Timestamp)) - toUnixTimestamp64Nano(min(Timestamp)), 0.000001) as total_duration_ms,
          count() as span_count,
          countIf(StatusCode = 'ERROR') as error_count,
          groupArray(DISTINCT ServiceName) as services,
          groupArray(SpanAttributes['user.id'])[1] as user_id
        FROM otel_traces
        GROUP BY TraceId
        ${havingClause}
        ORDER BY min(Timestamp) DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `,
      format: 'JSONEachRow',
    });

    const traces = await result.json() as any[];

    // Transform has_errors (countIf returns count, we need boolean)
    const transformedTraces = traces.map(trace => ({
      ...trace,
      has_errors: trace.error_count > 0 ? 0 : 1, // 0 means has errors (to match old logic)
    }));

    return NextResponse.json({
      traces: transformedTraces,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching traces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch traces', details: String(error) },
      { status: 500 }
    );
  }
}
