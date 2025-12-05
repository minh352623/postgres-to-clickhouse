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
    // Get total orders
    const ordersResult = await clickhouse.query({
      query: `SELECT count() as total FROM orders ${whereClause}`,
      format: 'JSONEachRow',
    });
    const ordersData = await ordersResult.json() as any[];
    const totalOrders = ordersData[0]?.total || 0;

    // Get total users
    const usersResult = await clickhouse.query({
      query: `SELECT count(DISTINCT user_id) as total FROM orders ${whereClause}`,
      format: 'JSONEachRow',
    });
    const usersData = await usersResult.json() as any[];
    const totalUsers = usersData[0]?.total || 0;

    // Get total revenue
    const revenueResult = await clickhouse.query({
      query: `SELECT sum(amount) as total FROM orders ${whereClause}`,
      format: 'JSONEachRow',
    });
    const revenueData = await revenueResult.json() as any[];
    const totalRevenue = revenueData[0]?.total || 0;

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return NextResponse.json({
      totalOrders,
      totalUsers,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
