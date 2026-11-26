import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Radio,
  Cpu,
  ShieldAlert,
  BookmarkCheck,
  FileText,
  Sliders,
  History,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { IOCInvestigation } from './pages/IOCInvestigation';
import { Investigations } from './pages/Investigations';
import { PlaceholderPage } from './pages/placeholders/PlaceholderPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B0F19] text-cyan-400">
        <span className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Core Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ioc-search"
              element={
                <ProtectedRoute>
                  <IOCInvestigation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/investigations"
              element={
                <ProtectedRoute>
                  <Investigations />
                </ProtectedRoute>
              }
            />

            {/* Designed Module Placeholders */}
            <Route
              path="/threat-intel"
              element={
                <ProtectedRoute>
                  <PlaceholderPage
                    title="Threat Intelligence Feed Integration"
                    moduleName="Module 4: Provider Integration & Aggregation"
                    phase="Phase 2 Scheduled"
                    icon={Radio}
                    description="Independent feed adapter integration engine for VirusTotal API v3, AbuseIPDB, AlienVault OTX, URLhaus, urlscan.io, and CISA Known Exploited Vulnerabilities (KEV)."
                    plannedFeatures={[
                      'Asynchronous provider adapter interface with circuit breaker',
                      'Rate-limit backoff and Redis-based cached reputation lookups',
                      'Strict validation of external provider JSON payloads as untrusted data',
                      'Configurable API secret key management isolated from client browsers',
                    ]}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-analyst"
              element={
                <ProtectedRoute>
                  <PlaceholderPage
                    title="AI Cyber Threat Analyst"
                    moduleName="Module 8: Autonomous Threat Reasoning"
                    phase="Phase 2 Scheduled"
                    icon={Cpu}
                    description="Provider-independent AI threat analyst architecture capable of synthesizing structured IOC evidence, evaluating risk scores, identifying lateral movement patterns, and generating MITRE ATT&CK mappings."
                    plannedFeatures={[
                      'Structured prompt reasoning framework on confirmed threat evidence',
                      'Anti-hallucination guardrails: Never fabricates CVEs or fake threat actors',
                      'Severity explanation and recommended incident response triage steps',
                      'Strict differentiation between verified telemetry and hypothetical findings',
                    ]}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <PlaceholderPage
                    title="SOC Alert Management"
                    moduleName="Module 11: Alert Ingestion & Correlation"
                    phase="Phase 2 Scheduled"
                    icon={ShieldAlert}
                    description="Real-time alert aggregation engine designed to ingest detections, deduplicate noise, correlate multi-source events, and escalate alerts into formal investigations."
                    plannedFeatures={[
                      'Configurable alert severity threshold rules',
                      'Automatic correlation with recorded IOC inventory',
                      'One-click alert escalation into formal investigation cases',
                      'Webhook and SIEM connector ingestion points',
                    ]}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/watchlists"
              element={
                <ProtectedRoute>
                  <PlaceholderPage
                    title="Targeted Threat Watchlists"
                    moduleName="Module 13: Watchlist Monitoring Engine"
                    phase="Phase 2 Scheduled"
                    icon={BookmarkCheck}
                    description="High-priority indicator tracking service for continuous automated monitoring of VIP assets, critical infrastructure endpoints, and active APT campaigns."
                    plannedFeatures={[
                      'Dynamic watchlist collections (Campaign, Actor, Infrastructure)',
                      'Automated notification triggers upon watchlist indicator hits',
                      'Indicator expiration, lifecycle status, and retirement rules',
                      'Bulk STIX/CSV import and export capabilities',
                    ]}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <PlaceholderPage
                    title="Threat Intelligence Reporting"
                    moduleName="Module 12: Executive & Technical Intelligence Reports"
                    phase="Phase 2 Scheduled"
                    icon={FileText}
                    description="Comprehensive reporting engine generating formal incident post-mortems, threat briefing documents, executive summaries, and STIX 2.1 bundles."
                    plannedFeatures={[
                      'Export to PDF, Markdown, and machine-readable STIX 2.1 JSON',
                      'Executive summary cards with verified risk score breakdowns',
                      'Audit-compliant case timeline generation with analyst notes',
                      'Cryptographic report signing for evidentiary integrity',
                    ]}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute>
                  <PlaceholderPage
                    title="SOC Compliance Audit Trail"
                    moduleName="Module 14: System & Security Audit"
                    phase="Phase 2 Scheduled"
                    icon={History}
                    description="Immutable audit trail capturing all user authentication events, investigation updates, IOC creations, and administrative actions for SOC2 and ISO 27001 compliance."
                    plannedFeatures={[
                      'Admin RBAC protected log viewing interface',
                      'Detailed IP address, user-agent, and actor tracking',
                      'Tamper-evident log record storage',
                      'Export capability for external SIEM retention',
                    ]}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <PlaceholderPage
                    title="Platform Settings & SOC Policies"
                    moduleName="System Configuration"
                    phase="Phase 2 Scheduled"
                    icon={Sliders}
                    description="Administrative configuration for role-based access control, provider API key management, risk score weighting matrices, and system environment variables."
                    plannedFeatures={[
                      'Role & permission assignment (Admin, Lead Analyst, Tier 1/2/3)',
                      'Encrypted external threat provider credential storage',
                      'Configurable threat scoring weight sliders (Detection, Freshness, Confidence)',
                      'Session security policies and token expiration settings',
                    ]}
                  />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
export default App;
