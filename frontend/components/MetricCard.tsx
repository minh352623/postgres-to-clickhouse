interface MetricCardProps {
  title: string;
  value: string;
  icon: string;
  trend?: string;
  color?: 'indigo' | 'blue' | 'emerald' | 'violet';
}

const colorMap = {
  indigo: 'from-indigo-500 to-indigo-600',
  blue: 'from-blue-500 to-blue-600',
  emerald: 'from-emerald-500 to-emerald-600',
  violet: 'from-violet-500 to-violet-600',
};

const bgMap = {
  indigo: 'bg-indigo-500/10 border-indigo-500/20',
  blue: 'bg-blue-500/10 border-blue-500/20',
  emerald: 'bg-emerald-500/10 border-emerald-500/20',
  violet: 'bg-violet-500/10 border-violet-500/20',
};

export default function MetricCard({ title, value, icon, trend, color = 'blue' }: MetricCardProps) {
  return (
    <div className={`relative overflow-hidden p-6 rounded-2xl backdrop-blur-xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${bgMap[color]}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-full w-fit">
              <span>↑</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorMap[color]} shadow-lg`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}
