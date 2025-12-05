'use client';

import { useEffect, useState } from 'react';
import MetricCard from '@/components/MetricCard';
import RevenueChart from '@/components/RevenueChart';
import StatusChart from '@/components/StatusChart';
import RealtimeChart from '@/components/RealtimeChart';
import TopCustomers from '@/components/TopCustomers';
import RecentOrders from '@/components/RecentOrders';

interface Stats {
  totalOrders: number;
  totalUsers: number;
  totalRevenue: number;
  avgOrderValue: number;
}

interface RevenueData {
  hour: string;
  revenue: number;
}

interface StatusData {
  status: string;
  count: number;
}

interface RealtimeData {
  minute: string;
  count: number;
}

interface TopCustomer {
  user_id: string;
  total_spent: number;
  order_count: number;
}

interface Order {
  order_id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
  });
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [realtimeData, setRealtimeData] = useState<RealtimeData[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Date filter state
  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
  });

  const fetchData = async () => {
    try {
      setError(null);

      // Build query string
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', new Date(dateRange.start).toISOString());
      if (dateRange.end) params.append('endDate', new Date(dateRange.end).toISOString());
      const queryString = params.toString() ? `?${params.toString()}` : '';

      // Fetch all data in parallel
      const [statsRes, revenueRes, statusRes, realtimeRes, topCustRes, recentOrdRes] = await Promise.all([
        fetch(`/api/stats${queryString}`),
        fetch(`/api/revenue${queryString}`),
        fetch(`/api/status${queryString}`),
        fetch(`/api/realtime${queryString}`),
        fetch(`/api/top-customers${queryString}`),
        fetch(`/api/recent-orders${queryString}`),
      ]);

      if (!statsRes.ok || !revenueRes.ok || !statusRes.ok || !realtimeRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [statsData, revenueData, statusData, realtimeData, topCustData, recentOrdData] = await Promise.all([
        statsRes.json(),
        revenueRes.json(),
        statusRes.json(),
        realtimeRes.json(),
        topCustRes.json(),
        recentOrdRes.json(),
      ]);

      setStats(statsData);
      setRevenueData(revenueData);
      setStatusData(statusData);
      setRealtimeData(realtimeData);
      setTopCustomers(topCustData);
      setRecentOrders(recentOrdData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please check if all services are running.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [dateRange]); // Re-fetch when date range changes

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setDateRange(prev => ({ ...prev, [type]: value }));
  };

  const clearFilters = () => {
    setDateRange({ start: '', end: '' });
  };

  if (loading && stats.totalOrders === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-400 animate-pulse">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 relative overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Background Gradients */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/20 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px]"></div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-300">
              Streaming Analytics
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Real-time CDC pipeline: Postgres → Kafka → ClickHouse
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-lg border border-white/5">
              <input
                type="datetime-local"
                value={dateRange.start}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="bg-transparent text-sm text-gray-300 focus:outline-none px-2 py-1 [&::-webkit-calendar-picker-indicator]:invert"
                placeholder="Start Date"
              />
              <span className="text-gray-600">to</span>
              <input
                type="datetime-local"
                value={dateRange.end}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="bg-transparent text-sm text-gray-300 focus:outline-none px-2 py-1 [&::-webkit-calendar-picker-indicator]:invert"
                placeholder="End Date"
              />
            </div>
            
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl backdrop-blur-md">
            {error}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Orders"
            value={stats.totalOrders.toLocaleString()}
            icon="📦"
            trend="+12%"
            color="indigo"
          />
          <MetricCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon="👥"
            trend="+5%"
            color="blue"
          />
          <MetricCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            icon="💰"
            trend="+8.5%"
            color="emerald"
          />
          <MetricCard
            title="Avg Order Value"
            value={`$${stats.avgOrderValue.toFixed(2)}`}
            icon="📈"
            trend="+2.1%"
            color="violet"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <h3 className="text-lg font-semibold text-gray-200 mb-6">Revenue Trend</h3>
            <RevenueChart data={revenueData} />
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <h3 className="text-lg font-semibold text-gray-200 mb-6">Order Status</h3>
            <StatusChart data={statusData} />
          </div>
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopCustomers data={topCustomers} />
          <RecentOrders data={recentOrders} />
        </div>

        {/* Real-time Chart */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-200">Live Traffic</h3>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-xs text-green-400 font-medium">LIVE</span>
            </div>
          </div>
          <RealtimeChart data={realtimeData} />
        </div>

        {/* Footer */}
        <div className="text-center text-gray-600 text-sm py-4">
          <p>Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
}
