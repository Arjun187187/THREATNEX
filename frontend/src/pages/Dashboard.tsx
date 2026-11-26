import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Briefcase,
  AlertTriangle,
  FolderOpen,
  Search,
  ArrowRight,
  Database,
  Crosshair,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { DashboardStats, Investigation } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge, PriorityBadge } from '../components/common/Badges';

export const Dashboard: React.FC = () => {
  const [quickSearch, setQuickSearch] = useState('');
  const navigate = useNavigate();

  // Fetch real SOC stats from DB
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/stats');
      return res.data;
    },
  });

  // Fetch recent investigations
  const { data: investigations, isLoading: invLoading } = useQuery<Investigation[]>({
    queryKey: ['recent-investigations'],
    queryFn: async () => {
      const res = await apiClient.get('/investigations/?limit=5');
      return res.data;
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      navigate(`/ioc-search?q=${encodeURIComponent(quickSearch.trim())}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / IOC Quick Lookup */}
      <div className="bg-gradient-to-r from-[#111827] via-[#0F172A] to-[#111827] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-widest mb-2">
            <Crosshair className="w-4 h-4" />
            <span>IOC Rapid Validation & Investigation Console</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-4">
            Security Operations & Threat Telemetry Command
          </h2>

          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Enter IP (e.g. 198.51.100.24), Domain, URL, Hash (MD5/SHA1/SHA256), or CVE..."
                className="w-full bg-[#0B0F19] border border-slate-700 focus:border-cyan-500 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all shadow-inner font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all shrink-0"
            >
              <span>Validate & Inspect</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Investigations"
          value={statsLoading ? '...' : stats?.open_investigations ?? 0}
          subtitle="Cases requiring SOC triage"
          icon={Briefcase}
          badge="LIVE"
          badgeColor="cyan"
        />
        <MetricCard
          title="High/Critical Threats"
          value={statsLoading ? '...' : stats?.critical_high_indicators ?? 0}
          subtitle="Severity >= High indicators"
          icon={ShieldAlert}
          badge="SEV 1-2"
          badgeColor="crimson"
        />
        <MetricCard
          title="Total IOC Inventory"
          value={statsLoading ? '...' : stats?.total_indicators ?? 0}
          subtitle="Validated indicators recorded"
          icon={Database}
          badge="CORRELATED"
          badgeColor="emerald"
        />
        <MetricCard
          title="In-Progress Cases"
          value={statsLoading ? '...' : stats?.in_progress_investigations ?? 0}
          subtitle="Under analyst investigation"
          icon={AlertTriangle}
          badge="ASSIGNED"
          badgeColor="amber"
        />
      </div>

      {/* Main Grid: Recent Cases & IOC Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Investigations List (2 Columns) */}
        <div className="lg:col-span-2 bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Recent Investigation Cases
                </h3>
              </div>
              <Link
                to="/investigations"
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {invLoading ? (
              <div className="py-12 flex justify-center">
                <span className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></span>
              </div>
            ) : !investigations || investigations.length === 0 ? (
              <EmptyState
                title="No active security investigations"
                description="Your SOC database has no recorded investigation cases yet. Create your first investigation case to track incidents and indicators."
                action={{
                  label: "Create Investigation Case",
                  onClick: () => navigate("/investigations"),
                }}
              />
            ) : (
              <div className="divide-y divide-slate-800/80">
                {investigations.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => navigate(`/investigations`)}
                    className="py-3.5 px-3 -mx-3 rounded-lg hover:bg-slate-800/40 cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={inv.priority} />
                        <span className="text-sm font-semibold text-slate-200">{inv.title}</span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-3">
                        <span>Assigned: {inv.assigned_to || 'Unassigned'}</span>
                        <span>•</span>
                        <span>{inv.indicators?.length || 0} Indicators</span>
                        <span>•</span>
                        <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <StatusBadge status={inv.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* IOC Telemetry Distribution (1 Column) */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-800">
              <Database className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                IOC Types Inventory
              </h3>
            </div>

            {statsLoading ? (
              <div className="py-12 flex justify-center">
                <span className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></span>
              </div>
            ) : !stats?.ioc_by_type || Object.keys(stats.ioc_by_type).length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-slate-800/50 rounded-lg">
                No IOC inventory telemetry recorded yet. Indicators will appear here when validated and recorded.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.ioc_by_type).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-cyan-400 uppercase">{type}</span>
                    <span className="font-mono text-slate-300 font-bold bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500">
            Telemetry is calculated directly from confirmed database records. No synthetic values.
          </div>
        </div>
      </div>
    </div>
  );
};
