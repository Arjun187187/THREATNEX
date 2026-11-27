import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Briefcase,
  AlertTriangle,
  FolderOpen,
  Search,
  ArrowRight,
  Database,
  Crosshair,
  RefreshCw,
  Activity,
  ChevronRight,
  Radio,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { apiClient } from '../api/client';
import { DashboardStats, Investigation, Indicator, ThreatFeedListResponse } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge, PriorityBadge, IOCTypePill, SeverityBadge } from '../components/common/Badges';
import { CardSkeleton, TableSkeleton } from '../components/common/LoadingSkeleton';
import { InvestigationDetailModal } from '../components/common/InvestigationDetailModal';
import { sanitizeInternalPath } from '../utils/navigation';

export const Dashboard: React.FC = () => {
  const [quickSearch, setQuickSearch] = useState('');
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null);
  const navigate = useNavigate();

  // Fetch real SOC stats
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
    isRefetching: isRefetchingStats,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardStats>('/dashboard/stats');
      return res.data;
    },
  });

  // Fetch recent investigations
  const {
    data: investigations,
    isLoading: invLoading,
    refetch: refetchInvs,
  } = useQuery<Investigation[]>({
    queryKey: ['recent-investigations'],
    queryFn: async () => {
      const res = await apiClient.get<Investigation[]>('/investigations/?limit=6');
      return res.data;
    },
  });

  // Fetch recent recorded indicators
  const {
    data: recentIndicators,
    isLoading: iocLoading,
    refetch: refetchIocs,
  } = useQuery<Indicator[]>({
    queryKey: ['recent-indicators-dashboard'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<Indicator[]>('/indicators/search?q=&limit=5');
        return res.data;
      } catch {
        return [];
      }
    },
  });

  // Fetch live threat feed preview
  const {
    data: liveThreatFeed,
    refetch: refetchFeed,
  } = useQuery<ThreatFeedListResponse>({
    queryKey: ['dashboard-threat-feed'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ThreatFeedListResponse>('/threat-intel/feed?page=1&page_size=4');
        return res.data;
      } catch {
        return { items: [], total: 0, page: 1, page_size: 4, total_pages: 1 };
      }
    },
  });

  const handleRefreshAll = () => {
    refetchStats();
    refetchInvs();
    refetchIocs();
    refetchFeed();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      const target = `/ioc-search?q=${encodeURIComponent(quickSearch.trim())}`;
      navigate(sanitizeInternalPath(target));
    }
  };

  // Prepare chart data for IOC distribution
  const iocTypeData = stats?.ioc_by_type
    ? Object.entries(stats.ioc_by_type).map(([type, count]) => ({
        type: type.toUpperCase(),
        count,
      }))
    : [];

  // Prepare chart data for investigations by priority
  const priorityColors: Record<string, string> = {
    critical: '#F43F5E',
    high: '#F97316',
    medium: '#F59E0B',
    low: '#10B981',
  };

  const priorityData = stats?.investigations_by_priority
    ? Object.entries(stats.investigations_by_priority)
        .filter(([_, count]) => count > 0)
        .map(([priority, count]) => ({
          name: priority.toUpperCase(),
          value: count,
          color: priorityColors[priority.toLowerCase()] || '#0EA5E9',
        }))
    : [];

  return (
    <div className="space-y-6">
      {/* Top Banner / IOC Rapid Command Console */}
      <div className="bg-soc-surface border border-soc-border rounded-2xl p-5 lg:p-6 shadow-soc-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-soc-accent text-xs font-mono uppercase tracking-widest mb-1.5 font-semibold">
              <Crosshair className="w-4 h-4" />
              <span>Rapid IOC Inspection & Triage Console</span>
            </div>
            <h2 className="text-lg lg:text-xl font-bold text-white tracking-tight">
              Threat Intelligence & Investigation Command
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Query validated threat telemetry, inspect suspicious observables, and manage active incident cases.
            </p>

            <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Enter IPv4, IPv6, Domain, URL, MD5/SHA256 Hash, or CVE..."
                  className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-soc-accent hover:bg-soc-accentHover text-white font-medium text-xs rounded-xl flex items-center gap-2 shadow-soc-subtle transition-all shrink-0"
              >
                <span>Inspect</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Quick Refresh & SOC Summary */}
          <div className="flex lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 lg:border-l border-soc-borderSubtle pt-4 lg:pt-0 lg:pl-6 shrink-0 gap-4">
            <button
              onClick={handleRefreshAll}
              disabled={isRefetchingStats}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-soc-card border border-soc-border hover:border-soc-borderLight text-xs font-mono text-slate-300 hover:text-white transition-all"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetchingStats ? 'animate-spin text-soc-accent' : ''}`} />
              <span>{isRefetchingStats ? 'Syncing...' : 'Sync Telemetry'}</span>
            </button>

            <div className="text-right font-mono text-[11px] text-slate-400">
              <div>PostgreSQL 16: <span className="text-emerald-400 font-semibold">Active</span></div>
              <div>Redis 7 Cache: <span className="text-emerald-400 font-semibold">Synchronized</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards Grid */}
      {statsLoading ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Investigations"
            value={stats?.open_investigations ?? 0}
            subtitle="Cases requiring SOC triage"
            icon={Briefcase}
            badge="LIVE"
            badgeColor="cyan"
            onClick={() => navigate('/investigations')}
          />
          <MetricCard
            title="Critical / High Threats"
            value={stats?.critical_high_indicators ?? 0}
            subtitle="High-severity indicators in DB"
            icon={ShieldAlert}
            badge="SEV 1-2"
            badgeColor="crimson"
          />
          <MetricCard
            title="Total IOC Inventory"
            value={stats?.total_indicators ?? 0}
            subtitle="Validated observables recorded"
            icon={Database}
            badge="CORRELATED"
            badgeColor="emerald"
            onClick={() => navigate('/ioc-search')}
          />
          <MetricCard
            title="In-Progress Cases"
            value={stats?.in_progress_investigations ?? 0}
            subtitle="Assigned under active investigation"
            icon={AlertTriangle}
            badge="ACTIVE"
            badgeColor="amber"
            onClick={() => navigate('/investigations')}
          />
        </div>
      )}

      {/* Telemetry Charts: Priority & Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* IOC Telemetry by Type (Horizontal Bar Chart) */}
        <div className="lg:col-span-2 bg-soc-surface border border-soc-border rounded-xl p-5 shadow-soc-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-soc-border">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-soc-accent" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Indicator Telemetry Breakdown by Type
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Live Database Metrics</span>
            </div>

            {iocTypeData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-slate-500 border border-dashed border-soc-borderSubtle rounded-lg">
                No IOC inventory telemetry recorded yet. Inspect and save indicators to view telemetry.
              </div>
            ) : (
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={iocTypeData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <XAxis type="number" stroke="#64748B" fontSize={10} fontStyle="monospace" allowDecimals={false} />
                    <YAxis type="category" dataKey="type" stroke="#94A3B8" fontSize={10} fontStyle="monospace" width={65} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0D1526',
                        borderColor: '#1E2E4E',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#F1F5F9',
                      }}
                      itemStyle={{ color: '#38BDF8' }}
                      cursor={{ fill: 'rgba(30, 46, 78, 0.3)' }}
                    />
                    <Bar dataKey="count" fill="#0EA5E9" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-soc-borderSubtle text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Verified database IOC types</span>
            <span className="text-soc-accent">{stats?.total_indicators ?? 0} total</span>
          </div>
        </div>

        {/* Case Severity / Priority Breakdown (Donut Chart) */}
        <div className="bg-soc-surface border border-soc-border rounded-xl p-5 shadow-soc-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-soc-border">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-soc-accent" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Case Priority Distribution
                </h3>
              </div>
            </div>

            {priorityData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-slate-500 border border-dashed border-soc-borderSubtle rounded-lg">
                No active investigation cases recorded yet.
              </div>
            ) : (
              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#0D1526" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0D1526',
                        borderColor: '#1E2E4E',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#F1F5F9',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (
                        <span className="text-[10px] font-mono text-slate-300 uppercase">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-soc-borderSubtle text-[11px] text-slate-500 font-mono">
            {stats?.total_investigations ?? 0} total incidents tracked
          </div>
        </div>
      </div>

      {/* Live Threat Intelligence Feed Preview */}
      <div className="bg-soc-surface border border-soc-border rounded-xl p-5 shadow-soc-card space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-soc-border">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-soc-accent animate-pulse" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Live Threat Intelligence Stream
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              AlienVault OTX • URLhaus • CISA KEV • AbuseIPDB
            </span>
          </div>
          <button
            onClick={() => navigate('/threat-intel')}
            className="text-xs text-soc-accent hover:text-soc-accentHover font-mono font-medium flex items-center gap-1 transition-colors"
          >
            <span>Explore Full Feed ({liveThreatFeed?.total || 0})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {liveThreatFeed?.items && liveThreatFeed.items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {liveThreatFeed.items.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/ioc-search?q=${encodeURIComponent(item.indicator_value)}`)}
                className="bg-soc-card/70 hover:bg-soc-card border border-soc-border rounded-lg p-3 space-y-2 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-soc-accent bg-soc-accent/10 px-1.5 py-0.5 rounded">
                    {item.ioc_type}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{item.provider}</span>
                </div>
                <div
                  className="font-mono text-xs font-semibold text-white group-hover:text-soc-accent truncate transition-colors"
                  title={item.indicator_value}
                >
                  {item.indicator_value}
                </div>
                <div className="text-[11px] text-slate-400 truncate" title={item.threat_category}>
                  {item.threat_category}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-soc-border/40 text-[10px] font-mono text-slate-500">
                  <span className="capitalize">{item.severity}</span>
                  <span className="flex items-center gap-0.5 text-soc-accent group-hover:underline">
                    Investigate <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-slate-500 font-mono">
            Threat feed synchronized. Click Explore to inspect live indicators.
          </div>
        )}
      </div>

      {/* Main Bottom Grid: Recent Investigations & Recent IOCs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Investigations List (2 Columns) */}
        <div className="lg:col-span-2 bg-soc-surface border border-soc-border rounded-xl p-5 shadow-soc-card">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-soc-border">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-soc-accent" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Recent Security Investigations
              </h3>
            </div>
            <button
              onClick={() => navigate('/investigations')}
              className="text-xs text-soc-accent hover:text-soc-accentHover font-mono font-medium flex items-center gap-1 transition-colors"
            >
              <span>View All Cases</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {invLoading ? (
            <TableSkeleton rows={4} />
          ) : !investigations || investigations.length === 0 ? (
            <EmptyState
              title="No active security investigations"
              description="Your SOC database has no recorded investigation cases yet. Create your first case to track incidents and indicators."
              action={{
                label: 'Create Investigation Case',
                onClick: () => navigate('/investigations'),
              }}
            />
          ) : (
            <div className="divide-y divide-soc-borderSubtle">
              {investigations.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvestigation(inv)}
                  className="py-3 px-3 -mx-3 rounded-lg hover:bg-slate-800/40 cursor-pointer transition-colors flex items-center justify-between group"
                >
                  <div className="space-y-1.5 min-w-0 pr-4">
                    <div className="flex items-center gap-2.5">
                      <PriorityBadge priority={inv.priority} />
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-soc-accent transition-colors truncate">
                        {inv.title}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 flex flex-wrap items-center gap-3">
                      <span>Assignee: <strong className="text-slate-300">{inv.assigned_to || 'Unassigned'}</strong></span>
                      <span>•</span>
                      <span>{inv.indicators?.length || 0} Indicators</span>
                      <span>•</span>
                      <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={inv.status} />
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Indicators Observed (1 Column) */}
        <div className="bg-soc-surface border border-soc-border rounded-xl p-5 shadow-soc-card">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-soc-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-soc-accent" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Recent IOCs
              </h3>
            </div>
            <button
              onClick={() => navigate('/ioc-search')}
              className="text-xs text-soc-accent hover:text-soc-accentHover font-mono font-medium flex items-center gap-1 transition-colors"
            >
              <span>Explore</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {iocLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-900 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : !recentIndicators || recentIndicators.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-soc-borderSubtle rounded-lg">
              No recent indicators recorded. Inspect and inventory IOCs to populate activity.
            </div>
          ) : (
            <div className="divide-y divide-soc-borderSubtle">
              {recentIndicators.map((ioc) => (
                <div
                  key={ioc.id}
                  onClick={() => navigate(`/ioc-search?q=${encodeURIComponent(ioc.value)}`)}
                  className="py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-800/40 cursor-pointer transition-colors flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-mono text-slate-200 font-semibold truncate">{ioc.value}</div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      {new Date(ioc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <IOCTypePill type={ioc.ioc_type} showIcon={false} />
                    <SeverityBadge severity={ioc.severity} showIcon={false} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Investigation Details Modal */}
      <InvestigationDetailModal
        investigation={selectedInvestigation}
        isOpen={!!selectedInvestigation}
        onClose={() => setSelectedInvestigation(null)}
        onUpdated={handleRefreshAll}
      />
    </div>
  );
};
