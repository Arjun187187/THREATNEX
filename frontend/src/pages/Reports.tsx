import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Trash2,
  Search,
  Download,
  Copy,
  Check,
  Eye,
  X,
  Sparkles,
  Calendar,
  RefreshCw,
  FileCode,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { ThreatReport, ReportListResponse } from '../types';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ToastContainer, ToastMessage } from '../components/common/Toast';
import { formatApiError } from '../utils/errors';

export const Reports: React.FC = () => {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form states for report generation
  const [reportTitle, setReportTitle] = useState('');
  const [reportType, setReportType] = useState('incident_case');
  const [referenceType, setReferenceType] = useState<'case' | 'investigation' | 'indicator'>('indicator');
  const [referenceValue, setReferenceValue] = useState('');
  const [includeAiSynthesis, setIncludeAiSynthesis] = useState(true);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // 1. Fetch reports list
  const { data: reportsData, isLoading, isFetching, refetch } = useQuery<ReportListResponse>({
    queryKey: ['threat-reports', page, pageSize],
    queryFn: async () => {
      const res = await apiClient.get<ReportListResponse>('/reports/', {
        params: { page, page_size: pageSize },
      });
      return res.data;
    },
  });

  // 2. Fetch single report detail when selected
  const { data: activeReport, isLoading: isReportLoading } = useQuery<ThreatReport>({
    queryKey: ['threat-report-detail', selectedReportId],
    queryFn: async () => {
      if (!selectedReportId) return null as any;
      const res = await apiClient.get<ThreatReport>(`/reports/${selectedReportId}`);
      return res.data;
    },
    enabled: !!selectedReportId,
  });

  // 3. Generate report mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        title: reportTitle.trim() || undefined,
        report_type: reportType,
        include_ai_synthesis: includeAiSynthesis,
      };

      if (referenceValue.trim()) {
        if (referenceType === 'case') {
          payload.case_id = referenceValue.trim();
        } else if (referenceType === 'investigation') {
          payload.investigation_id = referenceValue.trim();
        } else {
          payload.indicator_value = referenceValue.trim();
        }
      }

      const res = await apiClient.post<ThreatReport>('/reports/generate', payload);
      return res.data;
    },
    onSuccess: (newReport) => {
      queryClient.invalidateQueries({ queryKey: ['threat-reports'] });
      setShowGenerateModal(false);
      setReportTitle('');
      setReferenceValue('');
      setSelectedReportId(newReport.id);
      addToast('success', 'Report Generated', `Generated "${newReport.title}"`);
    },
    onError: (err) => {
      addToast('error', 'Generation Failed', formatApiError(err));
    },
  });

  // 4. Delete report mutation
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await apiClient.delete(`/reports/${reportId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threat-reports'] });
      if (selectedReportId) setSelectedReportId(null);
      addToast('success', 'Report Deleted', 'Report record removed successfully.');
    },
    onError: (err) => {
      addToast('error', 'Delete Failed', formatApiError(err));
    },
  });

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    addToast('info', 'Copied to Clipboard');
  };

  // Download markdown helper
  const downloadMarkdown = (report: ThreatReport) => {
    const blob = new Blob([report.content_markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = report.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `${safeTitle}_${report.id.slice(0, 8)}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('success', 'Downloaded Markdown', 'Report exported as markdown file.');
  };

  // Download JSON helper
  const downloadJSON = (report: ThreatReport) => {
    const dataStr = report.content_json || JSON.stringify(report, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = report.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `${safeTitle}_${report.id.slice(0, 8)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('success', 'Downloaded JSON', 'Report exported as JSON file.');
  };

  // Filtered reports
  const filteredReports = (reportsData?.items || []).filter((r) => {
    const matchesSearch =
      !searchQuery ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.reference_title && r.reference_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.executive_summary && r.executive_summary.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || r.report_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getReportTypeBadge = (type: string) => {
    switch (type) {
      case 'incident_case':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-950/60 text-rose-400 border border-rose-800/80">
            Incident Case
          </span>
        );
      case 'ioc_briefing':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-950/60 text-amber-400 border border-amber-800/80">
            IOC Briefing
          </span>
        );
      case 'executive_summary':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-950/60 text-indigo-400 border border-indigo-800/80">
            Executive Summary
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={(id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-soc-card p-6 rounded-xl border border-soc-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest bg-cyan-950/60 text-cyan-400 border border-cyan-800/80">
              Module 12: Threat Reporting Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <FileText className="w-6 h-6 text-soc-accent" />
            Threat Intelligence Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Formal incident post-mortems, indicator intelligence briefings, and executive threat assessments synthesized from verified multi-source provider telemetry and AI threat analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-2 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh reports"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 bg-soc-accent hover:bg-soc-accentHover text-slate-950 font-bold rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-soc-accent/10 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate New Report
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-soc-surface border border-soc-border rounded-xl p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Reports</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {reportsData?.total ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Stored in persistent archive</div>
        </div>
        <div className="bg-soc-surface border border-soc-border rounded-xl p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Incident Case Reports</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
            {(reportsData?.items || []).filter((r) => r.report_type === 'incident_case').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Formal SOC escalations</div>
        </div>
        <div className="bg-soc-surface border border-soc-border rounded-xl p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400">IOC Intelligence Briefs</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {(reportsData?.items || []).filter((r) => r.report_type === 'ioc_briefing').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Multi-provider correlation summaries</div>
        </div>
        <div className="bg-soc-surface border border-soc-border rounded-xl p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Executive Briefings</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
            {(reportsData?.items || []).filter((r) => r.report_type === 'executive_summary').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">C-suite & leadership digests</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-soc-card p-4 rounded-xl border border-soc-border flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search reports by title or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-soc-accent font-mono"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Filter Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-soc-accent font-mono"
            >
              <option value="all">All Types</option>
              <option value="incident_case">Incident Case</option>
              <option value="ioc_briefing">IOC Briefing</option>
              <option value="executive_summary">Executive Summary</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-soc-surface border border-soc-border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={5} />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No Threat Reports Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Generate a formal incident case post-mortem or IOC intelligence briefing using the button above.
            </p>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="mt-4 px-4 py-2 bg-soc-accent/20 border border-soc-accent/40 hover:bg-soc-accent/30 text-soc-accent font-mono text-xs rounded-lg transition-colors"
            >
              + Generate First Report
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-soc-border bg-slate-900/60 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Report Title & Type</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Executive Summary</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soc-border/50 text-xs">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-900/40 transition-colors group cursor-pointer"
                    onClick={() => setSelectedReportId(report.id)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white group-hover:text-soc-accent transition-colors">
                        {report.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {getReportTypeBadge(report.report_type)}
                        <span className="font-mono text-[10px] text-slate-500">ID: {report.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {report.reference_title ? (
                        <div className="font-mono text-xs text-slate-300 max-w-xs truncate" title={report.reference_title}>
                          {report.reference_title}
                        </div>
                      ) : report.reference_id ? (
                        <div className="font-mono text-[11px] text-slate-400">{report.reference_id.slice(0, 16)}</div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {report.executive_summary}
                      </p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(report.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedReportId(report.id)}
                          className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-soc-accent transition-colors"
                          title="Preview Report"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(report.id)}
                          className="p-1.5 rounded bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete Report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {reportsData && reportsData.total_pages > 1 && (
          <div className="p-4 border-t border-soc-border bg-slate-900/40 flex items-center justify-between text-xs font-mono text-slate-400">
            <div>
              Showing page {reportsData.page} of {reportsData.total_pages} ({reportsData.total} total reports)
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
                onClick={() => setPage((p) => Math.min(p + 1, reportsData.total_pages))}
                disabled={page >= reportsData.total_pages}
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded text-slate-300 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Preview Modal / Drawer */}
      {selectedReportId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-soc-surface border border-soc-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-soc-border bg-slate-900/60 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {activeReport && getReportTypeBadge(activeReport.report_type)}
                  <span className="text-xs font-mono text-slate-400">
                    ID: {activeReport?.id}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {activeReport ? activeReport.title : 'Loading Report...'}
                </h2>
                {activeReport?.reference_title && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Target Reference: <span className="font-mono text-cyan-400">{activeReport.reference_title}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeReport && (
                  <>
                    <button
                      onClick={() => handleCopy(activeReport.content_markdown, 'markdown')}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedKey === 'markdown' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy MD
                    </button>
                    <button
                      onClick={() => downloadMarkdown(activeReport)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export .MD
                    </button>
                    <button
                      onClick={() => downloadJSON(activeReport)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      JSON
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedReportId(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Markdown Content */}
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs leading-relaxed text-slate-300 bg-slate-950/70 select-text">
              {isReportLoading ? (
                <div className="space-y-4">
                  <div className="h-6 bg-slate-800 rounded w-1/3 animate-pulse" />
                  <div className="h-4 bg-slate-800 rounded w-full animate-pulse" />
                  <div className="h-4 bg-slate-800 rounded w-5/6 animate-pulse" />
                  <div className="h-32 bg-slate-800 rounded w-full animate-pulse" />
                </div>
              ) : activeReport ? (
                <div className="whitespace-pre-wrap font-mono space-y-4">
                  {/* Executive Summary Card */}
                  <div className="p-4 bg-cyan-950/30 border border-cyan-800/50 rounded-xl mb-6">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Executive Threat Digest
                    </div>
                    <div className="text-slate-200 text-xs font-sans leading-relaxed">
                      {activeReport.executive_summary}
                    </div>
                  </div>

                  {/* Markdown Body */}
                  <div className="bg-slate-900/50 p-6 rounded-xl border border-soc-border text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                    {activeReport.content_markdown}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-center py-12">Failed to load report contents.</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-soc-border bg-slate-900/60 flex items-center justify-between text-xs font-mono text-slate-400">
              <div>
                Created: {activeReport && new Date(activeReport.created_at).toLocaleString()}
              </div>
              <button
                onClick={() => setSelectedReportId(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate New Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-soc-surface border border-soc-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-soc-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-soc-accent" />
                <h3 className="text-base font-bold text-white">Generate Threat Report</h3>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1.5">REPORT TITLE (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="e.g. Incident Post-Mortem: LockBit Ransomware Ingress"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-soc-accent"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">REPORT TYPE</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-soc-accent font-mono"
                >
                  <option value="incident_case">Incident Case Post-Mortem</option>
                  <option value="ioc_briefing">IOC Threat Intelligence Briefing</option>
                  <option value="executive_summary">Executive Threat Summary</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">REFERENCE SOURCE</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setReferenceType('indicator')}
                    className={`py-1.5 text-center rounded border transition-colors ${
                      referenceType === 'indicator'
                        ? 'bg-soc-accent/20 border-soc-accent text-soc-accent font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    IOC Value
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferenceType('investigation')}
                    className={`py-1.5 text-center rounded border transition-colors ${
                      referenceType === 'investigation'
                        ? 'bg-soc-accent/20 border-soc-accent text-soc-accent font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    Investigation ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferenceType('case')}
                    className={`py-1.5 text-center rounded border transition-colors ${
                      referenceType === 'case'
                        ? 'bg-soc-accent/20 border-soc-accent text-soc-accent font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    Case ID
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={
                    referenceType === 'indicator'
                      ? 'e.g. 198.51.100.24 or evil-domain.com'
                      : referenceType === 'investigation'
                      ? 'e.g. 8fa19b22-...'
                      : 'e.g. 5dc912a1-...'
                  }
                  value={referenceValue}
                  onChange={(e) => setReferenceValue(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-soc-accent"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeAiSynthesis}
                    onChange={(e) => setIncludeAiSynthesis(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-soc-accent focus:ring-0"
                  />
                  <span>Include AI Threat Synthesis & Confidence Scoring</span>
                </label>
                <p className="text-[11px] text-slate-500 ml-5 mt-0.5">
                  Distinguishes verified multi-provider evidence from probabilistic AI reasoning hypotheses.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-soc-border bg-slate-900/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="px-4 py-2 bg-soc-accent hover:bg-soc-accentHover text-slate-950 font-bold rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
