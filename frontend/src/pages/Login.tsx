import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AuthTokens, User as UserType } from '../types';

export const Login: React.FC = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiClient.post<AuthTokens>('/auth/login', {
        username_or_email: usernameOrEmail.trim(),
        password,
      });

      // Fetch user profile via HttpOnly cookie session
      const userRes = await apiClient.get<UserType>('/auth/me');
      login(userRes.data);
      navigate('/');
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          'Authentication rejected. Verify credentials or check rate-limit backoff.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-soc-base bg-soc-grid px-4 py-8">
      <div className="w-full max-w-md bg-soc-surface border border-soc-border rounded-2xl shadow-soc-elevated p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="p-3 bg-soc-accent/10 border border-soc-accent/30 rounded-xl text-soc-accent mb-3 shadow-soc-subtle">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-white font-mono">THREATNEX SOC</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-widest text-[10px]">
            Enterprise Cyber Threat Intelligence Command
          </p>
        </div>

        {/* Security Notice Banner */}
        <div className="px-3.5 py-2.5 rounded-lg bg-soc-card border border-soc-borderSubtle flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-soc-accent" />
            <span>Authorized Personnel Only</span>
          </div>
          <span className="text-emerald-400 text-[10px] font-semibold">TLS / HTTPONLY</span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="font-sans leading-relaxed">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block uppercase text-slate-400 mb-1.5 font-semibold">
              Operator Identifier / Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="secops_lead or analyst@threatnex.org"
                className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block uppercase text-slate-400 font-semibold">
                Passphrase
              </label>
              <span className="text-[10px] text-slate-500">Argon2id Encrypted</span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-soc-accent hover:bg-soc-accentHover disabled:opacity-50 text-white font-medium text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-soc-subtle transition-all"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Authenticate Session</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="pt-4 border-t border-soc-border flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Need operator access?</span>
          <Link to="/register" className="text-soc-accent hover:underline">
            Register Operator
          </Link>
        </div>
      </div>
    </div>
  );
};
