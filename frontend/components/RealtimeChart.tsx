'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RealtimeChartProps {
  data: { minute: string; count: number }[];
}

export default function RealtimeChart({ data }: RealtimeChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis
            dataKey="minute"
            stroke="#666"
            fontSize={12}
            tickFormatter={(str) => new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          />
          <YAxis stroke="#666" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
            }}
            labelFormatter={(label) => new Date(label).toLocaleTimeString()}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 2 }}
            activeDot={{ r: 8, fill: '#60a5fa' }}
            animationDuration={500}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
