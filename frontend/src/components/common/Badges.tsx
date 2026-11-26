import React from 'react';
import { InvestigationPriority, InvestigationStatus, IOCType } from '../../types';

export const StatusBadge: React.FC<{ status: InvestigationStatus }> = ({ status }) => {
  const styles: Record<InvestigationStatus, { bg: string; text: string; label: string }> = {
    open: { bg: 'bg-amber-950/50 border-amber-800', text: 'text-amber-400', label: 'OPEN' },
    in_progress: { bg: 'bg-cyan-950/50 border-cyan-800', text: 'text-cyan-400', label: 'IN PROGRESS' },
    resolved: { bg: 'bg-emerald-950/50 border-emerald-800', text: 'text-emerald-400', label: 'RESOLVED' },
    closed: { bg: 'bg-slate-800 border-slate-700', text: 'text-slate-400', label: 'CLOSED' },
  };

  const style = styles[status] || styles.open;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: InvestigationPriority }> = ({ priority }) => {
  const styles: Record<InvestigationPriority, { bg: string; text: string; label: string }> = {
    low: { bg: 'bg-slate-800 border-slate-700', text: 'text-slate-400', label: 'LOW' },
    medium: { bg: 'bg-blue-950/50 border-blue-800', text: 'text-blue-400', label: 'MED' },
    high: { bg: 'bg-amber-950/50 border-amber-800', text: 'text-amber-400', label: 'HIGH' },
    critical: { bg: 'bg-red-950/50 border-red-800', text: 'text-red-400', label: 'CRITICAL' },
  };

  const style = styles[priority] || styles.medium;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
};

export const IOCTypePill: React.FC<{ type: IOCType | string }> = ({ type }) => {
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-cyan-300 border border-slate-700">
      {type}
    </span>
  );
};
