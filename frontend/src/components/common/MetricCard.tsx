import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: 'crimson' | 'emerald' | 'amber' | 'cyan' | 'blue';
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeColor = 'cyan',
  trend,
  onClick,
}) => {
  const badgeClasses: Record<string, string> = {
    crimson: 'bg-rose-950/60 text-rose-400 border-rose-800/80',
    emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80',
    amber: 'bg-amber-950/60 text-amber-400 border-amber-800/80',
    cyan: 'bg-sky-950/60 text-sky-400 border-sky-800/80',
    blue: 'bg-blue-950/60 text-blue-400 border-blue-800/80',
  };

  const iconColors: Record<string, string> = {
    crimson: 'text-rose-400 bg-rose-950/30 border-rose-900/40',
    emerald: 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40',
    amber: 'text-amber-400 bg-amber-950/30 border-amber-900/40',
    cyan: 'text-sky-400 bg-sky-950/30 border-sky-900/40',
    blue: 'text-blue-400 bg-blue-950/30 border-blue-900/40',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-soc-card border border-soc-border hover:border-soc-borderLight rounded-xl p-5 transition-all shadow-soc-card flex flex-col justify-between ${
        onClick ? 'cursor-pointer hover:bg-soc-cardHover' : ''
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-mono">
            {title}
          </span>
          <div className={`p-2 rounded-lg border ${iconColors[badgeColor] || iconColors.cyan}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-extrabold text-white font-mono tracking-tight">{value}</div>
          {badge && (
            <span
              className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                badgeClasses[badgeColor] || badgeClasses.cyan
              }`}
            >
              {badge}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-soc-borderSubtle flex items-center justify-between text-xs text-slate-500 font-sans">
        <span className="truncate">{subtitle}</span>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium shrink-0 ml-2 ${
              trend.direction === 'up'
                ? 'text-rose-400'
                : trend.direction === 'down'
                ? 'text-emerald-400'
                : 'text-slate-400'
            }`}
          >
            {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend.direction === 'neutral' && <Minus className="w-3 h-3" />}
            <span>{trend.value}</span>
          </span>
        )}
      </div>
    </div>
  );
};
