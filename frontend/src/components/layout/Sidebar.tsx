import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldAlert,
  LayoutDashboard,
  Search,
  Briefcase,
  Radio,
  Cpu,
  AlertTriangle,
  BookmarkCheck,
  FileText,
  History,
  Sliders,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavSection {
  title: string;
  items: {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    phase2?: boolean;
  }[];
}

const navSections: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { name: 'SOC Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'IOC Investigation', path: '/ioc-search', icon: Search },
      { name: 'Case Management', path: '/investigations', icon: Briefcase },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { name: 'Threat Intel Feed', path: '/threat-intel', icon: Radio, phase2: true },
      { name: 'AI Threat Analyst', path: '/ai-analyst', icon: Cpu, phase2: true },
      { name: 'Threat Watchlists', path: '/watchlists', icon: BookmarkCheck, phase2: true },
    ],
  },
  {
    title: 'Management',
    items: [
      { name: 'Security Alerts', path: '/alerts', icon: AlertTriangle, phase2: true },
      { name: 'Threat Reports', path: '/reports', icon: FileText, phase2: true },
      { name: 'Audit Trail', path: '/audit-logs', icon: History, phase2: true },
      { name: 'SOC Policies', path: '/settings', icon: Sliders, phase2: true },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 bg-soc-surface border-r border-soc-border flex flex-col justify-between shrink-0 transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-soc-border shrink-0 bg-soc-card/50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-soc-accent/10 border border-soc-accent/30 rounded-lg text-soc-accent shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="font-bold tracking-wider text-white text-sm font-mono truncate">
                  THREATNEX
                </div>
                <div className="text-[10px] text-soc-accent font-mono tracking-widest uppercase truncate">
                  Enterprise SOC
                </div>
              </div>
            )}
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!collapsed && (
                <div className="px-3 text-[10px] font-mono uppercase tracking-widest text-slate-500 font-semibold mb-2">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative ${
                      isActive
                        ? 'bg-soc-accent/10 text-soc-accent border border-soc-accent/30 shadow-soc-subtle font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                    } ${collapsed ? 'justify-center px-0' : ''}`
                  }
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  {!collapsed && <span className="flex-1 truncate">{item.name}</span>}
                  {!collapsed && item.phase2 && (
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800 shrink-0">
                      Phase 2
                    </span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1 bg-soc-elevated border border-soc-border text-white text-xs rounded-md shadow-soc-elevated whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                      {item.name} {item.phase2 && '(Phase 2)'}
                    </div>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Footer: Live Engine Status & Collapse Toggle */}
        <div className="p-3 border-t border-soc-border bg-soc-card/30 shrink-0 space-y-2">
          {!collapsed ? (
            <div className="flex items-center justify-between px-3 py-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold tracking-wider">SOC ONLINE</span>
              </div>
              <span className="text-[10px] text-slate-400">12ms</span>
            </div>
          ) : (
            <div className="flex justify-center py-2" title="SOC ENGINE ONLINE">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}

          {/* Collapse desktop toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-full py-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors text-xs font-mono"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
};
