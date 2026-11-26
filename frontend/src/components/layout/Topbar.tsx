import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon, Shield } from 'lucide-react';

export const Topbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-[#0D1322] border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase text-slate-400">Environment:</span>
          <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
            PROD-SOC
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 pr-4 border-r border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-slate-200">{user?.username || 'Analyst'}</div>
            <div className="flex items-center gap-1 text-[11px] text-cyan-400">
              <Shield className="w-3 h-3" />
              <span>{user?.roles?.join(', ') || 'Analyst'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded border border-transparent hover:border-red-900 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          <span>Exit SOC</span>
        </button>
      </div>
    </header>
  );
};
