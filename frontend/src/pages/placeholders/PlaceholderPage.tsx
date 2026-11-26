import React from 'react';
import { LucideIcon, Construction } from 'lucide-react';

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
  return (
    <div className="space-y-6">
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-cyan-950/60 border border-cyan-800 rounded-xl text-cyan-400">
            <Icon className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{title}</h1>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                {phase}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono uppercase">{moduleName}</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 max-w-2xl leading-relaxed mb-6">{description}</p>

        <div className="border-t border-slate-800 pt-6">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-slate-400 mb-3">
            <Construction className="w-4 h-4 text-amber-400" />
            <span>Architecture & Roadmap Design Specifications</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plannedFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-[#0B0F19] border border-slate-800 text-xs text-slate-300 flex items-center gap-2.5 font-mono"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
