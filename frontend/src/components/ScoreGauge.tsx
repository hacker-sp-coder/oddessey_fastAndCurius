import React from 'react';

interface ScoreGaugeProps {
  score: number;
  confidence: number;
  method: string;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, confidence, method }) => {
  const getColor = () => {
    if (score >= 80) return { stroke: '#10b981', text: 'var(--accent-emerald)', label: 'Strong Viability Signal' };
    if (score >= 65) return { stroke: '#f59e0b', text: 'var(--accent-amber)', label: 'Moderate Potential / Diligence Needed' };
    return { stroke: '#f43f5e', text: 'var(--accent-rose)', label: 'Significant Evidence Gaps' };
  };

  const { stroke, text, label } = getColor();
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '2rem',
      padding: '1.5rem',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)'
    }}>
      {/* Circular Progress Gauge */}
      <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
        <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="65"
            cy="65"
            r={radius}
            stroke="var(--bg-tertiary)"
            strokeWidth="10"
            fill="transparent"
          />
          <circle
            cx="65"
            cy="65"
            r={radius}
            stroke={stroke}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '2.1rem', fontWeight: 800, color: text, lineHeight: 1 }}>
            {Math.round(score)}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Out of 100
          </span>
        </div>
      </div>

      {/* Narrative & Provenance Metadata */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span style={{
            fontSize: '1.15rem',
            fontWeight: 800,
            color: 'var(--text-main)'
          }}>
            {label}
          </span>
          <span style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.6rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-tertiary)',
            color: 'var(--accent-cyan)',
            border: '1px solid var(--border-subtle)',
            fontWeight: 600
          }}>
            {method}
          </span>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem', maxWidth: '600px' }}>
          Weighted heuristic viability aggregate evaluated across 7 rubric dimensions (Problem, Customer, Traction, Moat, Feasibility, Business Model, Scalability).
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          <span>Confidence: <strong style={{ color: 'var(--text-main)' }}>{Math.round(confidence * 100)}%</strong></span>
          <span>Rubric: <strong style={{ color: 'var(--text-main)' }}>v1.0.0 (Weighted 100pt)</strong></span>
        </div>
      </div>
    </div>
  );
};
