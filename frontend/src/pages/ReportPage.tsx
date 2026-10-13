import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { PitchWithAnalysis, CriterionScore } from '../types/index.js';
import { ScoreGauge } from '../components/ScoreGauge.js';
import { 
  Download, Printer, ArrowLeft, RefreshCw, AlertTriangle, 
  ExternalLink, CheckCircle, ShieldAlert, HelpCircle, 
  Layers, ChevronDown, ChevronUp, Sparkles, Database
} from 'lucide-react';

interface ReportPageProps {
  pitchId: string;
  onBack: () => void;
  onReviewTranscript: (pitchId: string) => void;
}

export const ReportPage: React.FC<ReportPageProps> = ({
  pitchId,
  onBack,
  onReviewTranscript
}) => {
  const [data, setData] = useState<PitchWithAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({
    problem_clarity: true,
    target_customer: true,
    market_evidence: true,
    differentiation: true,
    feasibility: true,
    business_model: true,
    scalability: true
  });

  useEffect(() => {
    let isMounted = true;
    const fetchReport = async () => {
      setIsLoading(true);
      try {
        const res = await api.getReport(pitchId);
        if (isMounted) setData(res);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load assessment report.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchReport();
    return () => { isMounted = false; };
  }, [pitchId]);

  const toggleCriterion = (key: string) => {
    setExpandedCriteria((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownloadJson = () => {
    if (!data) return;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screening_report_${data.pitch.startup_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${data.pitch.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '1rem' }} />
        <div>Loading assessment report...</div>
      </div>
    );
  }

  if (error || !data || !data.analysis) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="alert alert-danger">
          <AlertTriangle size={20} />
          <div>{error || 'Report is not available for this pitch.'}</div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
          <button className="btn btn-primary" onClick={() => onReviewTranscript(pitchId)}>
            <span>Review Transcript</span>
          </button>
        </div>
      </div>
    );
  }

  const { pitch, analysis } = data;
  const criteria = analysis.criteria_scores;

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      {/* Action Header */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
        >
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => onReviewTranscript(pitch.id)}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
          >
            <span>Edit Transcript</span>
          </button>
          <button
            onClick={handleDownloadJson}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
          >
            <Download size={16} />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-primary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
          >
            <Printer size={16} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Startup Metadata Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {pitch.startup_name}
          </h1>
          {analysis.is_demo && (
            <span className="badge badge-synthetic">
              <Sparkles size={12} />
              <span>Bundled Demo Pitch</span>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.9rem', flexWrap: 'wrap' }}>
          <span>Industry: <strong style={{ color: 'var(--text-main)' }}>{pitch.industry}</strong></span>
          <span>•</span>
          <span>Geography: <strong style={{ color: 'var(--text-main)' }}>{pitch.target_geography}</strong></span>
          <span>•</span>
          <span>Source: <strong style={{ color: 'var(--text-main)' }}>{pitch.input_type} ({pitch.original_filename})</strong></span>
          <span>•</span>
          <span>Analyzed: {new Date(analysis.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Heuristic Screening Disclaimer Alert */}
      <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Preliminary Screening Aid:</strong> {analysis.confidence_limitations}
        </div>
      </div>

      {/* Viability Gauge Card */}
      <div style={{ marginBottom: '2rem' }}>
        <ScoreGauge
          score={analysis.overall_score}
          confidence={analysis.confidence_score}
          method={analysis.evaluation_method}
        />
      </div>

      {/* Criteria Breakdown Grid */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Explainable Viability Rubric (7 Dimensions)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Version {analysis.rubric_version} • Each dimension is scored 0–100 and weighted toward the final index
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {Object.entries(criteria).map(([key, crit]: [string, CriterionScore]) => {
            const isExpanded = expandedCriteria[key];
            const scoreColor = crit.score >= 80 ? 'var(--accent-emerald)' : crit.score >= 65 ? 'var(--accent-amber)' : 'var(--accent-rose)';

            return (
              <div key={key} className="card" style={{ padding: '1rem 1.25rem' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => toggleCriterion(key)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      color: scoreColor
                    }}>
                      {Math.round(crit.score)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                        {crit.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        Weight: {crit.weight}% • Weighted Contribution: +{crit.weighted_score.toFixed(1)} pts
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: scoreColor }}>
                      {crit.score >= 80 ? 'Strong' : crit.score >= 65 ? 'Moderate' : 'Underdeveloped'}
                    </span>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                        Assessment Rationale:
                      </span>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '0.2rem', lineHeight: 1.5 }}>
                        {crit.rationale}
                      </p>
                    </div>

                    {crit.evidence && crit.evidence.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                          Transcript Evidence Citations:
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
                          {crit.evidence.map((ev, idx) => (
                            <blockquote
                              key={idx}
                              style={{
                                borderLeft: '3px solid var(--accent-cyan)',
                                paddingLeft: '0.75rem',
                                color: 'var(--text-muted)',
                                fontSize: '0.85rem',
                                fontStyle: 'italic',
                                background: 'rgba(56, 189, 248, 0.03)',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                              }}
                            >
                              "{ev}"
                            </blockquote>
                          ))}
                        </div>
                      </div>
                    )}

                    {crit.missing_evidence && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#fca5a5', background: 'rgba(244, 63, 94, 0.06)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                        <strong>Evidence Gap:</strong> {crit.missing_evidence}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Qualitative Findings 2-Column Grid */}
      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        {/* Strengths */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={18} style={{ color: 'var(--accent-emerald)' }} />
              <h3 className="card-title">Core Strengths</h3>
            </div>
          </div>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {analysis.strengths.map((s, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{s}</li>
            ))}
          </ul>
        </div>

        {/* Key Risks */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={18} style={{ color: 'var(--accent-rose)' }} />
              <h3 className="card-title">Identified Risks</h3>
            </div>
          </div>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {analysis.risks.map((r, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{r}</li>
            ))}
          </ul>
        </div>

        {/* Assumptions */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} style={{ color: 'var(--accent-amber)' }} />
              <h3 className="card-title">Underlying Assumptions</h3>
            </div>
          </div>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {analysis.assumptions.map((a, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{a}</li>
            ))}
          </ul>
        </div>

        {/* Founder Follow-up Questions */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={18} style={{ color: 'var(--accent-cyan)' }} />
              <h3 className="card-title">Founder Follow-Up Questions</h3>
            </div>
          </div>
          <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {analysis.founder_questions.map((q, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{q}</li>
            ))}
          </ol>
        </div>
      </div>

      {/* Market Context & Provenance Section */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <div className="card-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} style={{ color: 'var(--accent-cyan)' }} />
              <h2 className="card-title">Market Context & Evidence Provenance</h2>
            </div>
            <p className="card-description">
              Curated third-party industry benchmarks and verified macroeconomic claims
            </p>
          </div>
        </div>

        {analysis.market_evidence && analysis.market_evidence.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {analysis.market_evidence.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${item.verification_status === 'VERIFIED' ? 'badge-verified' : 'badge-synthetic'}`}>
                      {item.verification_status}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      Category: <strong>{item.category}</strong> • Geo: <strong>{item.geography}</strong>
                    </span>
                  </div>

                  {item.publication_date && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Published: {item.publication_date}
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                  {item.claim}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-dim)', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span>Source: {item.source_title}</span>
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <span>Visit Citation</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No matching verified benchmarks found for {pitch.industry} in {pitch.target_geography}.
          </div>
        )}
      </div>
    </div>
  );
};
