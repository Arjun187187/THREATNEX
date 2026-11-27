import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { IOCInvestigation } from './pages/IOCInvestigation';
import { Investigations } from './pages/Investigations';
import { AIAnalyst } from './pages/AIAnalyst';
import { ThreatIntelFeed } from './pages/ThreatIntelFeed';
import { Watchlists } from './pages/Watchlists';
import { Alerts } from './pages/Alerts';
import { Reports } from './pages/Reports';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';

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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-soc-base text-soc-accent gap-3">
        <span className="w-8 h-8 border-2 border-soc-accent/20 border-t-soc-accent rounded-full animate-spin" />
        <span className="font-mono text-xs uppercase tracking-widest text-slate-400">Initializing SOC Session...</span>
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

            {/* Core Operations Routes */}
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

            {/* Intelligence Routes */}
            <Route
              path="/threat-intel"
              element={
                <ProtectedRoute>
                  <ThreatIntelFeed />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai-analyst"
              element={
                <ProtectedRoute>
                  <AIAnalyst />
                </ProtectedRoute>
              }
            />
            <Route
              path="/watchlists"
              element={
                <ProtectedRoute>
                  <Watchlists />
                </ProtectedRoute>
              }
            />

            {/* Management & Governance Routes */}
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <Alerts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
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
