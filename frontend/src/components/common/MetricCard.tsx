import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: 'crimson' | 'emerald' | 'amber' | 'cyan';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeColor = 'cyan',
}) => {
  const badgeClasses = {
    crimson: 'bg-red-950/60 text-red-400 border-red-800',
    emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-800',
    amber: 'bg-amber-950/60 text-amber-400 border-amber-800',
    cyan: 'bg-cyan-950/60 text-cyan-400 border-cyan-800',
  }[badgeColor];

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">{title}</span>
        <div className="p-2 bg-slate-800/80 rounded-lg text-slate-300">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-3">
        <div className="text-3xl font-extrabold text-white font-mono">{value}</div>
        {badge && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badgeClasses}`}>
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
    </div>
  );
};
