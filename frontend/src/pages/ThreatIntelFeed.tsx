import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radio,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Cpu,
  Eye,
  X,
  Server,
  Database,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '../api/client';
import {
  ThreatFeedItem,
  ThreatFeedListResponse,
  FeedProviderStatus,
  FeedStatsResponse,
  FeedSyncResponse,
} from '../types';
import { IOCTypePill, SeverityBadge } from '../components/common/Badges';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ToastContainer, ToastMessage } from '../components/common/Toast';
import { formatApiError } from '../utils/errors';

export const ThreatIntelFeed: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Drawer / Modal States
  const [selectedItem, setSelectedItem] = useState<ThreatFeedItem | null>(null);
  const [showProvidersModal, setShowProvidersModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // 1. Query Feed Items
  const {
    data: feedData,
    isLoading: isLoadingFeed,
  } = useQuery<ThreatFeedListResponse>({
    queryKey: ['threat-feed', page, pageSize, searchTerm, selectedType, selectedSeverity, selectedProvider],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('page_size', String(pageSize));
      if (searchTerm.trim()) params.append('q', searchTerm.trim());
      if (selectedType !== 'all') params.append('ioc_type', selectedType);
      if (selectedSeverity !== 'all') params.append('severity', selectedSeverity);
      if (selectedProvider !== 'all') params.append('provider', selectedProvider);

      const res = await apiClient.get<ThreatFeedListResponse>(`/threat-intel/feed?${params.toString()}`);
      return res.data;
    },
  });

  // 2. Query Feed Stats
  const { data: feedStats } = useQuery<FeedStatsResponse>({
    queryKey: ['threat-feed-stats'],
    queryFn: async () => {
      const res = await apiClient.get<FeedStatsResponse>('/threat-intel/stats');
      return res.data;
    },
  });

  // 3. Query Provider Statuses
  const { data: providerStatuses = [] } = useQuery<FeedProviderStatus[]>({
    queryKey: ['threat-feed-providers'],
    queryFn: async () => {
      const res = await apiClient.get<FeedProviderStatus[]>('/threat-intel/providers/status');
      return res.data;
    },
  });

  // 4. Sync Feeds Mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<FeedSyncResponse>('/threat-intel/sync', {});
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['threat-feed'] });
      queryClient.invalidateQueries({ queryKey: ['threat-feed-stats'] });
      queryClient.invalidateQueries({ queryKey: ['threat-feed-providers'] });
      addToast(
        'success',
        'Feed Synchronization Complete',
        `Ingested ${data.total_ingested} new, updated ${data.total_updated} items across active providers.`
      );
    },
    onError: (err: any) => {
      addToast('error', 'Feed Synchronization Failed', formatApiError(err));
    },
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    addToast('info', 'Copied to Clipboard');
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedSeverity('all');
    setSelectedProvider('all');
    setPage(1);
  };

  // Operational provider count
  const operationalCount = useMemo(() => {
    return providerStatuses.filter((p) => p.status === 'operational').length;
  }, [providerStatuses]);

  // Format relative time
  const formatTimeAgo = (dateStr?: string | null) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={(id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-soc-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Radio className="w-6 h-6 text-soc-accent animate-pulse" />
              Threat Intelligence Feed
            </h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Ingestion Active
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time normalized indicators from AlienVault OTX, URLhaus, CISA KEV, AbuseIPDB, and VirusTotal.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowProvidersModal(true)}
            className="px-3 py-1.5 bg-soc-panel hover:bg-slate-800 border border-soc-border rounded-lg text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <Server className="w-3.5 h-3.5 text-soc-accent" />
            <span>Feeds Health ({operationalCount}/{providerStatuses.length || 5})</span>
          </button>

          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="px-4 py-1.5 bg-soc-accent hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center gap-2 transition-all shadow-md shadow-soc-accent/10 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{syncMutation.isPending ? 'Syncing...' : 'Sync Feeds Now'}</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Indicators */}
        <div className="bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Feed IOCs</span>
            <div className="text-2xl font-bold font-mono text-white">
              {feedStats?.total_items?.toLocaleString() || feedData?.total?.toLocaleString() || '0'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Deduplicated in PostgreSQL</div>
          </div>
          <div className="p-3 rounded-lg bg-soc-base border border-soc-border text-soc-accent">
            <Database className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Critical Severity */}
        <div className="bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-rose-400 uppercase tracking-wider">Critical Threats</span>
            <div className="text-2xl font-bold font-mono text-rose-400">
              {feedStats?.by_severity?.critical?.toLocaleString() || '0'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">High-impact payloads & CVEs</div>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Operational Providers */}
        <div className="bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">Active Providers</span>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {operationalCount} / {providerStatuses.length || 5}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Zero unmonitored feeds</div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Last Synchronized */}
        <div className="bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Last Sync Time</span>
            <div className="text-sm font-bold font-mono text-slate-200 truncate max-w-[140px]">
              {formatTimeAgo(feedStats?.last_sync_time)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono truncate">
              {feedStats?.last_sync_time ? new Date(feedStats.last_sync_time).toLocaleTimeString() : 'Pending'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-soc-base border border-soc-border text-slate-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by indicator, threat tag, CVE, or description..."
              className="w-full bg-soc-base border border-soc-border rounded-lg pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-soc-accent font-mono transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="w-full bg-soc-base border border-soc-border rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-soc-accent uppercase font-mono transition-colors"
            >
              <option value="all">ALL TYPES</option>
              <option value="ipv4">IPv4 Address</option>
              <option value="domain">Domain / Host</option>
              <option value="url">Malware URL</option>
              <option value="sha256">SHA-256 Hash</option>
              <option value="md5">MD5 Hash</option>
              <option value="cve">Exploited CVE</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedSeverity}
              onChange={(e) => {
                setSelectedSeverity(e.target.value);
                setPage(1);
              }}
              className="w-full bg-soc-base border border-soc-border rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-soc-accent uppercase font-mono transition-colors"
            >
              <option value="all">ALL SEVERITIES</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Provider Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setPage(1);
              }}
              className="w-full bg-soc-base border border-soc-border rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-soc-accent font-mono transition-colors"
            >
              <option value="all">All Providers</option>
              <option value="AlienVault OTX">AlienVault OTX</option>
              <option value="URLhaus">URLhaus (abuse.ch)</option>
              <option value="CISA KEV">CISA KEV Catalog</option>
              <option value="AbuseIPDB">AbuseIPDB</option>
              <option value="VirusTotal">VirusTotal</option>
            </select>
          </div>

          {/* Reset Action */}
          <div className="md:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset all filters"
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Threat Feed Data Table */}
      <div className="bg-soc-panel border border-soc-border rounded-xl shadow-lg overflow-hidden">
        {isLoadingFeed ? (
          <div className="p-6">
            <TableSkeleton rows={8} />
          </div>
        ) : !feedData || feedData.items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-soc-base border border-soc-border text-slate-500">
              <Search className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-white">No Threat Indicators Found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No feed items match your current filter criteria. Try resetting filters or click Sync Feeds Now to pull
              the latest telemetry.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-soc-base hover:bg-slate-800 border border-soc-border text-xs text-slate-200 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-soc-border bg-soc-base/40 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Observable / Threat</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Provider Feed</th>
                  <th className="py-3 px-3">Last Seen</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soc-border/50 text-xs">
                {feedData.items.map((item) => (
                  <tr key={item.id} className="hover:bg-soc-base/70 transition-colors group">
                    {/* Observable & Tags */}
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-white truncate max-w-[230px]" title={item.indicator_value}>
                          {item.indicator_value}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.indicator_value, item.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity"
                          title="Copy observable"
                        >
                          {copiedKey === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {item.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60"
                            >
                              {tag}
                            </span>
                          ))}
                          {item.tags.length > 3 && (
                            <span className="text-[10px] font-mono text-slate-500">+{item.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* IOC Type */}
                    <td className="py-3 px-3">
                      <IOCTypePill type={item.ioc_type as any} />
                    </td>

                    {/* Severity */}
                    <td className="py-3 px-3">
                      <SeverityBadge severity={item.severity as any} />
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3 max-w-[180px] truncate text-slate-300 font-medium" title={item.threat_category}>
                      {item.threat_category}
                    </td>

                    {/* Provider */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-200 text-xs">{item.provider}</span>
                        {item.source_feed && (
                          <span className="text-[10px] text-slate-500 truncate max-w-[140px]" title={item.source_feed}>
                            {item.source_feed}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Last Seen */}
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {formatTimeAgo(item.last_seen)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="p-1.5 bg-soc-base hover:bg-slate-800 border border-soc-border rounded text-slate-300 hover:text-white transition-colors"
                          title="View Intelligence Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate(`/ioc-search?q=${encodeURIComponent(item.indicator_value)}`)}
                          className="px-2 py-1 bg-soc-accent/10 hover:bg-soc-accent/20 border border-soc-accent/30 rounded text-[11px] font-mono font-medium text-soc-accent flex items-center gap-1 transition-colors"
                          title="Investigate with IOC Engine"
                        >
                          <Search className="w-3 h-3" />
                          <span>Investigate</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate(`/ai-analyst?q=${encodeURIComponent(item.indicator_value)}`)}
                          className="p-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 transition-colors"
                          title="Synthesize with Gemini AI Analyst"
                        >
                          <Cpu className="w-3.5 h-3.5" />
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
        {feedData && feedData.total > 0 && (
          <div className="p-4 border-t border-soc-border bg-soc-base/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-mono text-slate-400">
              Showing <span className="text-white font-medium">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="text-white font-medium">{Math.min(page * pageSize, feedData.total)}</span> of{' '}
              <span className="text-white font-medium">{feedData.total.toLocaleString()}</span> indicators
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-soc-base border border-soc-border rounded px-2 py-1 text-xs text-slate-300 font-mono"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>

              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 bg-soc-base border border-soc-border rounded text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs font-mono text-slate-400 px-2">
                Page {page} of {feedData.total_pages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(feedData.total_pages, p + 1))}
                disabled={page >= feedData.total_pages}
                className="p-1.5 bg-soc-base border border-soc-border rounded text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Item Details Drawer Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end transition-opacity">
          <div className="w-full max-w-xl bg-soc-panel border-l border-soc-border h-full p-6 overflow-y-auto space-y-5 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-soc-border">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-soc-accent" />
                <h3 className="text-base font-bold text-white">Threat Intelligence Detail</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Observable Headline */}
            <div className="bg-soc-base border border-soc-border rounded-xl p-4 space-y-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Indicator Value</div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-base font-bold text-white break-all">{selectedItem.indicator_value}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedItem.indicator_value, 'drawer')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 shrink-0"
                >
                  {copiedKey === 'drawer' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-soc-border/50">
                <IOCTypePill type={selectedItem.ioc_type as any} />
                <SeverityBadge severity={selectedItem.severity as any} />
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-soc-accent/10 text-soc-accent border border-soc-accent/30">
                  Confidence: {selectedItem.confidence}%
                </span>
              </div>
            </div>

            {/* Overview Attributes */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-soc-base p-3 rounded-lg border border-soc-border space-y-1">
                <div className="text-slate-500 font-mono text-[10px] uppercase">Intelligence Provider</div>
                <div className="font-semibold text-white">{selectedItem.provider}</div>
                {selectedItem.source_feed && (
                  <div className="text-[11px] text-slate-400">{selectedItem.source_feed}</div>
                )}
              </div>

              <div className="bg-soc-base p-3 rounded-lg border border-soc-border space-y-1">
                <div className="text-slate-500 font-mono text-[10px] uppercase">Threat Category</div>
                <div className="font-semibold text-white">{selectedItem.threat_category}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Last seen: {formatTimeAgo(selectedItem.last_seen)}
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedItem.description && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-300">Threat Description / Advisory</div>
                <p className="text-xs text-slate-300 leading-relaxed bg-soc-base p-3.5 rounded-lg border border-soc-border whitespace-pre-line">
                  {selectedItem.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {selectedItem.tags?.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-300">Attributed Tags & Malware Signatures</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedItem.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs font-mono rounded bg-soc-base border border-soc-border text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* External Reference */}
            {selectedItem.external_reference && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-300">External Threat Advisory</div>
                <a
                  href={selectedItem.external_reference}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-soc-accent hover:underline flex items-center gap-1.5 break-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>{selectedItem.external_reference}</span>
                </a>
              </div>
            )}

            {/* Raw JSON Telemetry */}
            {selectedItem.raw_metadata && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-300">Raw Provider Telemetry</div>
                <pre className="text-[11px] font-mono bg-soc-base p-3 rounded-lg border border-soc-border text-slate-300 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedItem.raw_metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Direct CTAs */}
            <div className="pt-4 border-t border-soc-border space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedItem(null);
                  navigate(`/ioc-search?q=${encodeURIComponent(selectedItem.indicator_value)}`);
                }}
                className="w-full py-2.5 bg-soc-accent hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Search className="w-4 h-4" />
                <span>Launch Multi-Engine Investigation</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedItem(null);
                  navigate(`/ai-analyst?q=${encodeURIComponent(selectedItem.indicator_value)}`);
                }}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Cpu className="w-4 h-4" />
                <span>Generate Autonomous AI Threat Briefing</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider Health Modal */}
      {showProvidersModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-soc-panel border border-soc-border rounded-xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-soc-border">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-soc-accent" />
                <h3 className="text-base font-bold text-white">Threat Intelligence Feeds Status & Quotas</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProvidersModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {providerStatuses.map((p) => (
                <div
                  key={p.provider}
                  className="bg-soc-base border border-soc-border rounded-lg p-3.5 space-y-2 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          p.status === 'operational'
                            ? 'bg-emerald-400 animate-pulse'
                            : p.status === 'rate_limited'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                      />
                      <span className="font-bold text-white text-sm">{p.provider}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {p.items_count} records in inventory
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                        p.status === 'operational'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : p.status === 'rate_limited'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">{p.attribution}</p>

                  {p.rate_limit_info && (
                    <div className="text-[11px] text-slate-300 font-mono bg-slate-900/60 p-2 rounded border border-slate-800">
                      ℹ️ {p.rate_limit_info}
                    </div>
                  )}

                  <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-1">
                    <span>Last synchronized: {p.last_synced_at ? new Date(p.last_synced_at).toLocaleString() : 'Never'}</span>
                    {p.last_error && <span className="text-rose-400 truncate max-w-xs">{p.last_error}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowProvidersModal(false)}
                className="px-4 py-2 bg-soc-base hover:bg-slate-800 border border-soc-border rounded-lg text-xs font-semibold text-slate-200 transition-colors"
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
export default ThreatIntelFeed;
