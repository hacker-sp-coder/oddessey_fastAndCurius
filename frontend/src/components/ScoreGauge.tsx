import React from 'react';

interface ScoreGaugeProps {
  score: number;
  confidence: number;
  method: string;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, confidence, method }) => {
  const getVerdict = () => {
    if (score >= 80) {
      return {
        color: 'var(--color-success)',
        bgColor: 'var(--color-success-bg)',
        borderColor: 'var(--color-success-border)',
        verdict: 'High Potential / Priority Diligence',
        summary: 'Exceptional evidence density with defensible technical differentiation and clear initial unit economics.'
      };
    }
    if (score >= 65) {
      return {
        color: 'var(--color-info)',
        bgColor: 'var(--color-info-bg)',
        borderColor: 'var(--color-info-border)',
        verdict: 'Moderate Viability / Conditional Interest',
        summary: 'Solid foundational logic, but empirical traction benchmarks or unit-economic validations remain incomplete.'
      };
    }
    if (score >= 45) {
      return {
        color: 'var(--color-warning)',
        bgColor: 'var(--color-warning-bg)',
        borderColor: 'var(--color-warning-border)',
        verdict: 'Early Signal / Significant Evidence Gaps',
        summary: 'Superficial assertions in critical dimensions; core customer acquisition and technical feasibility require validation.'
      };
    }
    return {
      color: 'var(--color-danger)',
      bgColor: 'var(--color-danger-bg)',
      borderColor: 'var(--color-danger-border)',
      verdict: 'Critical Deficits / Low Viability',
      summary: 'Critical structural gaps, unaddressed regulatory/unit-economic risks, or absent substance in pitch narrative.'
    };
  };

  const { color, bgColor, borderColor, verdict, summary } = getVerdict();
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '2rem',
      padding: '1.5rem',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      flexWrap: 'wrap'
    }}>
      {/* Reticle Radial Score Meter */}
      <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke="var(--border-subtle)"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
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
          <span style={{ fontSize: '1.9rem', fontWeight: 800, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
            {Math.round(score)}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
            / 100 pt
          </span>
        </div>
      </div>

      {/* Structured Verdict & Provenance */}
      <div style={{ flex: 1, minWidth: '280px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
          <span style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em'
          }}>
            {verdict}
          </span>
          <span style={{
            fontSize: '0.725rem',
            padding: '0.15rem 0.55rem',
            borderRadius: 'var(--radius-sm)',
            background: bgColor,
            color,
            border: `1px solid ${borderColor}`,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)'
          }}>
            {method}
          </span>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', lineHeight: 1.45 }}>
          {summary}
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)'
        }}>
          <span>Confidence: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(confidence * 100)}%</strong></span>
          <span>Rubric: <strong style={{ color: 'var(--text-primary)' }}>7-Dimension Weighted (v1.0)</strong></span>
        </div>
      </div>
    </div>
  );
};
