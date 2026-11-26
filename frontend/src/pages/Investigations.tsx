import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  X,
  UserCheck,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Investigation, InvestigationPriority, InvestigationStatus } from '../types';
import { StatusBadge, PriorityBadge, IOCTypePill } from '../components/common/Badges';
import { EmptyState } from '../components/common/EmptyState';

export const Investigations: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<InvestigationPriority>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [indicatorsRaw, setIndicatorsRaw] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const queryClient = useQueryClient();

  // Fetch investigations
  const { data: investigations, isLoading } = useQuery<Investigation[]>({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investigations-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setIndicatorsRaw('');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const indicator_values = indicatorsRaw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    createMutation.mutate({
      title,
      description,
      priority,
      assigned_to: assignedTo || null,
      indicator_values,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">SOC Case Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track, assign, and triage active security investigations and associated IOCs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#111827] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-200"
            >
              <option value="all" className="bg-slate-900">All Statuses</option>
              <option value="open" className="bg-slate-900">Open</option>
              <option value="in_progress" className="bg-slate-900">In Progress</option>
              <option value="resolved" className="bg-slate-900">Resolved</option>
              <option value="closed" className="bg-slate-900">Closed</option>
            </select>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-lg flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation</span>
          </button>
        </div>
      </div>

      {/* Investigations List */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-lg">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <span className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></span>
          </div>
        ) : !investigations || investigations.length === 0 ? (
          <EmptyState
            title="No investigations found"
            description="No cases match your selected filter. Open a new case to start an investigation."
            action={{
              label: "Open Investigation Case",
              onClick: () => setIsModalOpen(true),
            }}
          />
        ) : (
          <div className="divide-y divide-slate-800">
            {investigations.map((inv) => (
              <div key={inv.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <PriorityBadge priority={inv.priority} />
                    <h3 className="text-base font-bold text-white hover:text-cyan-400 transition-colors">
                      {inv.title}
                    </h3>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>

                {inv.description && (
                  <p className="text-xs text-slate-400 leading-relaxed">{inv.description}</p>
                )}

                {/* Attached Indicators */}
                {inv.indicators && inv.indicators.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-mono text-slate-500 uppercase">Attached IOCs:</span>
                    {inv.indicators.map((ind) => (
                      <span
                        key={ind.id}
                        className="px-2 py-0.5 rounded bg-[#0B0F19] border border-slate-700/80 text-[11px] font-mono text-slate-300 flex items-center gap-1.5"
                      >
                        <span className="text-cyan-400">{ind.value}</span>
                        <IOCTypePill type={ind.ioc_type} />
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 font-mono">
                  <div className="flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Assignee: {inv.assigned_to || 'Unassigned'}</span>
                  </div>
                  <div>•</div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Logged: {new Date(inv.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0D1322] border border-slate-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-bold text-white">Create Security Investigation</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Case Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Incident #1044: Exfiltration via DNS Tunneling"
                  className="w-full bg-[#111827] border border-slate-700 focus:border-cyan-500 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as InvestigationPriority)}
                    className="w-full bg-[#111827] border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Assigned Analyst / Team
                  </label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="e.g. SOC Tier 2"
                    className="w-full bg-[#111827] border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Incident Summary / Narrative
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail observable indicators, initial triage notes, and impact..."
                  className="w-full bg-[#111827] border border-slate-700 focus:border-cyan-500 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Associated IOCs (One per line)
                </label>
                <textarea
                  rows={3}
                  value={indicatorsRaw}
                  onChange={(e) => setIndicatorsRaw(e.target.value)}
                  placeholder="198.51.100.24&#10;https://malicious-c2.net&#10;CVE-2024-38077"
                  className="w-full bg-[#111827] border border-slate-700 focus:border-cyan-500 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-md transition-all"
                >
                  {createMutation.isPending ? 'Logging case...' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
