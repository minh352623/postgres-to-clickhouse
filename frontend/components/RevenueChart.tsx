'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RevenueChartProps {
  data: { hour: string; revenue: number }[];
}

export default function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis 
            dataKey="hour" 
            stroke="#666" 
            fontSize={12}
            tickFormatter={(str) => new Date(str).getHours() + ':00'}
          />
          <YAxis 
            stroke="#666" 
            fontSize={12}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
            }}
            itemStyle={{ color: '#10b981' }}
            labelFormatter={(label) => new Date(label).toLocaleString()}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
