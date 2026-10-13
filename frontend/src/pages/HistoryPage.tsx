import React, { useState } from 'react';
import { PitchRecord } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { api } from '../api/client.js';
import { Trash2, FileText, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Pitch Screening History
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            All past pitch evaluations and audio/document transcripts stored locally in SQLite.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <div>{error}</div>
        </div>
      )}

      {pitches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <FileText size={40} style={{ color: 'var(--text-dim)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Screenings Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
            You haven't screened any startup pitches yet.
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('new')}>
            <span>Create New Screening</span>
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Startup Name</th>
                  <th>Target Geo / Industry</th>
                  <th>Input Format</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pitches.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{p.startup_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {p.original_filename} • {(p.file_size / 1024).toFixed(1)} KB
                      </div>
                      {p.error_message && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', marginTop: '0.2rem' }}>
                          Notice: {p.error_message.slice(0, 100)}...
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{p.industry}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{p.target_geography}</div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)'
                      }}>
                        {p.input_type}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        {p.status === 'COMPLETED' ? (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => onNavigate('report', p.id)}
                          >
                            Report
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => onNavigate('review', p.id)}
                          >
                            Review
                          </button>
                        )}

                        {deleteConfirmId === p.id ? (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => handleDelete(p.id)}
                              disabled={deletingId === p.id}
                            >
                              Confirm
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.5rem', color: 'var(--accent-rose)' }}
                            onClick={() => setDeleteConfirmId(p.id)}
                            title="Delete pitch record and associated files"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
