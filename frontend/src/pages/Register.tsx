import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, User, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { apiClient } from '../api/client';

export const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError('Password must contain at least 12 characters according to SOC policy.');
      return;
    }

    setLoading(true);

    try {
      await apiClient.post('/auth/register', {
        username: username.trim(),
        email: email.trim(),
        full_name: fullName.trim() || null,
        password,
      });

      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register operator credentials.');
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
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-white font-mono">ENROLL OPERATOR</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-widest text-[10px]">
            Security Operations Center Onboarding
          </p>
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
            <label className="block uppercase text-slate-400 mb-1.5 font-semibold">Username *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="analyst_smith"
                className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block uppercase text-slate-400 mb-1.5 font-semibold">Official Email *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@threatnex.org"
                className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block uppercase text-slate-400 mb-1.5 font-semibold">Full Name (Optional)</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Analyst Name"
              className="w-full bg-soc-base border border-soc-border focus:border-soc-accent rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block uppercase text-slate-400 font-semibold">Passphrase *</label>
              <span className="text-[10px] text-slate-500">Min 12 characters</span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                minLength={12}
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
                <span>Enroll Credentials</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="pt-4 border-t border-soc-border flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Already registered?</span>
          <Link to="/login" className="text-soc-accent hover:underline">
            Authenticate Session
          </Link>
        </div>
      </div>
    </div>
  );
};
