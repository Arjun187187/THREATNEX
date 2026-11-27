import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  UserCheck,
  Clock,
  Copy,
  Check,
  FileText,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Investigation, InvestigationPriority, InvestigationStatus } from '../../types';
import { IOCTypePill, SeverityBadge } from './Badges';
import { Modal } from './Modal';

interface InvestigationDetailModalProps {
  investigation: Investigation | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const InvestigationDetailModal: React.FC<InvestigationDetailModalProps> = ({
  investigation,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [copied, setCopied] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Status/Priority update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: { status?: InvestigationStatus; priority?: InvestigationPriority }) => {
      if (!investigation) return;
      const res = await apiClient.patch(`/investigations/${investigation.id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investigations-list'] });
      queryClient.invalidateQueries({ queryKey: ['recent-investigations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      if (onUpdated) onUpdated();
    },
  });

  if (!investigation) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(investigation.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStatusChange = async (newStatus: InvestigationStatus) => {
    setUpdatingStatus(true);
    try {
      await updateMutation.mutateAsync({ status: newStatus });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: InvestigationPriority) => {
    await updateMutation.mutateAsync({ priority: newPriority });
  };

  const handleInspectIOC = (iocValue: string) => {
    onClose();
    navigate(`/ioc-search?q=${encodeURIComponent(iocValue)}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Investigation Case Details"
      subtitle={`ID: ${investigation.id}`}
      icon={Briefcase}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono text-[11px]">Triage Actions:</span>
            {investigation.status !== 'in_progress' && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={updateMutation.isPending}
                className="px-2.5 py-1 text-[11px] font-mono font-medium rounded bg-sky-950/60 text-sky-400 border border-sky-800 hover:bg-sky-900/50 transition-colors"
              >
                Start Investigation
              </button>
            )}
            {investigation.status !== 'resolved' && (
              <button
                onClick={() => handleStatusChange('resolved')}
                disabled={updateMutation.isPending}
                className="px-2.5 py-1 text-[11px] font-mono font-medium rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/50 transition-colors"
              >
                Mark Resolved
              </button>
            )}
            {investigation.status !== 'closed' && (
              <button
                onClick={() => handleStatusChange('closed')}
                disabled={updateMutation.isPending}
                className="px-2.5 py-1 text-[11px] font-mono font-medium rounded bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800 transition-colors"
              >
                Close Case
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Title and Controls Card */}
        <div className="bg-soc-base p-4 rounded-xl border border-soc-borderSubtle space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-bold text-white tracking-wide">{investigation.title}</h3>
            <button
              onClick={handleCopyId}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded bg-soc-surface border border-soc-border hover:border-soc-borderLight text-slate-400 hover:text-slate-200 transition-colors shrink-0"
              title="Copy UUID"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy ID'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 uppercase text-[10px]">Status:</span>
              <select
                value={investigation.status}
                onChange={(e) => handleStatusChange(e.target.value as InvestigationStatus)}
                disabled={updatingStatus}
                className="bg-soc-surface border border-soc-border rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
              >
                <option value="open">OPEN</option>
                <option value="in_progress">IN PROGRESS</option>
                <option value="resolved">RESOLVED</option>
                <option value="closed">CLOSED</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 uppercase text-[10px]">Priority:</span>
              <select
                value={investigation.priority}
                onChange={(e) => handlePriorityChange(e.target.value as InvestigationPriority)}
                className="bg-soc-surface border border-soc-border rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
              >
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
                <option value="critical">CRITICAL</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Assignee: <strong className="text-slate-200">{investigation.assigned_to || 'Unassigned'}</strong></span>
            </div>
          </div>
        </div>

        {/* Narrative & Summary */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-slate-400 font-semibold">
            <FileText className="w-3.5 h-3.5 text-soc-accent" />
            <span>Incident Narrative & Evidence Summary</span>
          </div>
          <div className="p-3.5 rounded-xl bg-soc-base border border-soc-borderSubtle text-xs text-slate-300 leading-relaxed font-sans">
            {investigation.description || 'No detailed narrative provided for this case. Add incident observables or IOC correlations.'}
          </div>
        </div>

        {/* Associated Indicators of Compromise */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono uppercase text-slate-400 font-semibold">
              <Layers className="w-3.5 h-3.5 text-soc-accent" />
              <span>Associated Indicators ({investigation.indicators?.length || 0})</span>
            </div>
          </div>

          {!investigation.indicators || investigation.indicators.length === 0 ? (
            <div className="p-4 rounded-xl bg-soc-base border border-dashed border-soc-borderSubtle text-center text-xs text-slate-500">
              No IOCs attached to this investigation yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {investigation.indicators.map((ind) => (
                <div
                  key={ind.id}
                  className="p-3 rounded-lg bg-soc-base border border-soc-borderSubtle hover:border-soc-border flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <IOCTypePill type={ind.ioc_type} />
                    <span className="font-mono text-slate-200 font-semibold">{ind.value}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <SeverityBadge severity={ind.severity} />
                    <button
                      onClick={() => handleInspectIOC(ind.value)}
                      className="flex items-center gap-1 text-[11px] text-soc-accent hover:text-soc-accentHover font-mono"
                      title="Inspect IOC in analysis console"
                    >
                      <span>Analyze</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Investigation Audit Timeline */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-slate-400 font-semibold">
            <Clock className="w-3.5 h-3.5 text-soc-accent" />
            <span>Investigation Audit Trail</span>
          </div>

          <div className="p-3.5 rounded-xl bg-soc-base border border-soc-borderSubtle space-y-3 font-mono text-[11px]">
            <div className="flex items-start gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
              <div className="flex-1">
                <div className="text-slate-300 font-medium">Case Initialized in SOC Database</div>
                <div className="text-slate-500 text-[10px]">{new Date(investigation.created_at).toLocaleString()}</div>
              </div>
            </div>

            {investigation.assigned_to && (
              <div className="flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full bg-sky-400 mt-1 shrink-0" />
                <div className="flex-1">
                  <div className="text-slate-300 font-medium">Assigned to {investigation.assigned_to}</div>
                  <div className="text-slate-500 text-[10px]">Active Tier Routing</div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2.5">
              <div className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0" />
              <div className="flex-1">
                <div className="text-slate-300 font-medium">Last State Modification</div>
                <div className="text-slate-500 text-[10px]">{new Date(investigation.updated_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
