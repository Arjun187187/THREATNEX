import React from 'react';
import { LucideIcon, ArrowLeft, Shield, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PlaceholderPageProps {
  title: string;
  moduleName: string;
  phase: string;
  icon: LucideIcon;
  description: string;
  plannedFeatures: string[];
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  moduleName,
  phase,
  icon: Icon,
  description,
  plannedFeatures,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Module Overview Card */}
      <div className="bg-soc-surface border border-soc-border rounded-xl p-6 lg:p-8 shadow-soc-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-soc-border">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-soc-accent/10 border border-soc-accent/30 rounded-xl text-soc-accent shrink-0 mt-1">
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-lg lg:text-xl font-bold text-white tracking-wide">{title}</h1>
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800">
                  {phase}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-soc-base text-slate-400 border border-soc-borderSubtle">
                  In Active Development
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">{moduleName}</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-soc-card border border-soc-border hover:border-soc-borderLight text-xs font-mono text-slate-300 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to SOC Command</span>
          </button>
        </div>

        {/* Narrative Description */}
        <div className="max-w-3xl space-y-2">
          <div className="text-[11px] font-mono uppercase text-slate-500 font-semibold">
            Module Architecture & Scope
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">{description}</p>
        </div>

        {/* Planned Features & Architecture Specifications */}
        <div className="border-t border-soc-border pt-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-slate-400 font-semibold">
            <Terminal className="w-4 h-4 text-soc-accent" />
            <span>Phase 2 Implementation Specifications & Roadmap</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plannedFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-soc-base border border-soc-borderSubtle text-xs text-slate-300 flex items-start gap-3 font-mono"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-soc-accent mt-1.5 shrink-0" />
                <span className="leading-relaxed">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Development Status Notice */}
        <div className="p-4 rounded-xl bg-soc-card/50 border border-soc-borderSubtle flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Phase 1B Core Security & Telemetry Engine: Verified & Locked</span>
          </div>
          <span className="text-[11px] text-slate-500">Scheduled for Phase 2 Rollout</span>
        </div>
      </div>
    </div>
  );
};
