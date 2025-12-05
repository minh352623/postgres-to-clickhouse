'use client';

interface TopCustomer {
  user_id: string;
  total_spent: number;
  order_count: number;
}

interface TopCustomersProps {
  data: TopCustomer[];
}

export default function TopCustomers({ data }: TopCustomersProps) {
  return (
    <div className="h-full p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
      <h3 className="text-lg font-semibold text-gray-200 mb-6">Top Customers</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="text-xs uppercase bg-white/5 text-gray-300">
            <tr>
              <th className="px-4 py-3 rounded-l-lg">User</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3 rounded-r-lg text-right">Total Spent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((customer, index) => (
              <tr key={customer.user_id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-medium text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                      {index + 1}
                    </div>
                    <span className="truncate max-w-[120px]" title={customer.user_id}>
                      {customer.user_id.slice(0, 8)}...
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">{customer.order_count}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-400">
                  ${customer.total_spent.toFixed(2)}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
