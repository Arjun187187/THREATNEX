import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  CheckCircle2,
  ArrowRight,
  Database,
  PlusCircle,
  Copy,
  Check,
  Download,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Layers,
  Clock,
  Info,
} from 'lucide-react';
import { apiClient } from '../api/client';
import {
  IOCEnrichmentResponse,
  Indicator,
  IOCType,
  IOCSeverity,
  IOCInvestigationHistoryItem,
} from '../types';
import { IOCTypePill, SeverityBadge, ConfidenceScore } from '../components/common/Badges';
import { EmptyState } from '../components/common/EmptyState';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ToastContainer, ToastMessage } from '../components/common/Toast';
import { formatApiError } from '../utils/errors';

const EXAMPLE_IOCS = [
  { label: 'Malicious Domain', val: 'malware.com' },
  { label: 'Suspicious IP', val: '198.51.100.24' },
  { label: 'Clean DNS', val: '8.8.8.8' },
  { label: 'Malware URL', val: 'https://cdn-update-payload.net/bin/agent.exe' },
  { label: 'LockBit Hash', val: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { label: 'Citrix CVE', val: 'CVE-2023-4966' },
];

export const IOCInvestigation: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [iocInput, setIocInput] = useState(initialQ);
  const [autoSave, setAutoSave] = useState(true);

  // Investigation Result State
  const [enrichment, setEnrichment] = useState<IOCEnrichmentResponse | null>(null);

  // Active view tabs: 'investigate' | 'catalog' | 'history'
  const [activeTab, setActiveTab] = useState<'investigate' | 'catalog' | 'history'>('investigate');

  // Filter and search states for recorded inventory
  const [tableSearch, setTableSearch] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const queryClient = useQueryClient();

  // Investigation Mutation (Calls VirusTotal, AbuseIPDB, AlienVault OTX, URLhaus)
  const investigateMutation = useMutation({
    mutationFn: async ({ value, save }: { value: string; save: boolean }) => {
      const res = await apiClient.post<IOCEnrichmentResponse>('/indicators/investigate', {
        value: value.trim(),
        save_to_inventory: save,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setEnrichment(data);
      queryClient.invalidateQueries({ queryKey: ['ioc-search-results'] });
      queryClient.invalidateQueries({ queryKey: ['ioc-history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      const verdictTitle =
        data.overall_verdict === 'malicious'
          ? 'Threat Detected'
          : data.overall_verdict === 'suspicious'
          ? 'Suspicious Indicator'
          : 'Investigation Complete';

      addToast(
        data.overall_verdict === 'malicious' ? 'error' : data.overall_verdict === 'suspicious' ? 'warning' : 'success',
        verdictTitle,
        `${data.normalized_value} (${data.ioc_type.toUpperCase()}) - ${data.total_detections} total detections`
      );
    },
    onError: (err: any) => {
      addToast('error', 'Investigation Failed', formatApiError(err, 'Unable to query intelligence providers.'));
    },
  });

  // Manual Save to Inventory Mutation
  const saveMutation = useMutation({
    mutationFn: async (data: {
      value: string;
      ioc_type?: IOCType;
      severity?: IOCSeverity;
      confidence?: number;
      description?: string;
      tags?: string;
    }) => {
      const res = await apiClient.post('/indicators/', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ioc-search-results'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      if (enrichment) {
        setEnrichment({ ...enrichment, saved_in_inventory: true });
      }
      addToast('success', 'Inventory Updated', 'Indicator successfully saved to SOC threat inventory.');
    },
    onError: (err: any) => {
      addToast('error', 'Save Failed', formatApiError(err, 'Unable to save indicator.'));
    },
  });

  // Query recorded indicators from database
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<Indicator[]>({
    queryKey: ['ioc-search-results', tableSearch],
    queryFn: async () => {
      try {
        const query = tableSearch.trim();
        const res = await apiClient.get<Indicator[]>(`/indicators/search?q=${encodeURIComponent(query)}&limit=100`);
        return res.data;
      } catch {
        return [];
      }
    },
  });

  // Query previous investigations history
  const { data: investigationHistory, isLoading: isHistoryLoading } = useQuery<IOCInvestigationHistoryItem[]>({
    queryKey: ['ioc-history'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<IOCInvestigationHistoryItem[]>('/indicators/investigations/history?limit=30');
        return res.data;
      } catch {
        return [];
      }
    },
  });

  useEffect(() => {
    if (initialQ) {
      investigateMutation.mutate({ value: initialQ, save: autoSave });
    }
  }, [initialQ]);

  const handleInvestigateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (iocInput.trim()) {
      setSearchParams({ q: iocInput.trim() });
      investigateMutation.mutate({ value: iocInput.trim(), save: autoSave });
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    addToast('info', 'Copied to Clipboard', text);
  };

  const handleManualSave = () => {
    if (enrichment) {
      saveMutation.mutate({
        value: enrichment.normalized_value,
        ioc_type: enrichment.ioc_type,
        severity: enrichment.calculated_severity,
        confidence: enrichment.overall_confidence,
        description: enrichment.summary,
        tags: enrichment.tags.join(','),
      });
    }
  };

  // Filtered indicators based on table filters
  const filteredIndicators = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.filter((ind) => {
      const matchesType =
        selectedTypeFilter === 'all' || ind.ioc_type.toLowerCase() === selectedTypeFilter.toLowerCase();
      const matchesSeverity =
        selectedSeverityFilter === 'all' || ind.severity.toLowerCase() === selectedSeverityFilter.toLowerCase();
      return matchesType && matchesSeverity;
    });
  }, [searchResults, selectedTypeFilter, selectedSeverityFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredIndicators.length / itemsPerPage) || 1;
  const paginatedIndicators = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredIndicators.slice(start, start + itemsPerPage);
  }, [filteredIndicators, currentPage]);

  // Export to JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredIndicators, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `threatnex_ioc_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast('success', 'Export Complete', `${filteredIndicators.length} indicators exported to JSON.`);
  };

  const getProviderStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/80';
      case 'clean':
      case 'not_found':
        return 'text-sky-400 bg-sky-950/40 border-sky-800/80';
      case 'unconfigured':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/80';
      case 'unsupported':
        return 'text-slate-500 bg-slate-900 border-slate-800';
      case 'rate_limited':
      case 'timeout':
      case 'error':
      default:
        return 'text-rose-400 bg-rose-950/40 border-rose-800/80';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg lg:text-xl font-bold text-white tracking-wide font-mono flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-soc-accent" />
            <span>IOC INVESTIGATION & THREAT INTELLIGENCE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-source threat intelligence correlation via VirusTotal, AbuseIPDB, AlienVault OTX, and URLhaus.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-soc-surface border border-soc-border rounded-xl">
          <button
            onClick={() => setActiveTab('investigate')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 ${
              activeTab === 'investigate'
                ? 'bg-soc-accent text-white shadow-soc-subtle'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Live Triage</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-soc-accent text-white shadow-soc-subtle'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Investigation Log</span>
            {investigationHistory && investigationHistory.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-200">
                {investigationHistory.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-2 ${
              activeTab === 'catalog'
                ? 'bg-soc-accent text-white shadow-soc-subtle'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Inventory Catalog</span>
            {searchResults && searchResults.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-slate-200">
                {searchResults.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE TRIAGE & INVESTIGATION */}
      {activeTab === 'investigate' && (
        <div className="space-y-6">
          {/* Primary Query Card */}
          <div className="bg-soc-surface border border-soc-border rounded-xl p-5 lg:p-6 shadow-soc-card">
            <form onSubmit={handleInvestigateSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-mono uppercase text-slate-400 font-semibold">
                    Observable / Indicator of Compromise
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                    <Sparkles className="w-3 h-3 text-soc-accent" />
                    <span>Auto-classified across IPv4, IPv6, Domain, URL, Hashes (MD5, SHA1, SHA256), & CVE</span>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={iocInput}
                    onChange={(e) => setIocInput(e.target.value)}
                    placeholder="Enter IP (e.g. 198.51.100.24), domain (e.g. malware.com), file hash, URL, or CVE..."
                    className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-xl pl-10 pr-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Quick Example Chips & Auto-Save Checkbox */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-500 uppercase">Preset Examples:</span>
                  {EXAMPLE_IOCS.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => {
                        setIocInput(ex.val);
                        setSearchParams({ q: ex.val });
                        investigateMutation.mutate({ value: ex.val, save: autoSave });
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-soc-card border border-soc-borderSubtle hover:border-soc-accent text-slate-400 hover:text-white transition-colors"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-400">
                    <input
                      type="checkbox"
                      checked={autoSave}
                      onChange={(e) => setAutoSave(e.target.checked)}
                      className="rounded bg-soc-base border-soc-border text-soc-accent focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Auto-persist to inventory</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={investigateMutation.isPending || !iocInput.trim()}
                  className="px-6 py-2.5 bg-soc-accent hover:bg-soc-accentHover disabled:opacity-50 text-white font-medium text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-soc-subtle transition-all"
                >
                  {investigateMutation.isPending ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                      <span>Querying Providers...</span>
                    </>
                  ) : (
                    <>
                      <span>Execute Threat Investigation</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* INVESTIGATION IN PROGRESS SKELETON */}
          {investigateMutation.isPending && (
            <div className="p-6 bg-soc-surface border border-soc-accent/30 rounded-xl space-y-4 animate-pulse">
              <div className="flex items-center justify-between pb-3 border-b border-soc-border">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full border-2 border-soc-accent border-t-transparent animate-spin"></span>
                  <span className="text-xs font-mono text-slate-200">
                    Interrogating intelligence networks: VirusTotal, AbuseIPDB, AlienVault OTX, URLhaus...
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase text-soc-accent">Live Correlator Active</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['VirusTotal', 'AbuseIPDB', 'AlienVault OTX', 'URLhaus'].map((prov) => (
                  <div key={prov} className="p-4 rounded-lg bg-soc-base border border-soc-border space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300 font-semibold">{prov}</span>
                      <span className="text-[10px] text-amber-400">Querying...</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded overflow-hidden">
                      <div className="h-full bg-soc-accent w-2/3 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INVESTIGATION RESULT REPORT */}
          {enrichment && !investigateMutation.isPending && (
            <div className="space-y-6">
              {/* Executive Summary Card */}
              <div
                className={`p-5 lg:p-6 rounded-xl border shadow-soc-elevated transition-all ${
                  enrichment.overall_verdict === 'malicious'
                    ? 'bg-rose-950/20 border-rose-800/80'
                    : enrichment.overall_verdict === 'suspicious'
                    ? 'bg-amber-950/20 border-amber-800/80'
                    : enrichment.overall_verdict === 'clean'
                    ? 'bg-emerald-950/20 border-emerald-800/80'
                    : 'bg-soc-surface border-soc-border'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  {/* Left Column: Indicator & Verdict */}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        Evaluated Target Observable
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(enrichment.queried_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-base lg:text-lg font-bold font-mono text-white break-all">
                        {enrichment.normalized_value}
                      </h2>
                      <button
                        onClick={() => handleCopy(enrichment.normalized_value, 'norm-ioc')}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        title="Copy indicator value"
                      >
                        {copiedId === 'norm-ioc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <IOCTypePill type={enrichment.ioc_type} />
                      <SeverityBadge severity={enrichment.calculated_severity} size="md" />
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider border ${
                          enrichment.overall_verdict === 'malicious'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                            : enrichment.overall_verdict === 'suspicious'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                            : enrichment.overall_verdict === 'clean'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {enrichment.overall_verdict === 'malicious' ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        ) : enrichment.overall_verdict === 'clean' ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>{enrichment.overall_verdict}</span>
                      </span>
                    </div>

                    {/* Summary Paragraph */}
                    <p className="text-xs font-sans text-slate-300 leading-relaxed pt-2 max-w-4xl">
                      {enrichment.summary}
                    </p>

                    {/* Threat Tags */}
                    {enrichment.tags && enrichment.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2">
                        <span className="text-[10px] font-mono uppercase text-slate-500 mr-1">Attributed Tags:</span>
                        {enrichment.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-soc-base border border-soc-borderSubtle text-slate-300"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Gauges & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-4 shrink-0 border-t lg:border-t-0 lg:border-l border-soc-border/60 pt-4 lg:pt-0 lg:pl-6">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">Detections</div>
                        <div
                          className={`text-xl font-bold font-mono ${
                            enrichment.total_detections > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {enrichment.total_detections}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">Confidence</div>
                        <ConfidenceScore score={enrichment.overall_confidence} />
                      </div>
                    </div>

                    {/* Save or Persisted Status */}
                    <div className="pt-2">
                      {enrichment.saved_in_inventory ? (
                        <div className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Cataloged in Threat Inventory</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleManualSave}
                          disabled={saveMutation.isPending}
                          className="px-4 py-2 rounded-lg bg-soc-accent hover:bg-soc-accentHover text-white text-xs font-mono font-medium shadow-soc-subtle flex items-center gap-2 transition-all"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>Persist to Inventory</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Provider Intelligence Matrix (4 Providers) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-soc-accent" />
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                      Multi-Source Threat Intelligence Telemetry
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {enrichment.providers.filter((p) => p.supported).length} of 4 Engines Supported
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {enrichment.providers.map((p) => (
                    <div
                      key={p.provider}
                      className="bg-soc-surface border border-soc-border rounded-xl p-4 shadow-soc-card space-y-3 transition-all hover:border-slate-700"
                    >
                      {/* Provider Header */}
                      <div className="flex items-center justify-between gap-2 border-b border-soc-border pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-soc-accent"></div>
                          <span className="text-xs font-bold font-mono text-white">{p.provider}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getProviderStatusColor(
                            p.status
                          )}`}
                        >
                          {p.status}
                        </span>
                      </div>

                      {/* Provider Attribution */}
                      <div className="text-[10px] font-mono text-slate-500 truncate">{p.attribution}</div>

                      {/* Telemetry Breakdown (if success or detected) */}
                      {p.status === 'success' && (
                        <div className="grid grid-cols-4 gap-2 text-center p-2 rounded-lg bg-soc-base border border-soc-borderSubtle font-mono text-xs">
                          <div>
                            <div className="text-[9px] uppercase text-rose-400 font-semibold">Malicious</div>
                            <div className="text-xs font-bold text-slate-200">{p.malicious}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-amber-400 font-semibold">Suspicious</div>
                            <div className="text-xs font-bold text-slate-200">{p.suspicious}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-emerald-400 font-semibold">Harmless</div>
                            <div className="text-xs font-bold text-slate-200">{p.harmless}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-slate-400 font-semibold">Undetected</div>
                            <div className="text-xs font-bold text-slate-200">{p.undetected}</div>
                          </div>
                        </div>
                      )}

                      {/* Findings Message */}
                      {p.message && (
                        <div className="text-xs text-slate-300 font-sans leading-relaxed">{p.message}</div>
                      )}

                      {/* Specific Evidence Drawer */}
                      {p.evidence && Object.keys(p.evidence).length > 0 && (
                        <div className="p-2.5 rounded bg-soc-card border border-soc-borderSubtle space-y-1.5 text-[11px] font-mono">
                          {p.evidence.top_pulses && p.evidence.top_pulses.length > 0 && (
                            <div>
                              <span className="text-slate-500 uppercase text-[10px] block">Top Threat Pulses:</span>
                              <ul className="list-disc list-inside text-slate-300 text-[10px] space-y-0.5 mt-1">
                                {p.evidence.top_pulses.map((pulse: string, idx: number) => (
                                  <li key={idx} className="truncate">{pulse}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {p.evidence.malware_families && p.evidence.malware_families.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-500 uppercase text-[10px]">Malware:</span>
                              {p.evidence.malware_families.map((m: string) => (
                                <span key={m} className="px-1.5 py-0.2 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-[10px]">
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}
                          {p.evidence.adversaries && p.evidence.adversaries.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-500 uppercase text-[10px]">Adversary:</span>
                              {p.evidence.adversaries.map((a: string) => (
                                <span key={a} className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800 text-amber-300 text-[10px]">
                                  {a}
                                </span>
                              ))}
                            </div>
                          )}
                          {p.evidence.isp && (
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500">ISP / Organization:</span>
                              <span className="text-slate-300 truncate max-w-[200px]">{p.evidence.isp}</span>
                            </div>
                          )}
                          {p.evidence.countryCode && (
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500">Geographic Origin:</span>
                              <span className="text-slate-300">{p.evidence.countryCode}</span>
                            </div>
                          )}
                          {p.evidence.asn && (
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500">Autonomous System:</span>
                              <span className="text-slate-300 truncate max-w-[200px]">{p.evidence.asn}</span>
                            </div>
                          )}
                          {p.evidence.epss && (
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500">EPSS Exploit Score:</span>
                              <span className="text-rose-400 font-bold">{(p.evidence.epss * 100).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Unconfigured / Unsupported Notices */}
                      {p.status === 'unconfigured' && (
                        <div className="p-2.5 rounded bg-amber-950/20 border border-amber-800/60 text-[11px] font-mono text-amber-300 flex items-start gap-2">
                          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                          <span>To query {p.provider}, set its API key in the backend environment.</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVESTIGATION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-soc-surface border border-soc-border rounded-xl p-5 lg:p-6 shadow-soc-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-soc-border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-soc-accent" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Recent Triage & Correlation History
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {investigationHistory?.length || 0} recorded investigations
            </span>
          </div>

          {isHistoryLoading ? (
            <TableSkeleton rows={5} />
          ) : !investigationHistory || investigationHistory.length === 0 ? (
            <EmptyState
              title="No Prior Investigations"
              description="Execute an IOC investigation above to record intelligence findings and provider correlations."
              action={{
                label: 'Investigate an Indicator',
                onClick: () => setActiveTab('investigate'),
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-soc-border text-[11px] uppercase text-slate-500 bg-soc-base/50">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Observable</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Verdict</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Detections</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-soc-borderSubtle">
                  {investigationHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-soc-card/30 transition-colors">
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-100 max-w-xs truncate">
                        {item.indicator_value}
                      </td>
                      <td className="py-3 px-3">
                        <IOCTypePill type={item.ioc_type} />
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.verdict === 'malicious'
                              ? 'text-rose-400 bg-rose-950/40 border border-rose-800'
                              : item.verdict === 'suspicious'
                              ? 'text-amber-400 bg-amber-950/40 border border-amber-800'
                              : 'text-emerald-400 bg-emerald-950/40 border border-emerald-800'
                          }`}
                        >
                          {item.verdict}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <SeverityBadge severity={item.severity} />
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-bold">
                        {item.total_detections}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setIocInput(item.indicator_value);
                            setActiveTab('investigate');
                            investigateMutation.mutate({ value: item.indicator_value, save: autoSave });
                          }}
                          className="px-2.5 py-1 rounded bg-soc-accent/10 border border-soc-accent/30 hover:bg-soc-accent/20 text-soc-accent text-[11px] font-mono transition-colors"
                        >
                          Re-Analyze
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: THREAT INVENTORY CATALOG */}
      {activeTab === 'catalog' && (
        <div className="bg-soc-surface border border-soc-border rounded-xl p-5 lg:p-6 shadow-soc-card space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-soc-border">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-soc-accent" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Persistent Threat Indicator Inventory
              </h2>
              <span className="text-[11px] font-mono text-slate-500">
                ({filteredIndicators.length} records)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Filter catalog..."
                  className="bg-soc-base border border-soc-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-soc-accent font-mono w-48"
                />
              </div>

              {/* Type Filter */}
              <select
                value={selectedTypeFilter}
                onChange={(e) => {
                  setSelectedTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-soc-base border border-soc-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
              >
                <option value="all">All IOC Types</option>
                <option value="ipv4">IPv4</option>
                <option value="ipv6">IPv6</option>
                <option value="domain">Domain</option>
                <option value="url">URL</option>
                <option value="md5">MD5</option>
                <option value="sha1">SHA1</option>
                <option value="sha256">SHA256</option>
                <option value="cve">CVE</option>
              </select>

              {/* Severity Filter */}
              <select
                value={selectedSeverityFilter}
                onChange={(e) => {
                  setSelectedSeverityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-soc-base border border-soc-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>

              <button
                onClick={handleExportJSON}
                disabled={filteredIndicators.length === 0}
                className="p-1.5 bg-soc-card hover:bg-slate-800 border border-soc-border rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-40"
                title="Export catalog as JSON"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          {isSearchLoading ? (
            <TableSkeleton rows={6} />
          ) : filteredIndicators.length === 0 ? (
            <EmptyState
              title="No Matching Indicators"
              description="No saved IOCs match the applied filters or search query in the SOC threat database."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-soc-border text-[11px] uppercase text-slate-500 bg-soc-base/50">
                    <th className="py-2.5 px-3">Observable Value</th>
                    <th className="py-2.5 px-3">Format</th>
                    <th className="py-2.5 px-3">Assessed Severity</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Attributed Tags</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-soc-borderSubtle">
                  {paginatedIndicators.map((ind) => (
                    <tr key={ind.id} className="hover:bg-soc-card/30 transition-colors group">
                      <td className="py-3 px-3 font-semibold text-slate-100 max-w-sm truncate">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{ind.value}</span>
                          <button
                            onClick={() => handleCopy(ind.value, ind.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-200 transition-opacity"
                          >
                            {copiedId === ind.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <IOCTypePill type={ind.ioc_type} />
                      </td>
                      <td className="py-3 px-3">
                        <SeverityBadge severity={ind.severity} />
                      </td>
                      <td className="py-3 px-3">
                        <ConfidenceScore score={ind.confidence} />
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-400 max-w-xs truncate">
                        {ind.tags ? ind.tags.split(',').slice(0, 3).join(', ') : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {new Date(ind.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setIocInput(ind.value);
                            setActiveTab('investigate');
                            investigateMutation.mutate({ value: ind.value, save: autoSave });
                          }}
                          className="px-2.5 py-1 rounded bg-soc-accent/10 border border-soc-accent/30 hover:bg-soc-accent/20 text-soc-accent text-[11px] font-mono transition-colors"
                        >
                          Triage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-soc-border text-xs font-mono text-slate-400">
                  <div>
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded bg-soc-card border border-soc-border hover:bg-slate-800 disabled:opacity-40 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded bg-soc-card border border-soc-border hover:bg-slate-800 disabled:opacity-40 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
