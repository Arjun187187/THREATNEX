import React from 'react';
import {
  Globe,
  Link as LinkIcon,
  Compass,
  Hash,
  AlertOctagon,
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { InvestigationPriority, InvestigationStatus, IOCSeverity, IOCType } from '../../types';

export const SeverityBadge: React.FC<{ severity: IOCSeverity | string; showIcon?: boolean; size?: 'sm' | 'md' }> = ({
  severity,
  showIcon = true,
  size = 'sm',
}) => {
  const norm = (severity || 'unknown').toLowerCase();

  const config: Record<string, { bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
    critical: {
      bg: 'bg-rose-950/60',
      text: 'text-rose-400',
      border: 'border-rose-800/80',
      icon: AlertOctagon,
    },
    high: {
      bg: 'bg-orange-950/60',
      text: 'text-orange-400',
      border: 'border-orange-800/80',
      icon: AlertTriangle,
    },
    medium: {
      bg: 'bg-amber-950/60',
      text: 'text-amber-400',
      border: 'border-amber-800/80',
      icon: AlertTriangle,
    },
    low: {
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-400',
      border: 'border-emerald-800/80',
      icon: Shield,
    },
    info: {
      bg: 'bg-sky-950/60',
      text: 'text-sky-400',
      border: 'border-sky-800/80',
      icon: HelpCircle,
    },
    unknown: {
      bg: 'bg-slate-900',
      text: 'text-slate-400',
      border: 'border-slate-700',
      icon: HelpCircle,
    },
  };

  const current = config[norm] || config.unknown;
  const Icon = current.icon;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase rounded border ${current.bg} ${current.text} ${current.border} ${pad} tracking-wider`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{norm}</span>
    </span>
  );
};

export const StatusBadge: React.FC<{ status: InvestigationStatus | string; showIcon?: boolean }> = ({
  status,
  showIcon = true,
}) => {
  const norm = (status || 'open').toLowerCase();

  const styles: Record<string, { bg: string; text: string; border: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
    open: {
      bg: 'bg-amber-950/40',
      text: 'text-amber-400',
      border: 'border-amber-700/60',
      label: 'OPEN',
      icon: Clock,
    },
    in_progress: {
      bg: 'bg-sky-950/40',
      text: 'text-sky-400',
      border: 'border-sky-700/60',
      label: 'IN PROGRESS',
      icon: Clock,
    },
    resolved: {
      bg: 'bg-emerald-950/40',
      text: 'text-emerald-400',
      border: 'border-emerald-700/60',
      label: 'RESOLVED',
      icon: CheckCircle,
    },
    closed: {
      bg: 'bg-slate-900',
      text: 'text-slate-400',
      border: 'border-slate-800',
      label: 'CLOSED',
      icon: XCircle,
    },
  };

  const style = styles[norm] || styles.open;
  const Icon = style.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium border ${style.bg} ${style.text} ${style.border}`}
    >
      {showIcon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{style.label}</span>
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: InvestigationPriority | string }> = ({ priority }) => {
  const norm = (priority || 'medium').toLowerCase();

  const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    low: { bg: 'bg-slate-900', text: 'text-slate-400', border: 'border-slate-700', label: 'LOW' },
    medium: { bg: 'bg-blue-950/50', text: 'text-blue-400', border: 'border-blue-700/60', label: 'MED' },
    high: { bg: 'bg-amber-950/50', text: 'text-amber-400', border: 'border-amber-700/70', label: 'HIGH' },
    critical: { bg: 'bg-rose-950/60', text: 'text-rose-400', border: 'border-rose-700/80', label: 'CRITICAL' },
  };

  const style = styles[norm] || styles.medium;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${style.bg} ${style.text} ${style.border}`}
    >
      {style.label}
    </span>
  );
};

export const IOCTypePill: React.FC<{ type: IOCType | string; showIcon?: boolean }> = ({
  type,
  showIcon = true,
}) => {
  const norm = (type || 'unknown').toLowerCase();

  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    ipv4: Globe,
    ipv6: Globe,
    domain: Compass,
    url: LinkIcon,
    md5: Hash,
    sha1: Hash,
    sha256: Hash,
    cve: AlertOctagon,
  };

  const Icon = icons[norm] || Hash;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-soc-surface text-soc-accent border border-soc-borderSubtle">
      {showIcon && <Icon className="w-3 h-3 text-soc-accent/80 shrink-0" />}
      <span>{norm}</span>
    </span>
  );
};

export const ConfidenceScore: React.FC<{ score: number }> = ({ score }) => {
  const clamped = Math.max(0, Math.min(100, score || 0));
  const color =
    clamped >= 80 ? 'bg-rose-500' : clamped >= 50 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="flex items-center gap-2" title={`Confidence: ${clamped}%`}>
      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${clamped}%` }}></div>
      </div>
      <span className="text-[11px] font-mono text-slate-300 font-semibold">{clamped}%</span>
    </div>
  );
};
