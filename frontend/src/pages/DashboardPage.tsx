import React from 'react';
import { PitchRecord } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { PlusCircle, Sparkles, ArrowRight, FileText } from 'lucide-react';

interface DashboardPageProps {
  pitches: PitchRecord[];
  isLoading: boolean;
  onNavigate: (tab: string, pitchId?: string) => void;
  onSeedDemo: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  pitches,
  isLoading,
  onNavigate,
  onSeedDemo
}) => {
  const totalScreened = pitches.length;
  const completed = pitches.filter((p) => p.status === 'COMPLETED').length;
  const pending = pitches.filter((p) => ['QUEUED', 'PROCESSING', 'ANALYZING'].includes(p.status)).length;
  const readyForReview = pitches.filter((p) => p.status === 'TRANSCRIPTION_READY').length;

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            AI Idea Screening Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Intelligent early-stage startup viability assessment with empirical market evidence provenance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={onSeedDemo}
            title="Seed bundled demo fixture"
          >
            <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>Load Demo Pitch</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('new')}
          >
            <PlusCircle size={16} />
            <span>New Screening</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <div className="metric-box">
          <span className="metric-title">Total Pitches</span>
          <span className="metric-value">{totalScreened}</span>
          <span className="metric-sub">Ingested across all media</span>
        </div>

        <div className="metric-box">
          <span className="metric-title">Completed Reports</span>
          <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>{completed}</span>
          <span className="metric-sub">Full heuristic evaluations</span>
        </div>

        <div className="metric-box">
          <span className="metric-title">Awaiting Review</span>
          <span className="metric-value" style={{ color: 'var(--accent-cyan)' }}>{readyForReview}</span>
          <span className="metric-sub">Transcripts ready to analyze</span>
        </div>

        <div className="metric-box">
          <span className="metric-title">In-Flight Tasks</span>
          <span className="metric-value" style={{ color: 'var(--accent-amber)' }}>{pending}</span>
          <span className="metric-sub">Extracting audio / processing</span>
        </div>
      </div>

      {/* Quick Action Banner */}
      <div className="card" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))', borderColor: 'var(--border-strong)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.25rem' }}>
              Screen Any Pitch Deck, Speech Audio, or Video
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '640px' }}>
              Upload video (MP4/MOV), speech recordings (WAV/MP3), deck summaries (PDF/TXT), or paste founder transcripts. Produces an explainable 7-dimension score with real market benchmarks.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('new')}>
            <span>Get Started</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Recent Pitches Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent Startup Pitches</h2>
            <p className="card-description">Screenings submitted to this local instance</p>
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            onClick={() => onNavigate('history')}
          >
            View All History
          </button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{ marginBottom: '0.5rem' }}>Loading pitch records...</div>
          </div>
        ) : pitches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <FileText size={40} style={{ color: 'var(--text-dim)', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Pitches Screened Yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
              Begin by creating your first screening or load our bundled AgriScan AI demo pitch to see a complete evaluation report immediately.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={onSeedDemo}>
                <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span>Load Demo Pitch</span>
              </button>
              <button className="btn btn-primary" onClick={() => onNavigate('new')}>
                <PlusCircle size={16} />
                <span>Screen a Pitch</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Startup Name</th>
                  <th>Industry / Geo</th>
                  <th>Input Format</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pitches.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{p.startup_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {p.original_filename}
                      </div>
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
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {p.status === 'COMPLETED' ? (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => onNavigate('report', p.id)}
                        >
                          View Report
                        </button>
                      ) : p.status === 'TRANSCRIPTION_READY' || p.status === 'FAILED' ? (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => onNavigate('review', p.id)}
                        >
                          Review & Analyze
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => onNavigate('review', p.id)}
                        >
                          View Progress
                        </button>
                      )}
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
