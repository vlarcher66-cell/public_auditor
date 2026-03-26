import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: 'navy' | 'green' | 'red' | 'gold';
}

const colorMap = {
  navy: 'bg-navy-800 text-white',
  green: 'bg-emerald-600 text-white',
  red: 'bg-red-600 text-white',
  gold: 'bg-gold-500 text-navy-800',
};

export default function StatCard({ title, value, subtitle, icon, trend, color = 'navy' }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shadow-sm', colorMap[color])}>
          {icon}
        </div>
        {trend && (
          <div className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            trend.value >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
          )}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-navy-800">{value}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}
