import { NextResponse } from 'next/server';
import clickhouse from '@/lib/clickhouse';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Default to last 10 min if no date provided
  const whereClause = startDate && endDate
    ? `WHERE created_at >= parseDateTimeBestEffort('${startDate}') AND created_at <= parseDateTimeBestEffort('${endDate}')`
    : 'WHERE created_at >= now() - INTERVAL 10 MINUTE';

  try {
    const result = await clickhouse.query({
      query: `
        SELECT 
          toStartOfMinute(created_at) as minute,
          count() as count
        FROM orders
        ${whereClause}
        GROUP BY minute
        ORDER BY minute ASC
      `,
      format: 'JSONEachRow',
    });

    const data = await result.json() as any[];

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching realtime data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch realtime data' },
      { status: 500 }
    );
  }
}
