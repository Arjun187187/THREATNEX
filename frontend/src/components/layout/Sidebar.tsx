import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldAlert,
  LayoutDashboard,
  Search,
  Briefcase,
  Cpu,
  Radio,
  FileText,
  BookmarkCheck,
  History,
  Sliders,
} from 'lucide-react';

const navItems = [
  { name: 'SOC Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'IOC Investigation', path: '/ioc-search', icon: Search },
  { name: 'Investigations', path: '/investigations', icon: Briefcase },
  { name: 'Threat Intel Feed', path: '/threat-intel', icon: Radio, placeholder: true },
  { name: 'AI Threat Analyst', path: '/ai-analyst', icon: Cpu, placeholder: true },
  { name: 'Alerts', path: '/alerts', icon: ShieldAlert, placeholder: true },
  { name: 'Watchlists', path: '/watchlists', icon: BookmarkCheck, placeholder: true },
  { name: 'Reports', path: '/reports', icon: FileText, placeholder: true },
  { name: 'Audit Logs', path: '/audit-logs', icon: History, placeholder: true },
  { name: 'Settings', path: '/settings', icon: Sliders, placeholder: true },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-[#0D1322] border-r border-slate-800 flex flex-col justify-between shrink-0">
      <div>
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800">
          <div className="p-2 bg-cyan-950 border border-cyan-800 rounded-lg text-cyan-400">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="font-bold tracking-wider text-white text-base">THREATNEX</div>
            <div className="text-[10px] text-cyan-500 font-mono tracking-widest uppercase">SecOps Platform</div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.name}</span>
              {item.placeholder && (
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Ph2
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>SOC ENGINE ONLINE</span>
        </div>
      </div>
    </aside>
  );
};
