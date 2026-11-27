import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookmarkCheck,
  Plus,
  Trash2,
  Search,
  Copy,
  Check,
  X,
  Target,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Watchlist, WatchlistIndicator } from '../types';
import { IOCTypePill, SeverityBadge } from '../components/common/Badges';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { ToastContainer, ToastMessage } from '../components/common/Toast';
import { formatApiError } from '../utils/errors';

export const Watchlists: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddIndicatorModal, setShowAddIndicatorModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form states
  const [newWlName, setNewWlName] = useState('');
  const [newWlCategory, setNewWlCategory] = useState('Ransomware Campaign');
  const [newWlSeverity, setNewWlSeverity] = useState('critical');
  const [newWlDesc, setNewWlDesc] = useState('');

  const [newIndValue, setNewIndValue] = useState('');
  const [newIndNotes, setNewIndNotes] = useState('');
  const [newIndSeverity, setNewIndSeverity] = useState('critical');
  const [newIndExpires, setNewIndExpires] = useState('');

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: ToastMessage['type'], title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // 1. Fetch Watchlists
  const { data: watchlists = [], isLoading: isLoadingWatchlists } = useQuery<Watchlist[]>({
    queryKey: ['watchlists'],
    queryFn: async () => {
      const res = await apiClient.get<Watchlist[]>('/watchlists/');
      return res.data;
    },
  });

  // 2. Fetch Selected Watchlist Detail
  const { data: selectedWatchlist, isLoading: isLoadingDetail } = useQuery<Watchlist>({
    queryKey: ['watchlist-detail', selectedWatchlistId],
    queryFn: async () => {
      const res = await apiClient.get<Watchlist>(`/watchlists/${selectedWatchlistId}`);
      return res.data;
    },
    enabled: !!selectedWatchlistId,
  });

  // 3. Create Watchlist Mutation
  const createWlMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<Watchlist>('/watchlists/', {
        name: newWlName.trim(),
        category: newWlCategory,
        severity: newWlSeverity,
        description: newWlDesc.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setShowCreateModal(false);
      setNewWlName('');
      setNewWlDesc('');
      setSelectedWatchlistId(data.id);
      addToast('success', 'Watchlist Created', `Created watchlist "${data.name}"`);
    },
    onError: (err: any) => addToast('error', 'Failed to Create Watchlist', formatApiError(err)),
  });

  // 4. Delete Watchlist Mutation
  const deleteWlMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/watchlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setSelectedWatchlistId(null);
      addToast('info', 'Watchlist Deleted');
    },
    onError: (err: any) => addToast('error', 'Failed to Delete Watchlist', formatApiError(err)),
  });

  // 5. Add Indicator Mutation
  const addIndicatorMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWatchlistId) return;
      const res = await apiClient.post<WatchlistIndicator>(`/watchlists/${selectedWatchlistId}/indicators`, {
        indicator_value: newIndValue.trim(),
        severity: newIndSeverity,
        notes: newIndNotes.trim() || undefined,
        expires_at: newIndExpires ? new Date(newIndExpires).toISOString() : undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-detail', selectedWatchlistId] });
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      setShowAddIndicatorModal(false);
      setNewIndValue('');
      setNewIndNotes('');
      setNewIndExpires('');
      addToast('success', 'Indicator Added', `Added ${data?.indicator_value} to watchlist`);
    },
    onError: (err: any) => addToast('error', 'Failed to Add Indicator', formatApiError(err)),
  });

  // 6. Delete Indicator Mutation
  const deleteIndicatorMutation = useMutation({
    mutationFn: async (indicatorId: string) => {
      if (!selectedWatchlistId) return;
      await apiClient.delete(`/watchlists/${selectedWatchlistId}/indicators/${indicatorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-detail', selectedWatchlistId] });
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      addToast('info', 'Indicator Removed');
    },
    onError: (err: any) => addToast('error', 'Failed to Remove Indicator', formatApiError(err)),
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    addToast('info', 'Copied to Clipboard');
  };

  const filteredWatchlists = watchlists.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={(id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-soc-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <BookmarkCheck className="w-6 h-6 text-soc-accent" />
              Targeted Threat Watchlists
            </h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Active Monitoring
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Track high-priority adversary campaigns, VIP endpoints, and detect matches across investigations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-soc-accent hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center gap-2 transition-all shadow-md shadow-soc-accent/10"
        >
          <Plus className="w-4 h-4" />
          <span>New Watchlist</span>
        </button>
      </div>

      {/* Layout Grid: Watchlist Selector (Left) & Active Watchlist View (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Watchlist Collections Column */}
        <div className="lg:col-span-4 bg-soc-panel border border-soc-border rounded-xl p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Watchlists ({watchlists.length})
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">PostgreSQL Backed</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search watchlists..."
              className="w-full bg-soc-base border border-soc-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-soc-accent"
            />
          </div>

          {isLoadingWatchlists ? (
            <TableSkeleton rows={4} />
          ) : filteredWatchlists.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-soc-border rounded-lg">
              No watchlists created yet. Click "New Watchlist" to start tracking.
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredWatchlists.map((wl) => {
                const isSelected = selectedWatchlistId === wl.id;
                return (
                  <div
                    key={wl.id}
                    onClick={() => setSelectedWatchlistId(wl.id)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-soc-accent/10 border-soc-accent/40 shadow-sm'
                        : 'bg-soc-base border-soc-border/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-xs text-white group-hover:text-soc-accent transition-colors">
                        {wl.name}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded uppercase bg-slate-800 text-slate-400">
                        {wl.severity}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">{wl.category}</div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 mt-2 border-t border-soc-border/40">
                      <span>{wl.indicators_count} indicators</span>
                      <span className="text-amber-400 font-semibold">{wl.total_matches} hits</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Watchlist Details Column */}
        <div className="lg:col-span-8 space-y-4">
          {selectedWatchlist ? (
            <div className="bg-soc-panel border border-soc-border rounded-xl p-5 shadow-lg space-y-5">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-soc-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{selectedWatchlist.name}</h2>
                    <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      {selectedWatchlist.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Category: <strong className="text-slate-200">{selectedWatchlist.category}</strong> •{' '}
                    {selectedWatchlist.description || 'Targeted threat indicator monitoring.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddIndicatorModal(true)}
                    className="px-3 py-1.5 bg-soc-accent hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Observable</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this entire watchlist and all monitored indicators?')) {
                        deleteWlMutation.mutate(selectedWatchlist.id);
                      }
                    }}
                    className="p-1.5 bg-soc-base hover:bg-rose-950/40 border border-soc-border hover:border-rose-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                    title="Delete Watchlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Indicators Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-soc-accent" />
                    Monitored Indicators ({selectedWatchlist.indicators?.length || 0})
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">Auto-matches against new investigations</span>
                </div>

                {isLoadingDetail ? (
                  <TableSkeleton rows={4} />
                ) : !selectedWatchlist.indicators || selectedWatchlist.indicators.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-soc-border rounded-lg space-y-2">
                    <p>No indicators added to this watchlist yet.</p>
                    <button
                      type="button"
                      onClick={() => setShowAddIndicatorModal(true)}
                      className="px-3 py-1.5 bg-soc-base border border-soc-border hover:border-soc-accent text-slate-200 rounded text-xs transition-colors"
                    >
                      Add First Indicator
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-soc-border rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-soc-base/50 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-soc-border">
                          <th className="py-2.5 px-3">Observable</th>
                          <th className="py-2.5 px-2">Type</th>
                          <th className="py-2.5 px-2">Severity</th>
                          <th className="py-2.5 px-2">Status</th>
                          <th className="py-2.5 px-2">Matches</th>
                          <th className="py-2.5 px-2">Expires</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-soc-border/50">
                        {selectedWatchlist.indicators.map((ind) => (
                          <tr key={ind.id} className="hover:bg-soc-base/60 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-medium text-white max-w-[200px]">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate" title={ind.indicator_value}>
                                  {ind.indicator_value}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(ind.indicator_value, ind.id)}
                                  className="text-slate-500 hover:text-white"
                                >
                                  {copiedKey === ind.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                              {ind.notes && <div className="text-[10px] text-slate-400 truncate">{ind.notes}</div>}
                            </td>

                            <td className="py-2.5 px-2">
                              <IOCTypePill type={ind.ioc_type as any} />
                            </td>

                            <td className="py-2.5 px-2">
                              <SeverityBadge severity={ind.severity as any} />
                            </td>

                            <td className="py-2.5 px-2">
                              <span
                                className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                                  ind.status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                }`}
                              >
                                {ind.status}
                              </span>
                            </td>

                            <td className="py-2.5 px-2 font-mono text-amber-400 font-semibold">
                              {ind.matches_count} hits
                            </td>

                            <td className="py-2.5 px-2 font-mono text-[11px] text-slate-400">
                              {ind.expires_at ? new Date(ind.expires_at).toLocaleDateString() : 'Permanent'}
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/ioc-search?q=${encodeURIComponent(ind.indicator_value)}`)}
                                  className="p-1 text-slate-400 hover:text-soc-accent rounded hover:bg-slate-800"
                                  title="Investigate Observable"
                                >
                                  <Search className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteIndicatorMutation.mutate(ind.id)}
                                  className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                                  title="Delete Indicator"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-soc-panel border border-soc-border rounded-xl p-12 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-soc-base border border-soc-border text-slate-400">
                <BookmarkCheck className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-white">Select a Watchlist</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Choose a targeted threat watchlist from the left panel to inspect monitored indicators or create a new
                campaign watchlist.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Watchlist */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-soc-panel border border-soc-border rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-soc-border">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-soc-accent" />
                Create New Watchlist
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Watchlist Name</label>
                <input
                  type="text"
                  value={newWlName}
                  onChange={(e) => setNewWlName(e.target.value)}
                  placeholder="e.g. Cobalt Strike Active Beacons"
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white font-mono focus:border-soc-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Threat Category</label>
                <select
                  value={newWlCategory}
                  onChange={(e) => setNewWlCategory(e.target.value)}
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white focus:border-soc-accent focus:outline-none"
                >
                  <option value="Ransomware Campaign">Ransomware Campaign</option>
                  <option value="VIP & Executive Assets">VIP & Executive Assets</option>
                  <option value="Critical Infrastructure">Critical Infrastructure</option>
                  <option value="APT Actor Infrastructure">APT Actor Infrastructure</option>
                  <option value="Internal Threat Monitoring">Internal Threat Monitoring</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Default Alert Severity</label>
                <select
                  value={newWlSeverity}
                  onChange={(e) => setNewWlSeverity(e.target.value)}
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white focus:border-soc-accent focus:outline-none font-mono uppercase"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Description</label>
                <textarea
                  value={newWlDesc}
                  onChange={(e) => setNewWlDesc(e.target.value)}
                  placeholder="Operational notes regarding this tracking set..."
                  rows={3}
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white focus:border-soc-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-soc-border">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 bg-soc-base border border-soc-border rounded-lg text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createWlMutation.mutate()}
                disabled={!newWlName.trim() || createWlMutation.isPending}
                className="px-4 py-1.5 bg-soc-accent text-slate-950 font-semibold rounded-lg text-xs disabled:opacity-50"
              >
                {createWlMutation.isPending ? 'Creating...' : 'Create Watchlist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Indicator to Watchlist */}
      {showAddIndicatorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-soc-panel border border-soc-border rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-soc-border">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-soc-accent" />
                Add Monitored Observable
              </h3>
              <button
                type="button"
                onClick={() => setShowAddIndicatorModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Observable (IP / Domain / Hash / URL)</label>
                <input
                  type="text"
                  value={newIndValue}
                  onChange={(e) => setNewIndValue(e.target.value)}
                  placeholder="e.g. 198.51.100.24, evil.com, hash..."
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white font-mono focus:border-soc-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Severity Rating</label>
                <select
                  value={newIndSeverity}
                  onChange={(e) => setNewIndSeverity(e.target.value)}
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white focus:border-soc-accent focus:outline-none font-mono uppercase"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={newIndExpires}
                  onChange={(e) => setNewIndExpires(e.target.value)}
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white font-mono focus:border-soc-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Analyst Notes</label>
                <textarea
                  value={newIndNotes}
                  onChange={(e) => setNewIndNotes(e.target.value)}
                  placeholder="Specific campaign context, sighting source, or ticket reference..."
                  rows={2}
                  className="w-full bg-soc-base border border-soc-border rounded-lg p-2.5 text-white focus:border-soc-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-soc-border">
              <button
                type="button"
                onClick={() => setShowAddIndicatorModal(false)}
                className="px-3 py-1.5 bg-soc-base border border-soc-border rounded-lg text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => addIndicatorMutation.mutate()}
                disabled={!newIndValue.trim() || addIndicatorMutation.isPending}
                className="px-4 py-1.5 bg-soc-accent text-slate-950 font-semibold rounded-lg text-xs disabled:opacity-50"
              >
                {addIndicatorMutation.isPending ? 'Adding...' : 'Add to Watchlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Watchlists;
