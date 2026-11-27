import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Database,
  PlusCircle,
  Copy,
  Check,
  Filter,
  Download,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { IOCValidationResult, Indicator, IOCType, IOCSeverity } from '../types';
import { IOCTypePill, SeverityBadge, ConfidenceScore } from '../components/common/Badges';
import { EmptyState } from '../components/common/EmptyState';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ToastContainer, ToastMessage } from '../components/common/Toast';

const EXAMPLE_IOCS = [
  { label: 'IPv4', val: '198.51.100.24' },
  { label: 'Domain', val: 'malicious-c2-gateway.org' },
  { label: 'URL', val: 'https://cdn-update-payload.net/bin/agent.exe' },
  { label: 'SHA-256', val: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { label: 'CVE', val: 'CVE-2024-38077' },
];

export const IOCInvestigation: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [iocInput, setIocInput] = useState(initialQ);
  const [validationResult, setValidationResult] = useState<IOCValidationResult | null>(null);

  // Filter and search states for recorded inventory
  const [tableSearch, setTableSearch] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // New Indicator custom attributes
  const [customSeverity, setCustomSeverity] = useState<IOCSeverity>('medium');
  const customConfidence = 85;
  const customDescription = 'Validated via SOC triage console';
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const queryClient = useQueryClient();

  // Validate IOC mutation
  const validateMutation = useMutation({
    mutationFn: async (val: string) => {
      const res = await apiClient.post<IOCValidationResult>('/indicators/validate', {
        value: val.trim(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      if (data.is_valid) {
        addToast('success', 'IOC Validated', `Identified format: ${data.ioc_type?.toUpperCase()}`);
      } else {
        addToast('warning', 'Validation Warning', data.message);
      }
    },
    onError: (err: any) => {
      addToast('error', 'Validation Error', err.response?.data?.detail || 'Validation request failed.');
    },
  });

  // Save IOC mutation
  const saveMutation = useMutation({
    mutationFn: async (data: {
      value: string;
      ioc_type?: IOCType;
      severity?: IOCSeverity;
      confidence?: number;
      description?: string;
    }) => {
      const res = await apiClient.post('/indicators/', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ioc-search-results'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      addToast('success', 'Inventory Updated', 'Indicator successfully saved to SOC database.');
    },
    onError: (err: any) => {
      addToast('error', 'Save Failed', err.response?.data?.detail || 'Unable to save indicator.');
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

  useEffect(() => {
    if (initialQ) {
      validateMutation.mutate(initialQ);
    }
  }, [initialQ]);

  const handleInspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (iocInput.trim()) {
      setSearchParams({ q: iocInput.trim() });
      validateMutation.mutate(iocInput.trim());
    }
  };

  const handleSaveToInventory = async () => {
    if (validationResult && validationResult.is_valid) {
      await saveMutation.mutateAsync({
        value: validationResult.value,
        ioc_type: validationResult.ioc_type || undefined,
        severity: customSeverity,
        confidence: customConfidence,
        description: customDescription,
      });
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    addToast('info', 'Copied to Clipboard', text);
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

  return (
    <div className="space-y-6">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg lg:text-xl font-bold text-white tracking-wide">
            IOC Validation & Threat Inventory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Parse, validate, classify syntax, and catalog threat indicators across IPv4, IPv6, Domains, URLs, Hashes (MD5, SHA1, SHA256), and CVEs.
          </p>
        </div>
      </div>

      {/* Primary Validation Card */}
      <div className="bg-soc-surface border border-soc-border rounded-xl p-5 lg:p-6 shadow-soc-card">
        <form onSubmit={handleInspect} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-mono uppercase text-slate-400 font-semibold">
                Indicator of Compromise (Raw Input)
              </label>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                <Sparkles className="w-3 h-3 text-soc-accent" />
                <span>Auto-detection enabled</span>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={iocInput}
                onChange={(e) => setIocInput(e.target.value)}
                placeholder="e.g. 198.51.100.24, CVE-2024-38077, or e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-xl pl-10 pr-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {/* Quick Example Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-mono text-slate-500 uppercase">Test Examples:</span>
            {EXAMPLE_IOCS.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => {
                  setIocInput(ex.val);
                  validateMutation.mutate(ex.val);
                }}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-soc-card border border-soc-borderSubtle hover:border-soc-border text-slate-400 hover:text-slate-200 transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={validateMutation.isPending || !iocInput.trim()}
              className="px-5 py-2.5 bg-soc-accent hover:bg-soc-accentHover disabled:opacity-50 text-white font-medium text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-soc-subtle transition-all"
            >
              {validateMutation.isPending ? (
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>Validate Pattern</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Validation Inspection Results Box */}
        {validationResult && (
          <div className="mt-6 pt-6 border-t border-soc-border">
            <div
              className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all ${
                validationResult.is_valid
                  ? 'bg-emerald-950/20 border-emerald-800/80'
                  : 'bg-rose-950/20 border-rose-800/80'
              }`}
            >
              <div className="flex items-start gap-3">
                {validationResult.is_valid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5">
                  <div className="text-sm font-semibold text-slate-100 font-mono break-all">
                    {validationResult.value}
                  </div>
                  <div className="text-xs text-slate-300">{validationResult.message}</div>
                  {validationResult.ioc_type && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] font-mono text-slate-400 uppercase">Confirmed Format:</span>
                      <IOCTypePill type={validationResult.ioc_type} />
                      <span className="text-[11px] font-mono text-emerald-400 font-medium">Syntax Conforms to RFC</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Save to Inventory Configuration */}
              {validationResult.is_valid && (
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0 pt-2 md:pt-0">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-slate-400">Severity:</span>
                    <select
                      value={customSeverity}
                      onChange={(e) => setCustomSeverity(e.target.value as IOCSeverity)}
                      className="bg-soc-surface border border-soc-border rounded px-2 py-1 text-slate-200 focus:outline-none"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="info">Info</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSaveToInventory}
                    disabled={saveMutation.isPending || saveMutation.isSuccess}
                    className="px-4 py-2 bg-soc-accent hover:bg-soc-accentHover disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-soc-subtle flex items-center gap-2 transition-all shrink-0"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{saveMutation.isSuccess ? 'Saved in Inventory' : 'Save to Inventory'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Threat Indicator Inventory Catalog */}
      <div className="bg-soc-surface border border-soc-border rounded-xl p-5 lg:p-6 shadow-soc-card space-y-4">
        {/* Catalog Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-soc-border">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-soc-accent" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Recorded Threat Indicators Inventory
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              ({filteredIndicators.length} records)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Table Search */}
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
                className="bg-soc-base border border-soc-border focus:border-soc-accent rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5 bg-soc-base border border-soc-border rounded-lg px-2.5 py-1 text-xs text-slate-400 font-mono">
              <Filter className="w-3 h-3 text-slate-500" />
              <select
                value={selectedTypeFilter}
                onChange={(e) => {
                  setSelectedTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-200 focus:outline-none"
              >
                <option value="all" className="bg-slate-900">All Types</option>
                <option value="ipv4" className="bg-slate-900">IPv4</option>
                <option value="ipv6" className="bg-slate-900">IPv6</option>
                <option value="domain" className="bg-slate-900">Domain</option>
                <option value="url" className="bg-slate-900">URL</option>
                <option value="sha256" className="bg-slate-900">SHA-256</option>
                <option value="md5" className="bg-slate-900">MD5</option>
                <option value="cve" className="bg-slate-900">CVE</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 bg-soc-base border border-soc-border rounded-lg px-2.5 py-1 text-xs text-slate-400 font-mono">
              <select
                value={selectedSeverityFilter}
                onChange={(e) => {
                  setSelectedSeverityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-200 focus:outline-none"
              >
                <option value="all" className="bg-slate-900">All Severities</option>
                <option value="critical" className="bg-slate-900">Critical</option>
                <option value="high" className="bg-slate-900">High</option>
                <option value="medium" className="bg-slate-900">Medium</option>
                <option value="low" className="bg-slate-900">Low</option>
              </select>
            </div>

            {/* Export Button */}
            <button
              onClick={handleExportJSON}
              disabled={filteredIndicators.length === 0}
              className="px-2.5 py-1.5 bg-soc-card hover:bg-soc-cardHover border border-soc-border text-slate-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors"
              title="Export filtered records as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        {isSearchLoading ? (
          <TableSkeleton rows={5} />
        ) : filteredIndicators.length === 0 ? (
          <EmptyState
            title="No matching indicators found"
            description="No threat indicators matched the selected query or filters. Validate and save new indicators above to record them in your threat inventory."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-soc-base text-slate-400 uppercase border-b border-soc-border text-[11px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Observable Value</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Severity</th>
                  <th className="py-3 px-4 font-semibold">Confidence</th>
                  <th className="py-3 px-4 font-semibold">Description / Notes</th>
                  <th className="py-3 px-4 font-semibold">Recorded Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soc-borderSubtle">
                {paginatedIndicators.map((ind) => (
                  <tr key={ind.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-200 font-semibold max-w-xs truncate">
                      {ind.value}
                    </td>
                    <td className="py-3 px-4">
                      <IOCTypePill type={ind.ioc_type} />
                    </td>
                    <td className="py-3 px-4">
                      <SeverityBadge severity={ind.severity} />
                    </td>
                    <td className="py-3 px-4">
                      <ConfidenceScore score={ind.confidence} />
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans max-w-xs truncate">
                      {ind.description || 'Confirmed telemetry record'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(ind.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleCopy(ind.value, ind.id)}
                        className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
                        title="Copy IOC value"
                      >
                        {copiedId === ind.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredIndicators.length > itemsPerPage && (
          <div className="flex items-center justify-between pt-3 border-t border-soc-borderSubtle text-xs font-mono text-slate-400">
            <span>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredIndicators.length)} of{' '}
              {filteredIndicators.length} indicators
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded bg-soc-card border border-soc-border disabled:opacity-40 hover:bg-soc-cardHover text-slate-200 transition-colors"
              >
                Previous
              </button>
              <span className="text-slate-300 font-semibold px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded bg-soc-card border border-soc-border disabled:opacity-40 hover:bg-soc-cardHover text-slate-200 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
