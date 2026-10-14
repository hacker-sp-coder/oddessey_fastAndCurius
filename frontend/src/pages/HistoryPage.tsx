import React, { useState, useMemo } from 'react';
import { PitchRecord } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { api } from '../api/client.js';
import { formatFileSize } from '../utils/formatters.js';
import { 
  Trash2, 
  FileText, 
  ArrowRight, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Filter, 
  ArrowUpDown, 
  ChevronRight
} from 'lucide-react';

interface HistoryPageProps {
  pitches: PitchRecord[];
  isLoading: boolean;
  onRefresh: () => void;
  onNavigate: (tab: string, pitchId?: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  pitches,
  isLoading,
  onRefresh,
  onNavigate
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'score_desc' | 'score_asc' | 'name_asc'>('date_desc');

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await api.deletePitch(id);
      setDeleteConfirmId(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to delete pitch.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPitches = useMemo(() => {
    return pitches
      .filter((p) => {
        // Status filter
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
        
        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          (p.startup_name && p.startup_name.toLowerCase().includes(q)) ||
          (p.industry && p.industry.toLowerCase().includes(q)) ||
          (p.target_geography && p.target_geography.toLowerCase().includes(q)) ||
          (p.original_filename && p.original_filename.toLowerCase().includes(q)) ||
          p.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === 'date_asc') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === 'score_desc') {
          return (b.overall_score ?? -1) - (a.overall_score ?? -1);
        }
        if (sortBy === 'score_asc') {
          return (a.overall_score ?? 999) - (b.overall_score ?? 999);
        }
        if (sortBy === 'name_asc') {
          return (a.startup_name || '').localeCompare(b.startup_name || '');
        }
        return 0;
      });
  }, [pitches, searchQuery, statusFilter, sortBy]);

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.025em', margin: 0 }}>
            Pitch Screening History
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Historical venture evaluations and narrative records stored locally in SQLite.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('new')}
          >
            <span>+ New Screening</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.875rem' }}>{error}</div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '0.85rem 1.15rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ flex: '1 1 260px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '32px', height: '34px', fontSize: '0.825rem' }}
              placeholder="Filter by startup name, sector, geography, filename, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={13} style={{ color: 'var(--text-dim)' }} />
            <select
              className="form-select"
              style={{ height: '34px', fontSize: '0.825rem', padding: '0 1.5rem 0 0.65rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses ({pitches.length})</option>
              <option value="COMPLETED">Completed</option>
              <option value="PROCESSING">Processing</option>
              <option value="ANALYZING">Analyzing</option>
              <option value="FAILED">Failed</option>
              <option value="QUEUED">Queued</option>
            </select>
          </div>

          {/* Sort By */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ArrowUpDown size={13} style={{ color: 'var(--text-dim)' }} />
            <select
              className="form-select"
              style={{ height: '34px', fontSize: '0.825rem', padding: '0 1.5rem 0 0.65rem' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="score_desc">Highest Viability</option>
              <option value="score_asc">Lowest Viability</option>
              <option value="name_asc">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Results summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          <span>Showing {filteredPitches.length} of {pitches.length} records</span>
          {(searchQuery || statusFilter !== 'ALL') && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {pitches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <FileText size={36} style={{ color: 'var(--text-dim)', marginBottom: '0.85rem' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
            No Pitch Screenings Recorded
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto 1.25rem' }}>
            Your research repository is currently empty. Ingest a pitch deck, media file, or pasted pitch to generate your first dossier.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('new')}>
            <span>Start First Screening</span>
            <ArrowRight size={13} />
          </button>
        </div>
      ) : filteredPitches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <Search size={32} style={{ color: 'var(--text-dim)', marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            No Matching Records Found
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginBottom: '1rem' }}>
            No pitches match your current search query or status filter.
          </p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Startup / Target</th>
                  <th>Sector & Geography</th>
                  <th>Input Format</th>
                  <th>Viability Score</th>
                  <th>Status</th>
                  <th>Screening Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPitches.map((p) => {
                  const score = p.overall_score != null ? Math.round(p.overall_score) : null;
                  const scoreColor = score != null 
                    ? (score >= 80 ? 'var(--accent-emerald)' : score >= 65 ? 'var(--accent-primary)' : score >= 50 ? 'var(--accent-amber)' : 'var(--accent-rose)')
                    : 'var(--text-dim)';

                  return (
                    <tr key={p.id}>
                      <td style={{ maxWidth: '300px', minWidth: '180px' }}>
                        <div 
                          className="truncate" 
                          title={p.startup_name || 'Untitled Pitch'} 
                          style={{ fontWeight: 700, color: 'var(--text-main)' }}
                        >
                          {p.startup_name || 'Untitled Pitch'}
                        </div>
                        <div 
                          className="truncate" 
                          title={p.original_filename || undefined} 
                          style={{ fontSize: '0.725rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}
                        >
                          {p.original_filename || 'manual transcript'} {p.file_size > 0 && `• ${formatFileSize(p.file_size)}`}
                        </div>
                        {p.error_message && (
                          <div 
                            className="truncate" 
                            title={p.error_message} 
                            style={{ fontSize: '0.7rem', color: 'var(--accent-rose)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}
                          >
                            Error: {p.error_message}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.825rem', color: 'var(--text-main)' }}>
                          {p.industry || 'Unknown Sector'}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                          {p.target_geography || 'Global'}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.725rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          {p.input_type}
                        </span>
                      </td>
                      <td>
                        {score != null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ 
                              fontWeight: 800, 
                              fontSize: '0.95rem', 
                              color: scoreColor, 
                              fontFamily: 'var(--font-mono)',
                              minWidth: '24px'
                            }}>
                              {score}
                            </span>
                            <div className="score-progress" style={{ width: '60px', height: '4px' }}>
                              <div 
                                className="score-progress-bar"
                                style={{ width: `${score}%`, background: scoreColor }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                            {p.status === 'FAILED' ? 'Failed' : 'Pending'}
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          {p.status === 'COMPLETED' ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => onNavigate('report', p.id)}
                            >
                              <span>Dossier</span>
                              <ChevronRight size={12} />
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => onNavigate('review', p.id)}
                            >
                              <span>Review</span>
                              <ChevronRight size={12} />
                            </button>
                          )}

                          {deleteConfirmId === p.id ? (
                            <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                onClick={() => handleDelete(p.id)}
                                disabled={deletingId === p.id}
                              >
                                Confirm
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.45rem', color: 'var(--text-dim)' }}
                              onClick={() => setDeleteConfirmId(p.id)}
                              title="Delete screening record"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
