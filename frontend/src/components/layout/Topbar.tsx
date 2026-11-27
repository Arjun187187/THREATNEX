import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Menu,
  Shield,
  LogOut,
  Search,
  ChevronDown,
} from 'lucide-react';

interface TopbarProps {
  onOpenMobile: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobile }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute breadcrumbs and title from route
  const getRouteDetails = (pathname: string) => {
    const map: Record<string, { title: string; category: string }> = {
      '/': { title: 'Security Operations Command', category: 'Operations' },
      '/ioc-search': { title: 'IOC Validation & Inspection', category: 'Operations' },
      '/investigations': { title: 'Case Management & Triage', category: 'Operations' },
      '/threat-intel': { title: 'Threat Intelligence Feeds', category: 'Intelligence' },
      '/ai-analyst': { title: 'Autonomous AI Threat Analyst', category: 'Intelligence' },
      '/watchlists': { title: 'Threat Watchlists', category: 'Intelligence' },
      '/alerts': { title: 'Security Alerts & Events', category: 'Management' },
      '/reports': { title: 'Intelligence Reporting', category: 'Management' },
      '/audit-logs': { title: 'SOC Compliance Audit Trail', category: 'Management' },
      '/settings': { title: 'Platform Settings & Policies', category: 'Management' },
    };
    return map[pathname] || { title: 'Security Operations', category: 'THREATNEX' };
  };

  const currentDetails = getRouteDetails(location.pathname);

  return (
    <header className="h-16 bg-soc-surface border-b border-soc-border px-4 lg:px-6 flex items-center justify-between shrink-0 z-30">
      {/* Left: Hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3 lg:gap-4 overflow-hidden">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 uppercase tracking-wider truncate">
            <span>THREATNEX</span>
            <span>/</span>
            <span className="text-soc-accent/80">{currentDetails.category}</span>
          </div>
          <h1 className="text-sm lg:text-base font-bold text-white tracking-wide truncate">
            {currentDetails.title}
          </h1>
        </div>
      </div>

      {/* Right: Environment, Quick Search, Notifications, Profile */}
      <div className="flex items-center gap-3 lg:gap-4">
        {/* Quick Search Trigger */}
        <button
          onClick={() => navigate('/ioc-search')}
          className="hidden md:flex items-center gap-2.5 px-3 py-1.5 bg-soc-card border border-soc-border hover:border-soc-borderLight rounded-lg text-xs text-slate-400 transition-colors"
          title="Search or validate an IOC"
        >
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-mono text-[11px]">Inspect IOC...</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 border border-slate-700 rounded text-slate-400">
            Ctrl K
          </kbd>
        </button>

        {/* Environment Badge */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-soc-card border border-soc-border rounded-lg text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 text-[11px] font-semibold">PROD-SOC</span>
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors border border-transparent hover:border-soc-border"
          >
            <div className="w-8 h-8 rounded-lg bg-soc-accent/10 border border-soc-accent/30 flex items-center justify-center text-soc-accent font-mono font-bold text-xs">
              {user?.username?.substring(0, 2).toUpperCase() || 'OP'}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 leading-tight">
                {user?.username || 'Operator'}
              </span>
              <span className="text-[10px] font-mono text-soc-accent">
                {user?.roles?.[0] || 'Analyst'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden md:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-soc-elevated border border-soc-border rounded-xl shadow-soc-elevated p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-soc-border mb-1">
                <div className="text-xs font-semibold text-white">{user?.username}</div>
                <div className="text-[11px] font-mono text-slate-400 truncate">{user?.email}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                  <Shield className="w-3 h-3" />
                  <span>Roles: {user?.roles?.join(', ') || 'Analyst'}</span>
                </div>
              </div>

              <div className="px-3 py-1.5 text-[10px] font-mono text-slate-500">
                Session: HttpOnly Secure Cookie
              </div>

              <div className="border-t border-soc-border my-1" />

              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit SOC Session</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
