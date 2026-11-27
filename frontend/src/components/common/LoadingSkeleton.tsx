import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-soc-card border border-soc-border rounded-xl p-5 h-36 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="h-3 w-24 bg-slate-800 rounded"></div>
              <div className="h-7 w-7 bg-slate-800 rounded-lg"></div>
            </div>
            <div className="h-8 w-16 bg-slate-800 rounded"></div>
          </div>
          <div className="h-3 w-36 bg-slate-800 rounded"></div>
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 bg-slate-900 border border-soc-border rounded-lg"></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-soc-surface border border-soc-borderSubtle rounded-lg flex items-center px-4 justify-between">
          <div className="flex items-center gap-3 w-1/3">
            <div className="h-4 w-12 bg-slate-800 rounded"></div>
            <div className="h-4 w-40 bg-slate-800 rounded"></div>
          </div>
          <div className="h-4 w-20 bg-slate-800 rounded"></div>
          <div className="h-4 w-28 bg-slate-800 rounded"></div>
          <div className="h-5 w-16 bg-slate-800 rounded"></div>
        </div>
      ))}
    </div>
  );
};

export const DetailsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-28 bg-soc-card border border-soc-border rounded-xl p-6"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 h-72 bg-soc-card border border-soc-border rounded-xl"></div>
        <div className="h-72 bg-soc-card border border-soc-border rounded-xl"></div>
      </div>
    </div>
  );
};
