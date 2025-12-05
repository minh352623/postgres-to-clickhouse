import { NextResponse } from 'next/server';
import clickhouse from '@/lib/clickhouse';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const whereClause = startDate && endDate 
    ? `WHERE created_at >= parseDateTimeBestEffort('${startDate}') AND created_at <= parseDateTimeBestEffort('${endDate}')`
    : '';

  try {
    const result = await clickhouse.query({
      query: `
        SELECT 
          status,
          count() as count
        FROM orders
        ${whereClause}
        GROUP BY status
        ORDER BY count DESC
      `,
      format: 'JSONEachRow',
    });

    const data = await result.json() as any[];

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching status data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status data' },
      { status: 500 }
    );
  }
}
