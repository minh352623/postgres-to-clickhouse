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
          order_id,
          user_id,
          amount,
          status,
          created_at
        FROM orders
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 10
      `,
      format: 'JSONEachRow',
    });

    const data = await result.json() as any[];

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent orders' },
      { status: 500 }
    );
  }
}
