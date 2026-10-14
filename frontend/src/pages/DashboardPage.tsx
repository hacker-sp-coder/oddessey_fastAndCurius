import React from 'react';
import { PitchRecord } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { PlusCircle, Sparkles, FileText, ChevronRight, TrendingUp, Clock } from 'lucide-react';

interface DashboardPageProps {
  pitches: PitchRecord[];
  isLoading: boolean;
  onNavigate: (tab: string, pitchId?: string) => void;
  onSeedDemo: (demoType?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  pitches,
  isLoading,
  onNavigate,
  onSeedDemo
}) => {
  const totalScreened = pitches.length;
  const completedPitches = pitches.filter((p) => p.status === 'COMPLETED');
  const completedCount = completedPitches.length;
  const inFlightCount = pitches.filter((p) => ['QUEUED', 'PROCESSING', 'ANALYZING'].includes(p.status)).length;
  const awaitingReviewCount = pitches.filter((p) => p.status === 'TRANSCRIPTION_READY').length;

  // Compute average score from real completed pitches that have a score
  const scoredPitches = completedPitches.filter((p) => typeof p.overall_score === 'number');
  const avgScore = scoredPitches.length > 0
    ? (scoredPitches.reduce((acc, p) => acc + (p.overall_score || 0), 0) / scoredPitches.length).toFixed(1)
    : null;

  const highViabilityCount = scoredPitches.filter((p) => (p.overall_score || 0) >= 70).length;

  const getScoreColor = (score?: number | null) => {
    if (!score && score !== 0) return 'var(--text-muted)';
    if (score >= 80) return 'var(--color-success)';
    if (score >= 65) return 'var(--color-info)';
    if (score >= 45) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <div className="workspace-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pitch Screening Workspace</h1>
          <p className="page-description">
            Evidence-grounded venture triage, 7-dimension viability scoring, and founder claim verification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => onSeedDemo('agriscan')}
            title="Seed bundled AgriScan AI demo pitch"
          >
            <Sparkles size={15} style={{ color: 'var(--accent-primary)' }} />
            <span>AgriScan Demo</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('new')}
          >
            <PlusCircle size={15} />
            <span>New Screening</span>
          </button>
        </div>
      </div>

      {/* Analytical Metrics Overview */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Screenings Ingested</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span className="metric-value">{totalScreened}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>total</span>
          </div>
          <span className="metric-sub">Media, decks & founder narratives</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Completed Dossiers</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span className="metric-value" style={{ color: 'var(--color-success)' }}>{completedCount}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>dossiers</span>
          </div>
          <span className="metric-sub">7-dimension scored evaluations</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Average Viability</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span className="metric-value" style={{ color: avgScore ? getScoreColor(parseFloat(avgScore)) : 'var(--text-muted)' }}>
              {avgScore !== null ? `${avgScore}` : '—'}
            </span>
            {avgScore !== null && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ 100 pt</span>}
          </div>
          <span className="metric-sub">
            {highViabilityCount > 0 ? `${highViabilityCount} priority idea(s) ≥ 70pt` : 'Based on completed screenings'}
          </span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Pipeline Queue</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span className="metric-value" style={{ color: inFlightCount > 0 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
              {inFlightCount + awaitingReviewCount}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>active</span>
          </div>
          <span className="metric-sub">
            {inFlightCount > 0 ? `${inFlightCount} processing, ` : ''}{awaitingReviewCount} awaiting review
          </span>
        </div>
      </div>

      {/* In-Flight Work Alert if active */}
      {(inFlightCount > 0 || awaitingReviewCount > 0) && (
        <div className="alert alert-info">
          <Clock size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong>Active Screening Pipeline:</strong>{' '}
            {inFlightCount > 0 && `${inFlightCount} media task(s) currently extracting or transcribing. `}
            {awaitingReviewCount > 0 && `${awaitingReviewCount} pitch(es) have transcripts ready for review and evaluation.`}
          </div>
        </div>
      )}

      {/* Recent Screenings Table Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <TrendingUp size={16} style={{ color: 'var(--accent-primary)' }} />
              <span>Recent Screening Dossiers</span>
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Persistent repository of startup ideas evaluated on this workstation
            </p>
          </div>

          {pitches.length > 5 && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('history')}
            >
              <span>View All ({pitches.length})</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>Loading screening records...</div>
          </div>
        ) : pitches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <FileText size={22} />
            </div>
            <h3 className="empty-title">No Screenings in Workspace</h3>
            <p className="empty-desc">
              Ingest a video, speech recording, PDF pitch deck, or paste founder narrative to generate your first structured viability dossier.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => onSeedDemo('doordash')}>
                <Sparkles size={14} style={{ color: 'var(--color-synthetic)' }} />
                <span>Load DoorDash Demo</span>
              </button>
              <button className="btn btn-primary" onClick={() => onNavigate('new')}>
                <PlusCircle size={14} />
                <span>Screen a Pitch</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Startup / Identifier</th>
                  <th>Industry & Geography</th>
                  <th>Format</th>
                  <th>Viability Score</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: 'right' }}>Dossier</th>
                </tr>
              </thead>
              <tbody>
                {pitches.slice(0, 8).map((p) => {
                  const scoreVal = typeof p.overall_score === 'number' ? Math.round(p.overall_score) : null;
                  const scoreColor = getScoreColor(p.overall_score);

                  return (
                    <tr
                      key={p.id}
                      className="table-row-clickable"
                      onClick={() => {
                        if (p.status === 'COMPLETED') onNavigate('report', p.id);
                        else onNavigate('review', p.id);
                      }}
                    >
                      <td style={{ maxWidth: '280px', minWidth: '160px' }}>
                        <div
                          className="truncate"
                          title={p.startup_name}
                          style={{ fontWeight: 600, color: 'var(--text-primary)' }}
                        >
                          {p.startup_name || 'Untitled Pitch'}
                        </div>
                        <div
                          className="truncate"
                          title={p.original_filename || undefined}
                          style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}
                        >
                          {p.original_filename || 'manual transcript'}
                        </div>
                      </td>

                      <td>
                        <div style={{ color: 'var(--text-secondary)' }}>{p.industry || 'Unknown'}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{p.target_geography || 'Unknown'}</div>
                      </td>

                      <td>
                        <span style={{
                          fontSize: '0.7rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)'
                        }}>
                          {p.input_type}
                        </span>
                      </td>

                      <td>
                        {scoreVal !== null ? (
                          <div className="score-cell">
                            <span className="score-num" style={{ color: scoreColor }}>
                              {scoreVal}
                            </span>
                            <div className="score-track">
                              <div
                                className="score-fill"
                                style={{ width: `${Math.min(100, Math.max(0, scoreVal))}%`, backgroundColor: scoreColor }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>
                            Pending
                          </span>
                        )}
                      </td>

                      <td>
                        <StatusBadge status={p.status} />
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        {p.status === 'COMPLETED' ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onNavigate('report', p.id)}
                          >
                            <span>Open Dossier</span>
                            <ChevronRight size={13} />
                          </button>
                        ) : (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => onNavigate('review', p.id)}
                          >
                            <span>{p.status === 'FAILED' ? 'Inspect / Retry' : 'View Progress'}</span>
                            <ChevronRight size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
