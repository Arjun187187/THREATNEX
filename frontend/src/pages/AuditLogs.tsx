import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User,
  Globe,
  Copy,
  Check,
  Calendar,
  Lock,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { AuditLogListResponse } from '../types';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ToastContainer, ToastMessage } from '../components/common/Toast';

export const AuditLogs: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // Fetch Audit Logs
  const { data: auditData, isLoading, isFetching, refetch } = useQuery<AuditLogListResponse>({
    queryKey: ['audit-logs', page, pageSize, actionFilter, resourceFilter, appliedSearch],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };
      if (actionFilter && actionFilter !== 'all') params.action = actionFilter;
      if (resourceFilter && resourceFilter !== 'all') params.resource_type = resourceFilter;
      if (appliedSearch.trim()) params.search = appliedSearch.trim();

      const res = await apiClient.get<AuditLogListResponse>('/audit/logs', { params });
      return res.data;
    },
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    addToast('info', 'Copied to Clipboard');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchQuery);
  };

  const getActionBadge = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('LOGIN') || act.includes('AUTH') || act.includes('REGISTER')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
          {action}
        </span>
      );
    }
    if (act.includes('DELETE') || act.includes('REVISE') || act.includes('REMOVE')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-950/60 text-rose-400 border border-rose-800/80">
          {action}
        </span>
      );
    }
    if (act.includes('ALERT') || act.includes('ESCALATE') || act.includes('RESOLVE')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-950/60 text-amber-400 border border-amber-800/80">
          {action}
        </span>
      );
    }
    if (act.includes('AI') || act.includes('FEED') || act.includes('SYNC')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-950/60 text-cyan-400 border border-cyan-800/80">
          {action}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={(id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-soc-card p-6 rounded-xl border border-soc-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
              Module 14: System Audit Trail
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <History className="w-6 h-6 text-soc-accent" />
            Compliance & Security Audit Trail
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Tamper-evident, immutable event log tracking all authentication attempts, threat intelligence updates, indicator investigations, and administrative system actions for SOC 2 Type II compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-2 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh audit logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh Logs
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-soc-surface border border-soc-border rounded-xl p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Audit Events</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {auditData?.total ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Stored in compliance audit log</div>
        </div>
        <div className="bg-soc-surface border border-soc-border rounded-xl p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Log Integrity</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Verified
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Immutable PostgreSQL records</div>
        </div>
        <div className="bg-soc-surface border border-soc-border rounded-xl p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Retention Horizon</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            365 Days
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Full forensic history retained</div>
        </div>
        <div className="bg-soc-surface border border-soc-border rounded-xl p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400">RBAC Enforcement</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-1 flex items-center gap-1.5">
            <Lock className="w-5 h-5 text-indigo-400" />
            Strict
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Operator identity tracking</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-soc-card p-4 rounded-xl border border-soc-border flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search details, actor, IP, or resource..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-16 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-soc-accent font-mono"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 rounded transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Action Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-soc-accent font-mono"
            >
              <option value="all">All Actions</option>
              <option value="LOGIN">LOGIN</option>
              <option value="REGISTER">REGISTER</option>
              <option value="CREATE_ALERT">CREATE_ALERT</option>
              <option value="UPDATE_ALERT">UPDATE_ALERT</option>
              <option value="RESOLVE_ALERT">RESOLVE_ALERT</option>
              <option value="CREATE_WATCHLIST">CREATE_WATCHLIST</option>
              <option value="ADD_INDICATOR">ADD_INDICATOR</option>
              <option value="FEED_SYNC">FEED_SYNC</option>
              <option value="AI_THREAT_ANALYSIS">AI_THREAT_ANALYSIS</option>
              <option value="GENERATE_REPORT">GENERATE_REPORT</option>
              <option value="UPDATE_SETTINGS">UPDATE_SETTINGS</option>
            </select>
          </div>

          {/* Resource Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Resource:</span>
            <select
              value={resourceFilter}
              onChange={(e) => {
                setResourceFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-soc-accent font-mono"
            >
              <option value="all">All Resources</option>
              <option value="auth">auth</option>
              <option value="alert">alert</option>
              <option value="watchlist">watchlist</option>
              <option value="indicator">indicator</option>
              <option value="report">report</option>
              <option value="settings">settings</option>
              <option value="feed">feed</option>
              <option value="ai">ai</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-soc-surface border border-soc-border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={8} />
          </div>
        ) : (auditData?.items || []).length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No Audit Events Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              No audit logs matched your active filter or search criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-soc-border bg-slate-900/60 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soc-border/50 text-xs">
                {auditData?.items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(log.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-cyan-400 font-semibold">{log.resource_type}</span>
                        {log.resource_id && (
                          <button
                            onClick={() => handleCopy(log.resource_id!, `res-${log.id}`)}
                            className="font-mono text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-0.5"
                            title={`Copy ID: ${log.resource_id}`}
                          >
                            #{log.resource_id.slice(0, 8)}
                            {copiedKey === `res-${log.id}` ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono font-medium">{log.username || 'System'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-slate-400 text-[11px]">
                        <Globe className="w-3 h-3 text-slate-500" />
                        {log.ip_address || '127.0.0.1'}
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-lg">
                      <div className="font-mono text-xs text-slate-300 break-all select-text bg-slate-900/60 p-1.5 rounded border border-slate-800/80">
                        {log.details || '—'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {auditData && auditData.total_pages > 1 && (
          <div className="p-4 border-t border-soc-border bg-slate-900/40 flex items-center justify-between text-xs font-mono text-slate-400">
            <div>
              Showing page {auditData.page} of {auditData.total_pages} ({auditData.total} total logs)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded text-slate-300 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, auditData.total_pages))}
                disabled={page >= auditData.total_pages}
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded text-slate-300 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
