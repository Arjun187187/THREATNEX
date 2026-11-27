import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cpu,
  AlertTriangle,
  Activity,
  Layers,
  Sparkles,
  Download,
  Copy,
  Check,
  History,
  RefreshCw,
  Search,
  CheckCircle2,
  FileText,
  Terminal,
  Compass,
  AlertOctagon,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '../api/client';
import {
  AIAnalysisResponse,
  AIAnalysisListItem,
  IOCInvestigationHistoryItem,
} from '../types';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ToastContainer, ToastMessage } from '../components/common/Toast';
import { formatApiError } from '../utils/errors';

const QUICK_OBSERVABLES = [
  { label: 'Clean DNS (8.8.8.8)', val: '8.8.8.8' },
  { label: 'Suspicious IP', val: '198.51.100.24' },
  { label: 'Suspicious Domain', val: 'malware.com' },
  { label: 'Malware URL', val: 'https://cdn-update-payload.net/bin/agent.exe' },
];

export const AIAnalyst: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialInvId = searchParams.get('investigation_id') || '';

  const [observableInput, setObservableInput] = useState(initialQ);
  const [selectedInvestigationId, setSelectedInvestigationId] = useState(initialInvId);
  const [activeAnalysis, setActiveAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const queryClient = useQueryClient();

  // Query recent IOC investigations for dropdown selection
  const { data: investigationsList = [] } = useQuery<IOCInvestigationHistoryItem[]>({
    queryKey: ['ioc-investigations-list'],
    queryFn: async () => {
      const res = await apiClient.get<IOCInvestigationHistoryItem[]>('/indicators/investigations/history?limit=30');
      return res.data;
    },
  });

  // Query AI analysis history
  const { data: historyList = [], isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery<AIAnalysisListItem[]>({
    queryKey: ['ai-analyst-history'],
    queryFn: async () => {
      const res = await apiClient.get<AIAnalysisListItem[]>('/ai-analyst/history?limit=30');
      return res.data;
    },
  });

  // Mutation to run AI Threat Synthesis
  const analyzeMutation = useMutation({
    mutationFn: async ({
      investigationId,
      indicatorValue,
    }: {
      investigationId?: string;
      indicatorValue?: string;
    }) => {
      const payload: { investigation_id?: string; indicator_value?: string } = {};
      if (investigationId) payload.investigation_id = investigationId;
      if (indicatorValue) payload.indicator_value = indicatorValue.trim();
      const res = await apiClient.post<AIAnalysisResponse>('/ai-analyst/analyze', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setActiveAnalysis(data);
      setActiveTab('current');
      queryClient.invalidateQueries({ queryKey: ['ai-analyst-history'] });
      addToast(
        'success',
        'AI Threat Synthesis Complete',
        `Synthesized ${data.indicator_value} using ${data.model_name}`
      );
    },
    onError: (err: any) => {
      addToast('error', 'AI Analysis Failed', formatApiError(err));
    },
  });

  // Fetch full analysis detail when selecting a history item
  const loadHistoryDetail = async (id: string) => {
    try {
      const res = await apiClient.get<AIAnalysisResponse>(`/ai-analyst/${id}`);
      setActiveAnalysis(res.data);
      setActiveTab('current');
      addToast('info', 'Loaded Historical Assessment', `Observable: ${res.data.indicator_value}`);
    } catch (err: any) {
      addToast('error', 'Failed to Load Analysis', formatApiError(err));
    }
  };

  // Trigger analysis automatically if initial parameters present
  useEffect(() => {
    if (initialInvId) {
      analyzeMutation.mutate({ investigationId: initialInvId });
    } else if (initialQ && !activeAnalysis) {
      analyzeMutation.mutate({ indicatorValue: initialQ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectInvestigation = (id: string) => {
    setSelectedInvestigationId(id);
    const item = investigationsList.find((i) => i.id === id);
    if (item) {
      setObservableInput(item.indicator_value);
    }
  };

  const handleRunAnalysis = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!observableInput.trim() && !selectedInvestigationId) {
      addToast('warning', 'Input Required', 'Please enter an observable or select an existing investigation.');
      return;
    }
    analyzeMutation.mutate({
      investigationId: selectedInvestigationId || undefined,
      indicatorValue: observableInput.trim() || undefined,
    });
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    addToast('info', 'Copied to Clipboard');
  };

  const handleDownloadMarkdown = () => {
    if (!activeAnalysis) return;
    const a = activeAnalysis;
    const d = a.analysis_details;
    const md = `# ThreatNex AI Threat Intelligence Assessment
**Observable:** \`${a.indicator_value}\` (${a.ioc_type.toUpperCase()})
**Threat Classification:** ${a.threat_classification}
**Risk Level:** ${a.risk_level}
**Confidence Score:** ${a.confidence_score}%
**Model:** ${a.model_name}
**Assessment Timestamp:** ${new Date(a.created_at).toUTCString()}

---

## 1. Executive Summary
${d.executive_summary}

## 2. Technical Reasoning
${d.reasoning}

## 3. Provider Telemetry Evidence
${Object.entries(d.provider_evidence_summary || {})
  .map(([k, v]) => `- **${k}:** ${v}`)
  .join('\n')}

## 4. Confirmed Evidence vs Hypotheses
### Confirmed Ground-Truth Evidence
${d.confirmed_evidence.map((e) => `- [x] ${e}`).join('\n')}

### Threat Hypotheses & Scenarios
${d.hypotheses.map((h) => `- [?] ${h}`).join('\n')}

## 5. False-Positive Analysis
${d.false_positive_analysis}

## 6. MITRE ATT&CK Attribution
${d.mitre_techniques
  .map(
    (m) =>
      `### [${m.technique_id}] ${m.technique_name}
- **Tactic:** ${m.tactic}
- **Confidence:** ${m.confidence}
- **Observable Evidence:** ${m.evidence}`
  )
  .join('\n\n')}

## 7. Recommended Response Actions
### Investigation Steps
${d.recommended_investigation_steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### Immediate Containment Actions
${d.recommended_containment_actions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

---
**Senior Analyst Conclusion:**
${d.analyst_conclusion}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `threatnex-ai-${a.indicator_value.replace(/[^a-zA-Z0-9.-]/g, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRiskColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'HIGH':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'MEDIUM':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'LOW':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'CLEAN':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={(id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-soc-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Cpu className="w-6 h-6 text-soc-accent animate-pulse" />
              AI Threat Analyst
            </h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Gemini Flash Lite Connected
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Autonomous multi-source intelligence correlation, anti-hallucination reasoning, and MITRE ATT&CK attribution.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 bg-soc-panel border border-soc-border p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'current'
                ? 'bg-soc-accent text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Active Synthesis
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              refetchHistory();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-soc-accent text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            History ({historyList.length})
          </button>
        </div>
      </div>

      {activeTab === 'current' ? (
        <>
          {/* Top Controls: Selection & Submission Panel */}
          <div className="bg-soc-panel border border-soc-border rounded-xl p-5 shadow-lg space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              {/* Select Existing Investigation */}
              <div className="lg:col-span-5 space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Select Recorded Investigation</span>
                  <span className="text-[10px] text-slate-500 font-mono">From PostgreSQL Telemetry</span>
                </label>
                <select
                  value={selectedInvestigationId}
                  onChange={(e) => handleSelectInvestigation(e.target.value)}
                  className="w-full bg-soc-base border border-soc-border rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-soc-accent focus:ring-1 focus:ring-soc-accent transition-colors"
                >
                  <option value="">-- Choose an investigation to analyze --</option>
                  {investigationsList.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      [{inv.ioc_type.toUpperCase()}] {inv.indicator_value} — {inv.verdict.toUpperCase()} (
                      {inv.total_detections} hits)
                    </option>
                  ))}
                </select>
              </div>

              {/* Or manual Observable input */}
              <div className="lg:col-span-5 space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Or Enter Observable (IP / Domain / Hash / URL)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Auto-investigates if not recorded</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={observableInput}
                    onChange={(e) => {
                      setObservableInput(e.target.value);
                      setSelectedInvestigationId('');
                    }}
                    placeholder="e.g. 8.8.8.8, malware.com, hash, URL..."
                    className="w-full bg-soc-base border border-soc-border rounded-lg pl-3 pr-9 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-soc-accent focus:ring-1 focus:ring-soc-accent font-mono transition-colors"
                  />
                  {observableInput && (
                    <button
                      type="button"
                      onClick={() => setObservableInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="lg:col-span-2">
                <button
                  type="button"
                  onClick={() => handleRunAnalysis()}
                  disabled={analyzeMutation.isPending}
                  className="w-full h-[42px] bg-soc-accent hover:bg-cyan-400 text-slate-950 font-semibold px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-soc-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Synthesize</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Sample Observable Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-soc-border/40">
              <span className="text-[11px] font-mono text-slate-400">Quick Test IOCs:</span>
              {QUICK_OBSERVABLES.map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => {
                    setObservableInput(chip.val);
                    setSelectedInvestigationId('');
                  }}
                  className="px-2 py-1 text-xs rounded bg-soc-base border border-soc-border/70 text-slate-300 hover:text-soc-accent hover:border-soc-accent/40 font-mono transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading Animation during synthesis */}
          {analyzeMutation.isPending && (
            <div className="bg-soc-panel border border-soc-border rounded-xl p-8 text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-soc-accent/10 text-soc-accent border border-soc-accent/30 animate-pulse">
                <Cpu className="w-8 h-8 animate-spin" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-semibold text-white">Analyzing Multi-Provider Telemetry with Gemini</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Synthesizing VirusTotal, AbuseIPDB, AlienVault OTX, and URLhaus detections against MITRE ATT&CK framework...
                </p>
              </div>
              <div className="w-48 h-1.5 bg-soc-base rounded-full mx-auto overflow-hidden">
                <div className="w-full h-full bg-soc-accent animate-pulse rounded-full" />
              </div>
            </div>
          )}

          {/* Result View */}
          {activeAnalysis && !analyzeMutation.isPending && (
            <div className="space-y-6">
              {/* Executive Threat Banner */}
              <div className="bg-gradient-to-r from-soc-panel via-soc-panel to-slate-900 border border-soc-border rounded-xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-1 text-xs font-mono font-bold rounded uppercase bg-soc-base border border-soc-border text-slate-200">
                        {activeAnalysis.ioc_type}
                      </span>
                      <span className="text-xl font-mono font-bold text-white tracking-tight">
                        {activeAnalysis.indicator_value}
                      </span>
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded border uppercase tracking-wider ${getRiskColor(
                          activeAnalysis.risk_level
                        )}`}
                      >
                        {activeAnalysis.risk_level} RISK
                      </span>
                      <span className="px-2 py-0.5 text-xs font-mono rounded bg-soc-base/80 text-slate-400 border border-soc-border/60">
                        Model: {activeAnalysis.model_name}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                      <span className="text-soc-accent">Threat Classification:</span>
                      {activeAnalysis.threat_classification}
                    </h2>

                    <p className="text-sm text-slate-300 leading-relaxed max-w-4xl pt-1">
                      {activeAnalysis.executive_summary}
                    </p>
                  </div>

                  {/* Confidence Gauge & Action Buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-soc-border/40">
                    <div className="bg-soc-base/90 border border-soc-border rounded-lg p-3 text-center min-w-[140px]">
                      <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">AI Confidence</div>
                      <div className="text-2xl font-bold font-mono text-soc-accent mt-0.5">
                        {activeAnalysis.confidence_score}%
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-soc-accent h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, activeAnalysis.confidence_score))}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(activeAnalysis.executive_summary, 'summary')}
                        className="px-3 py-1.5 bg-soc-base hover:bg-slate-800 border border-soc-border rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition-colors"
                      >
                        {copiedKey === 'summary' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Brief</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadMarkdown}
                        className="px-3 py-1.5 bg-soc-base hover:bg-slate-800 border border-soc-border rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-soc-accent" />
                        <span>Export Report</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid: Confirmed Evidence vs Hypotheses */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Confirmed Ground Truth Evidence */}
                <div className="bg-soc-panel border border-soc-border rounded-xl p-5 shadow-lg space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-soc-border">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Confirmed Evidence (Verified Telemetry)
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Ground Truth
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {activeAnalysis.analysis_details.confirmed_evidence?.length > 0 ? (
                      activeAnalysis.analysis_details.confirmed_evidence.map((item, idx) => (
                        <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                          <span className="text-emerald-400 font-mono mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No specific confirmed evidence extracted.</p>
                    )}
                  </ul>
                </div>

                {/* Threat Hypotheses & Potential Scenarios */}
                <div className="bg-soc-panel border border-soc-border rounded-xl p-5 shadow-lg space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-soc-border">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Compass className="w-4 h-4 text-soc-accent" />
                      Threat Hypotheses & Scenarios
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-soc-accent border border-cyan-500/20">
                      Analytical Conjecture
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {activeAnalysis.analysis_details.hypotheses?.length > 0 ? (
                      activeAnalysis.analysis_details.hypotheses.map((item, idx) => (
                        <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
                          <span className="text-soc-accent font-mono mt-0.5">?</span>
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No hypothetical threats identified.</p>
                    )}
                  </ul>
                </div>
              </div>

              {/* Provider Evidence Cards */}
              <div className="bg-soc-panel border border-soc-border rounded-xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-soc-border">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-soc-accent" />
                    Multi-Source Threat Intelligence Synthesis
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">VirusTotal • AbuseIPDB • AlienVault OTX • URLhaus</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(activeAnalysis.analysis_details.provider_evidence_summary || {}).map(
                    ([provider, summary]) => (
                      <div
                        key={provider}
                        className="bg-soc-base border border-soc-border/70 rounded-lg p-3.5 space-y-1.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                            <span>{provider}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed mt-2">{summary}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* MITRE ATT&CK Attribution */}
              <div className="bg-soc-panel border border-soc-border rounded-xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-soc-border">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-soc-accent" />
                    MITRE ATT&CK Attribution Matrix
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Mapped Techniques: {activeAnalysis.analysis_details.mitre_techniques?.length || 0}
                  </span>
                </div>

                {activeAnalysis.analysis_details.mitre_techniques?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeAnalysis.analysis_details.mitre_techniques.map((m, idx) => (
                      <div
                        key={idx}
                        className="bg-soc-base border border-soc-border rounded-lg p-4 space-y-2 hover:border-soc-accent/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-soc-accent/10 text-soc-accent border border-soc-accent/30">
                            {m.technique_id}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            Confidence: {m.confidence}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-white">{m.technique_name}</h4>
                        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
                          Tactic: <span className="text-slate-200">{m.tactic}</span>
                        </div>
                        <div className="pt-2 border-t border-soc-border/50 text-xs text-slate-300 leading-relaxed">
                          <span className="text-slate-400 font-medium">Observable Evidence: </span>
                          {m.evidence}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-soc-base border border-soc-border/60 text-xs text-slate-400 italic text-center">
                    No malicious MITRE ATT&CK techniques associated with this observable.
                  </div>
                )}
              </div>

              {/* False Positive & Deep Reasoning */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Technical Reasoning */}
                <div className="bg-soc-panel border border-soc-border rounded-xl p-5 shadow-lg space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-soc-border">
                    <FileText className="w-4 h-4 text-soc-accent" />
                    Technical Reasoning & Correlation Logic
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {activeAnalysis.analysis_details.reasoning}
                  </p>
                </div>

                {/* False Positive Evaluation */}
                <div className="bg-soc-panel border border-soc-border rounded-xl p-5 shadow-lg space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 pb-2 border-b border-soc-border">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    False-Positive & Benign Likelihood Assessment
                  </h3>
                  <div className="p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-slate-200 leading-relaxed">
                    {activeAnalysis.analysis_details.false_positive_analysis}
                  </div>
                </div>
              </div>

              {/* Action Plan: Investigation & Containment Steps */}
              <div className="bg-soc-panel border border-soc-border rounded-xl p-5 shadow-lg space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-soc-border">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-soc-accent" />
                    Recommended Incident Response Action Plan
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">SOC Action Playbook</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Recommended Investigation Steps */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-soc-accent" />
                      Priority Investigation Steps
                    </h4>
                    <ol className="space-y-2">
                      {activeAnalysis.analysis_details.recommended_investigation_steps?.map((step, idx) => (
                        <li key={idx} className="text-xs text-slate-300 flex items-start gap-2.5">
                          <span className="font-mono text-soc-accent font-bold mt-0.5">{idx + 1}.</span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Immediate Containment Actions */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                      Immediate Containment Actions
                    </h4>
                    <ol className="space-y-2">
                      {activeAnalysis.analysis_details.recommended_containment_actions?.map((step, idx) => (
                        <li key={idx} className="text-xs text-slate-300 flex items-start gap-2.5">
                          <span className="font-mono text-rose-400 font-bold mt-0.5">{idx + 1}.</span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* Senior Analyst Conclusion */}
                <div className="pt-4 border-t border-soc-border/60">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Senior Analyst Verdict
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-mono bg-soc-base p-3 rounded-lg border border-soc-border">
                    {activeAnalysis.analysis_details.analyst_conclusion}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empty State when no analysis generated yet */}
          {!activeAnalysis && !analyzeMutation.isPending && (
            <div className="bg-soc-panel border border-soc-border/60 rounded-xl p-12 text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-soc-accent/10 text-soc-accent border border-soc-accent/20">
                <Cpu className="w-10 h-10" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-semibold text-white">No Observable Analyzed Yet</h3>
                <p className="text-xs text-slate-400">
                  Select a recorded investigation from the dropdown above or enter an indicator (such as{' '}
                  <span className="text-soc-accent font-mono">8.8.8.8</span>) to execute real-time threat synthesis with
                  Google Gemini.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setObservableInput('8.8.8.8');
                    setSelectedInvestigationId('');
                    analyzeMutation.mutate({ indicatorValue: '8.8.8.8' });
                  }}
                  className="px-4 py-2 bg-soc-accent hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs inline-flex items-center gap-2 transition-all shadow-md shadow-soc-accent/10"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyze 8.8.8.8 (Google Public DNS)
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* History View */
        <div className="bg-soc-panel border border-soc-border rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-soc-border">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-soc-accent" />
                Historical AI Threat Assessments
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Past threat intelligence analyses generated by Google Gemini and persisted in PostgreSQL.
              </p>
            </div>
            <button
              onClick={() => refetchHistory()}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {isLoadingHistory ? (
            <TableSkeleton rows={5} />
          ) : historyList.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No historical analyses recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-soc-border text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Observable</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3">Risk Level</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-soc-border/50 text-xs">
                  {historyList.map((item) => (
                    <tr key={item.id} className="hover:bg-soc-base/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-mono font-medium text-white flex items-center gap-1.5">
                          <span>{item.indicator_value}</span>
                          <span className="text-[10px] text-slate-400 uppercase">({item.ioc_type})</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-[200px] truncate">
                        {item.threat_classification}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase ${getRiskColor(
                            item.risk_level
                          )}`}
                        >
                          {item.risk_level}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-soc-accent">{item.confidence_score}%</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{item.model_name}</td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => loadHistoryDetail(item.id)}
                          className="px-2.5 py-1 text-xs bg-soc-base hover:bg-slate-800 border border-soc-border text-slate-200 rounded transition-colors inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
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
    </div>
  );
};
export default AIAnalyst;
