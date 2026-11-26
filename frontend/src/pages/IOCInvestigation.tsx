import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Search,
  CheckCircle2,
  XCircle,
  Shield,
  Layers,
  ArrowRight,
  Database,
  PlusCircle,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { IOCValidationResult, Indicator, IOCType } from '../types';
import { IOCTypePill } from '../components/common/Badges';
import { EmptyState } from '../components/common/EmptyState';

export const IOCInvestigation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [iocInput, setIocInput] = useState(initialQ);
  const [validationResult, setValidationResult] = useState<IOCValidationResult | null>(null);

  // Validate IOC mutation
  const validateMutation = useMutation({
    mutationFn: async (val: string) => {
      const res = await apiClient.post<IOCValidationResult>('/indicators/validate', {
        value: val,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setValidationResult(data);
    },
  });

  // Save IOC mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { value: string; ioc_type?: IOCType; description?: string }) => {
      const res = await apiClient.post('/indicators/', data);
      return res.data;
    },
  });

  // Search existing stored indicators matching query
  const { data: searchResults, refetch: refetchSearch } = useQuery<Indicator[]>({
    queryKey: ['ioc-search-results', iocInput],
    queryFn: async () => {
      if (!iocInput.trim()) return [];
      try {
        const res = await apiClient.get<Indicator[]>(`/indicators/search?q=${encodeURIComponent(iocInput.trim())}`);
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: !!iocInput.trim(),
  });

  useEffect(() => {
    if (initialQ) {
      validateMutation.mutate(initialQ);
    }
  }, [initialQ]);

  const handleInspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (iocInput.trim()) {
      validateMutation.mutate(iocInput.trim());
      refetchSearch();
    }
  };

  const handleSaveToInventory = async () => {
    if (validationResult && validationResult.is_valid) {
      await saveMutation.mutateAsync({
        value: validationResult.value,
        ioc_type: validationResult.ioc_type || undefined,
        description: 'Validated during SOC triage session',
      });
      refetchSearch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-wide">IOC Investigation & Validation</h1>
        <p className="text-xs text-slate-400 mt-1">
          Parse, validate structural syntax, and inventory indicators across IPv4, IPv6, Domains, URLs, Hashes (MD5, SHA1, SHA256), and CVEs.
        </p>
      </div>

      {/* Validation Input Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-lg">
        <form onSubmit={handleInspect} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
              Indicator of Compromise (Raw Input)
            </label>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={iocInput}
                onChange={(e) => setIocInput(e.target.value)}
                placeholder="e.g. 198.51.100.24, CVE-2024-38077, or e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                className="w-full bg-[#0B0F19] border border-slate-700 focus:border-cyan-500 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={validateMutation.isPending || !iocInput.trim()}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-lg transition-all"
            >
              {validateMutation.isPending ? (
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>Validate Pattern</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Validation Result Inspection Card */}
        {validationResult && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                validationResult.is_valid
                  ? 'bg-emerald-950/20 border-emerald-800/80 text-emerald-300'
                  : 'bg-red-950/20 border-red-800/80 text-red-300'
              }`}
            >
              <div className="flex items-start gap-3">
                {validationResult.is_valid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-sm font-semibold text-slate-100 font-mono">
                    {validationResult.value}
                  </div>
                  <div className="text-xs mt-1 text-slate-300">{validationResult.message}</div>
                  {validationResult.ioc_type && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Identified Type:</span>
                      <IOCTypePill type={validationResult.ioc_type} />
                    </div>
                  )}
                </div>
              </div>

              {validationResult.is_valid && (
                <button
                  onClick={handleSaveToInventory}
                  disabled={saveMutation.isPending || saveMutation.isSuccess}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-600 flex items-center gap-1.5 transition-all shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {saveMutation.isSuccess ? 'Saved to Inventory' : 'Save to Inventory'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Database Matching Indicators List */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-800">
          <Database className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Recorded Indicators Matching Query
          </h2>
        </div>

        {!searchResults || searchResults.length === 0 ? (
          <EmptyState
            title="No matching IOCs in database"
            description="No matching indicators found for the current query. Validate and save new indicators above to record them in your threat database."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B0F19] text-slate-400 font-mono uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">IOC Value</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Recorded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {searchResults.map((ind) => (
                  <tr key={ind.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-200 font-semibold">{ind.value}</td>
                    <td className="py-3 px-4">
                      <IOCTypePill type={ind.ioc_type} />
                    </td>
                    <td className="py-3 px-4 uppercase text-slate-300">{ind.severity}</td>
                    <td className="py-3 px-4 text-slate-300">{ind.confidence}%</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(ind.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
