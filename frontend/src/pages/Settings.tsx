import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Save,
  RefreshCw,
  Key,
  CheckCircle2,
  Database,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { SOCSettingsResponse } from '../types';
import { ToastContainer, ToastMessage } from '../components/common/Toast';
import { formatApiError } from '../utils/errors';

export const Settings: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'weights' | 'thresholds' | 'providers' | 'retention'>('weights');

  // Form states for scoring weights
  const [vtWeight, setVtWeight] = useState(35);
  const [abuseWeight, setAbuseWeight] = useState(25);
  const [otxWeight, setOtxWeight] = useState(20);
  const [urlhausWeight, setUrlhausWeight] = useState(20);

  // Form states for alert thresholds
  const [minConfidence, setMinConfidence] = useState(75);
  const [autoEscalateCritical, setAutoEscalateCritical] = useState(true);
  const [dedupWindowHours, setDedupWindowHours] = useState(24);
  const [requireNotes, setRequireNotes] = useState(true);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // 1. Fetch current SOC Settings
  const { data: settings, isFetching, refetch } = useQuery<SOCSettingsResponse>({
    queryKey: ['soc-settings'],
    queryFn: async () => {
      const res = await apiClient.get<SOCSettingsResponse>('/settings/');
      return res.data;
    },
  });

  // Populate local form states when fetched
  useEffect(() => {
    if (settings) {
      if (settings.scoring_weights) {
        setVtWeight(settings.scoring_weights.virustotal_weight ?? 35);
        setAbuseWeight(settings.scoring_weights.abuseipdb_weight ?? 25);
        setOtxWeight(settings.scoring_weights.alienvault_weight ?? 20);
        setUrlhausWeight(settings.scoring_weights.urlhaus_weight ?? 20);
      }
      if (settings.alert_thresholds) {
        setMinConfidence(settings.alert_thresholds.min_confidence_to_alert ?? 75);
        setAutoEscalateCritical(settings.alert_thresholds.auto_escalate_critical ?? true);
        setDedupWindowHours(settings.alert_thresholds.deduplication_window_hours ?? 24);
        setRequireNotes(settings.alert_thresholds.require_analyst_resolution_notes ?? true);
      }
    }
  }, [settings]);

  // 2. Mutation for scoring weights
  const weightsMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        virustotal_weight: Number(vtWeight),
        abuseipdb_weight: Number(abuseWeight),
        alienvault_weight: Number(otxWeight),
        urlhaus_weight: Number(urlhausWeight),
      };
      const res = await apiClient.put<SOCSettingsResponse>('/settings/scoring-weights', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soc-settings'] });
      addToast('success', 'Scoring Weights Updated', 'Threat calculation weights saved successfully.');
    },
    onError: (err) => {
      addToast('error', 'Update Failed', formatApiError(err));
    },
  });

  // 3. Mutation for alert thresholds
  const thresholdsMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        min_confidence_to_alert: Number(minConfidence),
        auto_escalate_critical: autoEscalateCritical,
        deduplication_window_hours: Number(dedupWindowHours),
        require_analyst_resolution_notes: requireNotes,
      };
      const res = await apiClient.put<SOCSettingsResponse>('/settings/alert-thresholds', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soc-settings'] });
      addToast('success', 'Alert Thresholds Updated', 'SOC alert policy rules saved successfully.');
    },
    onError: (err) => {
      addToast('error', 'Update Failed', formatApiError(err));
    },
  });

  const totalWeights = Number(vtWeight) + Number(abuseWeight) + Number(otxWeight) + Number(urlhausWeight);

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={(id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-soc-card p-6 rounded-xl border border-soc-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest bg-cyan-950/60 text-cyan-400 border border-cyan-800/80">
              System Configuration & Policies
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-soc-accent" />
            SOC Policies & System Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Configure multi-provider scoring weights, automated alert threshold escalation rules, compliance retention horizons, and verify threat intelligence provider connectivity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-2 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh Settings
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-soc-border gap-2">
        <button
          onClick={() => setActiveTab('weights')}
          className={`px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'weights'
              ? 'border-soc-accent text-soc-accent'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Scoring Engine Weights
        </button>
        <button
          onClick={() => setActiveTab('thresholds')}
          className={`px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'thresholds'
              ? 'border-soc-accent text-soc-accent'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Alert & Escalation Policies
        </button>
        <button
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'providers'
              ? 'border-soc-accent text-soc-accent'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Key className="w-4 h-4" />
          Provider Status & Connectivity
        </button>
        <button
          onClick={() => setActiveTab('retention')}
          className={`px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'retention'
              ? 'border-soc-accent text-soc-accent'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          Data Retention
        </button>
      </div>

      {/* TAB 1: Scoring Weights */}
      {activeTab === 'weights' && (
        <div className="bg-soc-surface border border-soc-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-soc-accent" />
                Multi-Engine Threat Scoring Matrix
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Customize relative engine weights when computing aggregate threat and severity scores. Total should sum to 100%.
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border ${
                totalWeights === 100
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  : 'bg-amber-950/60 border-amber-800 text-amber-400'
              }`}
            >
              Total Weight: {totalWeights}%
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            {/* VirusTotal */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-soc-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  VirusTotal Engine Weight
                </span>
                <span className="text-sm font-bold text-soc-accent">{vtWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={vtWeight}
                onChange={(e) => setVtWeight(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 font-sans">
                Weight assigned to VirusTotal multi-AV signature detection ratio and malicious vendor count.
              </p>
            </div>

            {/* AbuseIPDB */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-soc-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  AbuseIPDB Engine Weight
                </span>
                <span className="text-sm font-bold text-soc-accent">{abuseWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={abuseWeight}
                onChange={(e) => setAbuseWeight(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 font-sans">
                Weight assigned to AbuseIPDB IP reputation confidence score and recent malicious abuse reports.
              </p>
            </div>

            {/* AlienVault OTX */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-soc-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  AlienVault OTX Pulse Weight
                </span>
                <span className="text-sm font-bold text-soc-accent">{otxWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={otxWeight}
                onChange={(e) => setOtxWeight(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 font-sans">
                Weight assigned to Open Threat Exchange (OTX) pulse frequency, campaign linkage, and adversary tags.
              </p>
            </div>

            {/* URLhaus */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-soc-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  URLhaus Payload Weight
                </span>
                <span className="text-sm font-bold text-soc-accent">{urlhausWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={urlhausWeight}
                onChange={(e) => setUrlhausWeight(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 font-sans">
                Weight assigned to URLhaus active malware payload distribution and blacklist threat telemetry.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-soc-border">
            <button
              onClick={() => {
                setVtWeight(35);
                setAbuseWeight(25);
                setOtxWeight(20);
                setUrlhausWeight(20);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors"
            >
              Reset to Defaults
            </button>
            <button
              onClick={() => weightsMutation.mutate()}
              disabled={weightsMutation.isPending}
              className="px-5 py-2 bg-soc-accent hover:bg-soc-accentHover text-slate-950 font-bold rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {weightsMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Scoring Weights
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Alert Thresholds */}
      {activeTab === 'thresholds' && (
        <div className="bg-soc-surface border border-soc-border rounded-xl p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-soc-accent" />
              Automated Alert Ingestion & Correlation Rules
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure parameters governing automated alert generation, noise deduplication windows, and auto-escalation into formal investigation cases.
            </p>
          </div>

          <div className="space-y-5 font-mono text-xs">
            {/* Min confidence slider */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-soc-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">Minimum Threat Confidence to Trigger Alert</span>
                <span className="text-sm font-bold text-soc-accent">{minConfidence}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 font-sans">
                Observations with aggregate confidence below this threshold are flagged as low-priority telemetry rather than active security alerts.
              </p>
            </div>

            {/* Deduplication window */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-soc-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">Alert Deduplication Suppression Window (Hours)</span>
                <span className="text-sm font-bold text-soc-accent">{dedupWindowHours}h</span>
              </div>
              <input
                type="number"
                min="1"
                max="168"
                value={dedupWindowHours}
                onChange={(e) => setDedupWindowHours(Number(e.target.value))}
                className="w-32 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-soc-accent"
              />
              <p className="text-[11px] text-slate-400 font-sans">
                Identical indicator occurrences detected within this timeframe will update the existing alert rather than generating duplicate noise.
              </p>
            </div>

            {/* Auto escalate toggle */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-soc-border flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Auto-Escalate Critical IOC Detections</div>
                <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Automatically promote alerts with critical severity directly into open SOC investigation cases.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEscalateCritical}
                  onChange={(e) => setAutoEscalateCritical(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-soc-accent"></div>
              </label>
            </div>

            {/* Require notes toggle */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-soc-border flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Enforce Mandatory Analyst Resolution Notes</div>
                <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Require operators to provide triage reasoning and remediation notes before marking an alert resolved.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireNotes}
                  onChange={(e) => setRequireNotes(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-soc-accent"></div>
              </label>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-soc-border">
            <button
              onClick={() => {
                setMinConfidence(75);
                setAutoEscalateCritical(true);
                setDedupWindowHours(24);
                setRequireNotes(true);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors"
            >
              Reset to Defaults
            </button>
            <button
              onClick={() => thresholdsMutation.mutate()}
              disabled={thresholdsMutation.isPending}
              className="px-5 py-2 bg-soc-accent hover:bg-soc-accentHover text-slate-950 font-bold rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {thresholdsMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Alert Policies
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Provider Status */}
      {activeTab === 'providers' && (
        <div className="bg-soc-surface border border-soc-border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-soc-accent" />
              Intelligence Provider Connectivity & Secret Isolation
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Active threat intelligence engines and AI integrations. API credentials are loaded directly in the isolated Docker container environment and are never transmitted to frontend clients.
            </p>
          </div>

          {/* Isolation banner */}
          <div className="p-4 bg-cyan-950/30 border border-cyan-800/50 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300">
              <span className="font-bold text-white font-mono">Zero Secret Exposure Architecture: </span>
              All API keys (VirusTotal, AbuseIPDB, AlienVault OTX, URLhaus, and Google Gemini) remain securely isolated inside the backend runtime process. The frontend communicates exclusively via authenticated REST proxies.
            </div>
          </div>

          {/* Provider Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings?.provider_statuses &&
              Object.entries(settings.provider_statuses).map(([key, provider]) => (
                <div
                  key={key}
                  className="bg-slate-900/60 border border-soc-border rounded-xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-mono text-sm text-white">{provider.provider_name}</span>
                      {provider.is_configured ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          <Info className="w-3 h-3" />
                          PUBLIC
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-2 font-mono">
                      Status: <span className="text-slate-200">{provider.status_label}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      Access Tier: <span className="text-cyan-400">{provider.quota_tier}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-soc-border/50 text-[10px] text-slate-500 font-mono">
                    Provider Key: Encrypted in Backend Env
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 4: Data Retention */}
      {activeTab === 'retention' && (
        <div className="bg-soc-surface border border-soc-border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-soc-accent" />
              SOC Compliance Data Retention Policies
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configured automated database pruning policies for audit logs, telemetry feeds, and closed investigation case records.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="bg-slate-900/60 border border-soc-border rounded-xl p-4">
              <div className="text-slate-400 uppercase text-[10px]">Audit Log Retention</div>
              <div className="text-2xl font-bold text-white mt-1">
                {settings?.retention_policies?.audit_log_retention_days ?? 365} Days
              </div>
              <p className="text-[11px] text-slate-500 mt-2 font-sans">
                Immutable compliance event records retained for statutory SOC 2 and ISO 27001 audit verification.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-soc-border rounded-xl p-4">
              <div className="text-slate-400 uppercase text-[10px]">Threat Feed Retention</div>
              <div className="text-2xl font-bold text-cyan-400 mt-1">
                {settings?.retention_policies?.feed_retention_days ?? 90} Days
              </div>
              <p className="text-[11px] text-slate-500 mt-2 font-sans">
                External indicator telemetry stored locally before automatic vacuuming and expiration.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-soc-border rounded-xl p-4">
              <div className="text-slate-400 uppercase text-[10px]">Closed Cases Retention</div>
              <div className="text-2xl font-bold text-indigo-400 mt-1">
                {settings?.retention_policies?.closed_investigation_retention_days ?? 180} Days
              </div>
              <p className="text-[11px] text-slate-500 mt-2 font-sans">
                Resolved and post-mortem incident investigation cases archived in read-only cold storage.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
