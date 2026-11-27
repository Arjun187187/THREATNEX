import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  AlertTriangle,
  Search,
  CheckCircle2,
  ArrowUpRight,
  Briefcase,
  Copy,
  Check,
  X,
  Eye,
  Plus,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { SecurityAlert, AlertListResponse, AlertStatsResponse } from '../types';
import { SeverityBadge } from '../components/common/Badges';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ToastContainer, ToastMessage } from '../components/common/Toast';
import { formatApiError } from '../utils/errors';

export const Alerts: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [showResolveModal, setShowResolveModal] = useState<SecurityAlert | null>(null);
  const [showEscalateModal, setShowEscalateModal] = useState<SecurityAlert | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Resolution and escalation form states
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [escalateTitle, setEscalateTitle] = useState('');

  // Create alert form states
  const [newAlertTitle, setNewAlertTitle] = useState('');
  const [newAlertIndicator, setNewAlertIndicator] = useState('');
  const [newAlertSeverity, setNewAlertSeverity] = useState('high');
  const [newAlertRule, setNewAlertRule] = useState('Manual SOC Triage Alert');
  const [newAlertDesc, setNewAlertDesc] = useState('');

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // 1. Fetch Alerts
  const { data: alertsData, isLoading: isLoadingAlerts } = useQuery<AlertListResponse>({
    queryKey: ['security-alerts', statusFilter, severityFilter, searchQuery, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('page_size', String(pageSize));
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await apiClient.get<AlertListResponse>(`/alerts/?${params.toString()}`);
      return res.data;
    },
  });

  // 2. Fetch Alert Stats
  const { data: alertStats } = useQuery<AlertStatsResponse>({
    queryKey: ['security-alerts-stats'],
    queryFn: async () => {
      const res = await apiClient.get<AlertStatsResponse>('/alerts/stats');
      return res.data;
    },
  });

  // 3. Acknowledge Alert Mutation
  const ackMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<SecurityAlert>(`/alerts/${id}/acknowledge`, {});
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['security-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['security-alerts-stats'] });
      addToast('success', 'Alert Acknowledged', `Claimed alert: ${data.title}`);
    },
    onError: (err: any) => addToast('error', 'Acknowledge Failed', formatApiError(err)),
  });

  // 4. Resolve Alert Mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await apiClient.post<SecurityAlert>(`/alerts/${id}/resolve`, { resolution_notes: notes });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['security-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['security-alerts-stats'] });
      setShowResolveModal(null);
      setResolutionNotes('');
      addToast('success', 'Alert Resolved', `Closed alert: ${data.title}`);
    },
    onError: (err: any) => addToast('error', 'Resolution Failed', formatApiError(err)),
  });

  // 5. Escalate Alert Mutation
  const escalateMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await apiClient.post<SecurityAlert>(`/alerts/${id}/escalate`, {
        create_new_case: true,
        case_title: title || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['security-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['security-alerts-stats'] });
      setShowEscalateModal(null);
      setEscalateTitle('');
      addToast('success', 'Alert Escalated to Case', `Created incident investigation case for ${data.title}`);
    },
    onError: (err: any) => addToast('error', 'Escalation Failed', formatApiError(err)),
  });

  // 6. Create Alert Mutation
  const createAlertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<SecurityAlert>('/alerts/', {
        title: newAlertTitle.trim(),
        indicator_value: newAlertIndicator.trim(),
        severity: newAlertSeverity,
        source_rule: newAlertRule.trim(),
        description: newAlertDesc.trim() || undefined,
        confidence: 90.0,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['security-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['security-alerts-stats'] });
      setShowCreateModal(false);
      setNewAlertTitle('');
      setNewAlertIndicator('');
      setNewAlertDesc('');
      addToast('success', 'Alert Created', `Generated alert for ${data.indicator_value}`);
    },
    onError: (err: any) => addToast('error', 'Failed to Create Alert', formatApiError(err)),
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    addToast('info', 'Copied to Clipboard');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'acknowledged':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'resolved':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'escalated':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={(id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-soc-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-soc-accent" />
              Security Alerts & Correlation
            </h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
              Live Triage
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time threat alerts correlated against watchlists, provider feeds, and multi-engine investigations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-soc-accent hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center gap-2 transition-all shadow-md shadow-soc-accent/10"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Alert</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Alerts</span>
            <div className="text-2xl font-bold font-mono text-white">
              {alertStats?.total_alerts || alertsData?.total || 0}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-soc-base border border-soc-border text-soc-accent">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-rose-400 uppercase tracking-wider">Active / Open</span>
            <div className="text-2xl font-bold font-mono text-rose-400">
              {alertStats?.by_status?.open || 0}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">Acknowledged</span>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {alertStats?.by_status?.acknowledged || 0}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">Resolved / Closed</span>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {alertStats?.by_status?.resolved || 0}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search alerts by title, indicator, or rule..."
              className="w-full bg-soc-base border border-soc-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-soc-accent"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-soc-base border border-soc-border p-1 rounded-lg">
            {['open', 'acknowledged', 'escalated', 'resolved', 'all'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 text-[11px] font-mono rounded uppercase transition-colors ${
                  statusFilter === st
                    ? 'bg-soc-accent text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="bg-soc-base border border-soc-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono uppercase"
          >
            <option value="all">ALL SEVERITIES</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-soc-panel border border-soc-border rounded-xl shadow-lg overflow-hidden">
        {isLoadingAlerts ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : !alertsData || alertsData.items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-soc-base border border-soc-border text-slate-500">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="text-sm font-semibold text-white">No Security Alerts</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No alerts match the selected status and severity criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-soc-base/40 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-soc-border">
                  <th className="py-3 px-4">Alert Title & Detection Rule</th>
                  <th className="py-3 px-3">Observable</th>
                  <th className="py-3 px-2">Severity</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-3">Assignee</th>
                  <th className="py-3 px-3">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soc-border/50">
                {alertsData.items.map((alert) => (
                  <tr key={alert.id} className="hover:bg-soc-base/60 transition-colors">
                    {/* Title */}
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="font-semibold text-white truncate" title={alert.title}>
                        {alert.title}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate" title={alert.source_rule}>
                        {alert.source_rule}
                      </div>
                    </td>

                    {/* Observable */}
                    <td className="py-3 px-3 font-mono text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[150px]" title={alert.indicator_value}>
                          {alert.indicator_value}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(alert.indicator_value, alert.id)}
                          className="text-slate-500 hover:text-white"
                        >
                          {copiedKey === alert.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Severity */}
                    <td className="py-3 px-2">
                      <SeverityBadge severity={alert.severity as any} />
                    </td>

                    {/* Status */}
                    <td className="py-3 px-2">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${getStatusBadge(
                          alert.status
                        )}`}
                      >
                        {alert.status}
                      </span>
                    </td>

                    {/* Assignee */}
                    <td className="py-3 px-3 font-mono text-slate-300 text-[11px]">
                      {alert.assigned_to || <span className="text-slate-600">Unassigned</span>}
                    </td>

                    {/* Created */}
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(alert.created_at).toLocaleDateString()} {new Date(alert.created_at).toLocaleTimeString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedAlert(alert)}
                          className="p-1.5 bg-soc-base hover:bg-slate-800 border border-soc-border rounded text-slate-300 hover:text-white"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {alert.status === 'open' && (
                          <button
                            type="button"
                            onClick={() => ackMutation.mutate(alert.id)}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded text-[11px] font-mono font-semibold"
                          >
                            Acknowledge
                          </button>
                        )}

                        {alert.status !== 'resolved' && (
                          <button
                            type="button"
                            onClick={() => setShowResolveModal(alert)}
                            className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-[11px] font-mono font-semibold"
                          >
                            Resolve
                          </button>
                        )}

                        {alert.status !== 'escalated' && !alert.case_id && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowEscalateModal(alert);
                              setEscalateTitle(`Incident: ${alert.title}`);
                            }}
                            className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded text-[11px] font-mono font-semibold flex items-center gap-1"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            <span>Escalate</span>
                          </button>
                        )}

                        {alert.case_id && (
                          <button
                            type="button"
                            onClick={() => navigate('/investigations')}
                            className="px-2 py-1 bg-slate-800 border border-soc-border text-slate-300 rounded text-[11px] font-mono flex items-center gap-1"
                            title="Linked Case"
                          >
                            <Briefcase className="w-3 h-3 text-soc-accent" />
                            <span>Case</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {alertsData && alertsData.total > 0 && (
          <div className="p-4 border-t border-soc-border bg-soc-base/30 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">
              Showing {alertsData.items.length} of {alertsData.total} alerts
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 bg-soc-base border border-soc-border rounded text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-slate-300">
                Page {page} of {alertsData.total_pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(alertsData.total_pages, p + 1))}
                disabled={page >= alertsData.total_pages}
                className="p-1 bg-soc-base border border-soc-border rounded text-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-soc-panel border border-soc-border rounded-xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Resolve Security Alert
            </h3>
            <p className="text-xs text-slate-400">
              Closing alert: <strong className="text-white">{showResolveModal.title}</strong>
            </p>

            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Analyst Resolution Notes</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="State remediation action taken, false-positive verification, or firewall block applied..."
                rows={3}
                className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-soc-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-soc-border">
              <button
                type="button"
                onClick={() => setShowResolveModal(null)}
                className="px-3 py-1.5 bg-soc-base border border-soc-border rounded-lg text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resolveMutation.mutate({ id: showResolveModal.id, notes: resolutionNotes })}
                disabled={!resolutionNotes.trim() || resolveMutation.isPending}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs disabled:opacity-50"
              >
                {resolveMutation.isPending ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-soc-panel border border-soc-border rounded-xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-purple-400" />
              Escalate to Incident Case
            </h3>
            <p className="text-xs text-slate-400">
              Spawns an official investigation case in THREATNEX Case Management.
            </p>

            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Investigation Case Title</label>
              <input
                type="text"
                value={escalateTitle}
                onChange={(e) => setEscalateTitle(e.target.value)}
                className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-soc-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-soc-border">
              <button
                type="button"
                onClick={() => setShowEscalateModal(null)}
                className="px-3 py-1.5 bg-soc-base border border-soc-border rounded-lg text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => escalateMutation.mutate({ id: showEscalateModal.id, title: escalateTitle })}
                disabled={escalateMutation.isPending}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs disabled:opacity-50"
              >
                {escalateMutation.isPending ? 'Escalating...' : 'Confirm Escalation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-soc-panel border border-soc-border rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-soc-border">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-soc-accent" />
                Generate Security Alert
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Alert Title</label>
                <input
                  type="text"
                  value={newAlertTitle}
                  onChange={(e) => setNewAlertTitle(e.target.value)}
                  placeholder="e.g. Cobalt Strike Beaconing Detected"
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white focus:outline-none focus:border-soc-accent"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Indicator Observable</label>
                <input
                  type="text"
                  value={newAlertIndicator}
                  onChange={(e) => setNewAlertIndicator(e.target.value)}
                  placeholder="e.g. 198.51.100.24, malware.com"
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-soc-accent"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Detection Severity</label>
                <select
                  value={newAlertSeverity}
                  onChange={(e) => setNewAlertSeverity(e.target.value)}
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white font-mono uppercase"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Detection Rule / Source</label>
                <input
                  type="text"
                  value={newAlertRule}
                  onChange={(e) => setNewAlertRule(e.target.value)}
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Alert Description</label>
                <textarea
                  value={newAlertDesc}
                  onChange={(e) => setNewAlertDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-soc-border">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 bg-soc-base border border-soc-border rounded-lg text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createAlertMutation.mutate()}
                disabled={!newAlertTitle.trim() || !newAlertIndicator.trim() || createAlertMutation.isPending}
                className="px-4 py-1.5 bg-soc-accent text-slate-950 font-semibold rounded-lg text-xs disabled:opacity-50"
              >
                {createAlertMutation.isPending ? 'Generating...' : 'Create Alert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-soc-panel border border-soc-border rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-soc-border">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-soc-accent" />
                <h3 className="text-sm font-bold text-white">Alert #{selectedAlert.id.slice(0, 8)}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-slate-400 font-mono text-[11px]">Title</div>
                <div className="text-sm font-bold text-white">{selectedAlert.title}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-soc-base p-2.5 rounded border border-soc-border">
                  <div className="text-slate-400 font-mono text-[10px]">Observable</div>
                  <div className="font-mono text-white font-semibold truncate">{selectedAlert.indicator_value}</div>
                </div>
                <div className="bg-soc-base p-2.5 rounded border border-soc-border">
                  <div className="text-slate-400 font-mono text-[10px]">Detection Rule</div>
                  <div className="font-mono text-white truncate">{selectedAlert.source_rule}</div>
                </div>
              </div>

              {selectedAlert.description && (
                <div>
                  <div className="text-slate-400 font-mono text-[11px] mb-1">Details</div>
                  <div className="bg-soc-base p-3 rounded border border-soc-border text-slate-300 leading-relaxed">
                    {selectedAlert.description}
                  </div>
                </div>
              )}

              {selectedAlert.resolution_notes && (
                <div>
                  <div className="text-emerald-400 font-mono text-[11px] mb-1">Resolution Notes</div>
                  <div className="bg-emerald-950/20 border border-emerald-800/40 p-3 rounded text-emerald-200 leading-relaxed">
                    {selectedAlert.resolution_notes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-soc-border">
              <button
                type="button"
                onClick={() => {
                  setSelectedAlert(null);
                  navigate(`/ioc-search?q=${encodeURIComponent(selectedAlert.indicator_value)}`);
                }}
                className="px-3 py-1.5 bg-soc-base hover:bg-slate-800 border border-soc-border rounded text-xs text-soc-accent flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Investigate IOC</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="px-3 py-1.5 bg-soc-base hover:bg-slate-800 border border-soc-border rounded text-xs text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Alerts;
