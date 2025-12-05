'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StatusChartProps {
  data: { status: string; count: number }[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export default function StatusChart({ data }: StatusChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="count"
            nameKey="status"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
