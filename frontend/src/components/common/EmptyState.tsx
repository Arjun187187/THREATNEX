import React from 'react';
import { Shield, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Shield,
  action,
}) => {
  return (
    <div className="p-10 border border-dashed border-soc-border rounded-xl flex flex-col items-center justify-center text-center bg-soc-base/40 my-2">
      <div className="p-3 bg-soc-surface border border-soc-border rounded-xl text-slate-400 mb-4 shadow-soc-subtle">
        <Icon className="w-7 h-7 text-soc-accent/80" />
      </div>
      <h3 className="text-sm font-semibold text-slate-200 mb-1.5">{title}</h3>
      <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-soc-accent hover:bg-soc-accentHover text-white text-xs font-medium rounded-lg shadow-soc-subtle transition-all flex items-center gap-2"
        >
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};
