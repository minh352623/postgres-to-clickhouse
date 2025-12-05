import { NextResponse } from 'next/server';
import clickhouse from '@/lib/clickhouse';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Default to last 24h if no date provided
  const whereClause = startDate && endDate
    ? `WHERE created_at >= parseDateTimeBestEffort('${startDate}') AND created_at <= parseDateTimeBestEffort('${endDate}')`
    : 'WHERE created_at >= now() - INTERVAL 24 HOUR';

  try {
    const result = await clickhouse.query({
      query: `
        SELECT 
          toStartOfHour(created_at) as hour,
          sum(amount) as revenue
        FROM orders
        ${whereClause}
        GROUP BY hour
        ORDER BY hour ASC
      `,
      format: 'JSONEachRow',
    });

    const data = await result.json() as any[];

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}
