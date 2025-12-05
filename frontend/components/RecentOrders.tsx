'use client';

interface Order {
  order_id: string;
  user_id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface RecentOrdersProps {
  data: Order[];
}

const statusColors: Record<string, string> = {
  created: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  shipped: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  delivered: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function RecentOrders({ data }: RecentOrdersProps) {
  return (
    <div className="h-full p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
      <h3 className="text-lg font-semibold text-gray-200 mb-6">Recent Activity</h3>
      <div className="space-y-4">
        {data.map((order) => (
          <div 
            key={order.order_id}
            className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${statusColors[order.status] || 'bg-gray-500/10 text-gray-400'}`}>
                <span className="text-xl">
                  {order.status === 'created' && '🆕'}
                  {order.status === 'paid' && '💰'}
                  {order.status === 'shipped' && '🚚'}
                  {order.status === 'delivered' && '✅'}
                  {order.status === 'cancelled' && '❌'}
                </span>
              </div>
              <div>
                <p className="font-medium text-white text-sm">
                  Order #{order.order_id.slice(0, 8)}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-white text-sm">
                ${order.amount.toFixed(2)}
              </p>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusColors[order.status] || 'border-gray-500/20 text-gray-400'}`}>
                {order.status}
              </span>
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
}
