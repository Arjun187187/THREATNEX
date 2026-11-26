import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => {
  return (
    <div className="p-10 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center bg-slate-900/20">
      <div className="p-3 bg-slate-800 rounded-full text-slate-400 mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-slate-200 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg shadow-md transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
