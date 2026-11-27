import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Plus,
  Filter,
  Clock,
  UserCheck,
  Search,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Investigation, InvestigationPriority, InvestigationStatus } from '../types';
import { PriorityBadge, IOCTypePill } from '../components/common/Badges';
import { EmptyState } from '../components/common/EmptyState';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { Modal } from '../components/common/Modal';
import { InvestigationDetailModal } from '../components/common/InvestigationDetailModal';
import { ToastContainer, ToastMessage } from '../components/common/Toast';

export const Investigations: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<InvestigationPriority>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [indicatorsRaw, setIndicatorsRaw] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const queryClient = useQueryClient();

  // Fetch investigations
  const { data: investigations, isLoading, refetch } = useQuery<Investigation[]>({
    queryKey: ['investigations-list', statusFilter],
    queryFn: async () => {
      const url = statusFilter === 'all'
        ? '/investigations/'
        : `/investigations/?status=${statusFilter}`;
      const res = await apiClient.get<Investigation[]>(url);
      return res.data;
    },
  });

  // Create investigation mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/investigations/', payload);
      return res.data;
    },
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['investigations-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-investigations'] });
      setIsCreateModalOpen(false);
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setIndicatorsRaw('');
      addToast('success', 'Case Created', `Investigation '${newCase.title}' initialized.`);
    },
    onError: (err: any) => {
      addToast('error', 'Creation Failed', err.response?.data?.detail || 'Could not create investigation.');
    },
  });

  // Inline status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvestigationStatus }) => {
      const res = await apiClient.patch(`/investigations/${id}`, { status });
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['investigations-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      addToast('success', 'Status Updated', `Case status set to ${updated.status.toUpperCase()}.`);
    },
    onError: (err: any) => {
      addToast('error', 'Update Failed', err.response?.data?.detail || 'Unable to update case.');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const indicator_values = indicatorsRaw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      assigned_to: assignedTo.trim() || null,
      indicator_values: indicator_values.length > 0 ? indicator_values : undefined,
    });
  };

  // Filter investigations
  const filteredInvestigations = useMemo(() => {
    if (!investigations) return [];
    return investigations.filter((inv) => {
      const matchesPriority =
        priorityFilter === 'all' || inv.priority.toLowerCase() === priorityFilter.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        inv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.assigned_to && inv.assigned_to.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (inv.indicators && inv.indicators.some((ind) => ind.value.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchesPriority && matchesSearch;
    });
  }, [investigations, priorityFilter, searchQuery]);

  // Compute status counts
  const statusCounts = useMemo(() => {
    if (!investigations) return { all: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    return {
      all: investigations.length,
      open: investigations.filter((i) => i.status === 'open').length,
      in_progress: investigations.filter((i) => i.status === 'in_progress').length,
      resolved: investigations.filter((i) => i.status === 'resolved').length,
      closed: investigations.filter((i) => i.status === 'closed').length,
    };
  }, [investigations]);

  return (
    <div className="space-y-6">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg lg:text-xl font-bold text-white tracking-wide">
            SOC Case Management & Triage
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track, assign, prioritize, and investigate confirmed security incidents and correlated IOC telemetry.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 bg-soc-accent hover:bg-soc-accentHover text-white font-medium text-xs rounded-xl flex items-center gap-2 shadow-soc-subtle transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Investigation</span>
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-soc-border pb-3 text-xs font-mono">
        {[
          { key: 'all', label: 'All Cases', count: statusCounts.all },
          { key: 'open', label: 'Open', count: statusCounts.open },
          { key: 'in_progress', label: 'In Progress', count: statusCounts.in_progress },
          { key: 'resolved', label: 'Resolved', count: statusCounts.resolved },
          { key: 'closed', label: 'Closed', count: statusCounts.closed },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-colors ${
              statusFilter === tab.key
                ? 'bg-soc-surface text-soc-accent border-soc-accent/40 font-semibold'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-soc-surface/50'
            }`}
          >
            <span>{tab.label}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 border border-slate-800 text-slate-400">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search and Priority Filter Bar */}
      <div className="bg-soc-surface border border-soc-border rounded-xl p-4 shadow-soc-card flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, assignee, or IOC..."
            className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-soc-base border border-soc-border rounded-lg px-2.5 py-1 text-xs text-slate-400 font-mono">
            <Filter className="w-3 h-3 text-slate-500" />
            <span className="text-[11px] text-slate-500">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none"
            >
              <option value="all" className="bg-slate-900">All Priorities</option>
              <option value="critical" className="bg-slate-900">Critical</option>
              <option value="high" className="bg-slate-900">High</option>
              <option value="medium" className="bg-slate-900">Medium</option>
              <option value="low" className="bg-slate-900">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Investigations List */}
      <div className="space-y-3">
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : filteredInvestigations.length === 0 ? (
          <EmptyState
            title="No investigations match your filters"
            description="No cases found matching your status or search criteria. Open a new investigation case to start tracking incidents."
            action={{
              label: 'Open Investigation Case',
              onClick: () => setIsCreateModalOpen(true),
            }}
          />
        ) : (
          filteredInvestigations.map((inv) => (
            <div
              key={inv.id}
              className="bg-soc-surface border border-soc-border hover:border-soc-borderLight rounded-xl p-5 shadow-soc-card transition-all space-y-3 group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <PriorityBadge priority={inv.priority} />
                  <h3
                    onClick={() => setSelectedInvestigation(inv)}
                    className="text-sm font-bold text-white hover:text-soc-accent transition-colors cursor-pointer truncate"
                  >
                    {inv.title}
                  </h3>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <select
                    value={inv.status}
                    onChange={(e) =>
                      updateStatusMutation.mutate({
                        id: inv.id,
                        status: e.target.value as InvestigationStatus,
                      })
                    }
                    className="bg-soc-base border border-soc-border rounded px-2.5 py-1 text-xs font-mono text-slate-300 focus:outline-none"
                  >
                    <option value="open">OPEN</option>
                    <option value="in_progress">IN PROGRESS</option>
                    <option value="resolved">RESOLVED</option>
                    <option value="closed">CLOSED</option>
                  </select>

                  <button
                    onClick={() => setSelectedInvestigation(inv)}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-mono text-soc-accent hover:text-soc-accentHover bg-soc-accent/10 border border-soc-accent/30 rounded-lg hover:bg-soc-accent/20 transition-all"
                  >
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {inv.description && (
                <p className="text-xs text-slate-400 leading-relaxed font-sans line-clamp-2">
                  {inv.description}
                </p>
              )}

              {/* Associated Indicators */}
              {inv.indicators && inv.indicators.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-mono text-slate-500 uppercase">Attached IOCs:</span>
                  {inv.indicators.map((ind) => (
                    <span
                      key={ind.id}
                      className="px-2 py-0.5 rounded bg-soc-base border border-soc-borderSubtle text-[11px] font-mono text-slate-300 flex items-center gap-1.5"
                    >
                      <span className="text-soc-accent">{ind.value}</span>
                      <IOCTypePill type={ind.ioc_type} showIcon={false} />
                    </span>
                  ))}
                </div>
              )}

              {/* Card Footer: Assignee & Timestamps */}
              <div className="flex flex-wrap items-center justify-between gap-4 text-[11px] text-slate-500 pt-2 border-t border-soc-borderSubtle font-mono">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Assignee: <strong className="text-slate-300">{inv.assigned_to || 'Unassigned'}</strong></span>
                  </div>
                  <div>•</div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Created: {new Date(inv.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <span className="text-slate-500 text-[10px]">
                  ID: {inv.id.substring(0, 8)}...
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Investigation Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Initialize Security Investigation"
        subtitle="Log an incident case with associated threat telemetry"
        icon={Briefcase}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block uppercase text-slate-400 mb-1 font-semibold">
              Investigation Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Incident #1042: C2 Beaconing via Port 443"
              className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block uppercase text-slate-400 mb-1 font-semibold">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as InvestigationPriority)}
                className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block uppercase text-slate-400 mb-1 font-semibold">
                Assigned Operator / Team
              </label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="e.g. SOC Tier 2 / lead_analyst"
                className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block uppercase text-slate-400 mb-1 font-semibold">
              Incident Summary & Narrative
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail observed anomalies, threat scope, and triage findings..."
              className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-lg px-3.5 py-2 text-xs font-sans text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block uppercase text-slate-400 mb-1 font-semibold">
              Associated IOCs (One observable per line)
            </label>
            <textarea
              rows={3}
              value={indicatorsRaw}
              onChange={(e) => setIndicatorsRaw(e.target.value)}
              placeholder="198.51.100.24&#10;https://suspicious-payload.org&#10;CVE-2024-38077"
              className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-soc-border">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !title.trim()}
              className="px-5 py-2 bg-soc-accent hover:bg-soc-accentHover disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-soc-subtle transition-all"
            >
              {createMutation.isPending ? 'Logging case...' : 'Initialize Case'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Investigation Details Modal */}
      <InvestigationDetailModal
        investigation={selectedInvestigation}
        isOpen={!!selectedInvestigation}
        onClose={() => setSelectedInvestigation(null)}
        onUpdated={refetch}
      />
    </div>
  );
};
