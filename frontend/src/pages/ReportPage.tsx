import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { PitchWithAnalysis, CriterionScore } from '../types/index.js';
import {
  Download,
  Printer,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  ShieldAlert,
  HelpCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Database,
  Copy,
  Check,
  FileText,
  Cpu,
  AlertOctagon
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
  const [copiedSummary, setCopiedSummary] = useState(false);
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
    const cleanName = (data.pitch.startup_name || 'pitch').toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.download = `pitchlens_dossier_${cleanName}_${data.pitch.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    if (!data || !data.analysis) return;
    const summary = [
      `PITCHLENS VIABILITY SCREENING DOSSIER`,
      `Target: ${data.pitch.startup_name} (${data.pitch.industry || 'Unknown Sector'}, ${data.pitch.target_geography || 'Unknown Geography'})`,
      `Overall Viability Index: ${Math.round(data.analysis.overall_score)}/100`,
      `Confidence Rating: ${Math.round(data.analysis.confidence_score * 100)}%`,
      `Evaluation Provenance: ${data.analysis.evaluation_method} (${data.analysis.evaluation_provider})`,
      `Screened: ${new Date(data.analysis.created_at).toLocaleDateString()}`,
      ``,
      `CORE STRENGTHS:`,
      ...data.analysis.strengths.map(s => `- ${s}`),
      ``,
      `KEY RISKS & UNCERTAINTIES:`,
      ...data.analysis.risks.map(r => `- ${r}`),
      ``,
      `FOUNDER DILIGENCE QUESTIONS:`,
      ...data.analysis.founder_questions.map((q, idx) => `${idx + 1}. ${q}`),
      ``,
      `Confidence Limitations: ${data.analysis.confidence_limitations}`
    ].join('\n');

    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--text-muted)' }}>
        <RefreshCw size={26} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '1rem', color: 'var(--accent-primary)' }} />
        <div style={{ fontSize: '0.95rem' }}>Compiling analyst viability dossier...</div>
      </div>
    );
  }

  if (error || !data || !data.analysis) {
    return (
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>{error || 'Screening assessment is not available for this pitch.'}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>
            <ArrowLeft size={14} />
            <span>Back to Dashboard</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onReviewTranscript(pitchId)}>
            <span>Review Transcript</span>
          </button>
        </div>
      </div>
    );
  }

  const { pitch, analysis } = data;
  const criteria = analysis.criteria_scores;
  const overallScore = Math.round(analysis.overall_score);
  const confidencePct = Math.round(analysis.confidence_score * 100);

  // Verdict calculation
  const getVerdict = (score: number) => {
    if (score >= 80) return { label: 'High Conviction', tag: 'PURSUE', color: 'var(--accent-emerald)', bg: 'rgba(16, 185, 129, 0.1)' };
    if (score >= 65) return { label: 'Conditional Viability', tag: 'DILIGENCE', color: 'var(--accent-primary)', bg: 'rgba(56, 189, 248, 0.1)' };
    if (score >= 50) return { label: 'Moderate Concerns', tag: 'EVALUATE', color: 'var(--accent-amber)', bg: 'rgba(245, 158, 11, 0.1)' };
    return { label: 'Significant Structural Risk', tag: 'PIVOT / DECLINE', color: 'var(--accent-rose)', bg: 'rgba(244, 63, 94, 0.1)' };
  };

  const verdict = getVerdict(overallScore);
  const isGroq = analysis.evaluation_provider.toLowerCase().includes('groq') || analysis.evaluation_method.toLowerCase().includes('llm');

  return (
    <div className="page-container" style={{ maxWidth: '1120px' }}>
      {/* Top Action Bar (hidden in print) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button
          onClick={onBack}
          className="btn btn-secondary btn-sm"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onReviewTranscript(pitch.id)}
            className="btn btn-secondary btn-sm"
            title="Inspect or re-run evaluation with modified transcript"
          >
            <FileText size={14} />
            <span>Verify Transcript</span>
          </button>
          <button
            onClick={handleCopySummary}
            className="btn btn-secondary btn-sm"
            title="Copy executive summary briefing to clipboard"
          >
            {copiedSummary ? <Check size={14} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={14} />}
            <span>{copiedSummary ? 'Copied Briefing' : 'Copy Summary'}</span>
          </button>
          <button
            onClick={handleDownloadJson}
            className="btn btn-secondary btn-sm"
            title="Export raw structured evaluation JSON"
          >
            <Download size={14} />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-primary btn-sm"
            title="Print printable analyst dossier"
          >
            <Printer size={14} />
            <span>Print Dossier</span>
          </button>
        </div>
      </div>

      {/* Header Dossier Banner */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.025em', margin: 0 }}>
                {pitch.startup_name || 'Startup Pitch'}
              </h1>
              {analysis.inferred_metadata?.inferred && (
                <span className="badge badge-default" title="Name inferred by NLP extraction from pitch context">
                  Inferred Entity
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.825rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span>Sector: <strong style={{ color: 'var(--text-main)' }}>{pitch.industry || 'General Venture'}</strong></span>
              <span style={{ color: 'var(--border-subtle)' }}>•</span>
              <span>Geography: <strong style={{ color: 'var(--text-main)' }}>{pitch.target_geography || 'Global'}</strong></span>
              <span style={{ color: 'var(--border-subtle)' }}>•</span>
              <span>Input: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{pitch.original_filename || pitch.input_type}</strong></span>
              <span style={{ color: 'var(--border-subtle)' }}>•</span>
              <span>Date: {new Date(analysis.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Provenance Pill */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: isGroq ? 'var(--accent-muted)' : 'var(--bg-tertiary)',
              border: `1px solid ${isGroq ? 'var(--border-accent)' : 'var(--border-subtle)'}`,
              fontSize: '0.75rem',
              color: isGroq ? 'var(--accent-primary)' : 'var(--text-dim)',
              fontFamily: 'var(--font-mono)'
            }}>
              <Cpu size={13} />
              <span>
                {isGroq ? `Groq / ${analysis.evaluation_provider}` : `Offline / ${analysis.evaluation_method}`}
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Rubric Engine v{analysis.rubric_version}
            </span>
          </div>
        </div>

        {/* Confidence & Preliminary Aid Notice */}
        <div style={{
          marginTop: '1.25rem',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(245, 158, 11, 0.05)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.65rem'
        }}>
          <AlertTriangle size={15} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--text-main)' }}>Preliminary Screening Notice: </strong>
            {analysis.confidence_limitations || 'This assessment represents an algorithmic evaluation based strictly on claims present in the pitch narrative. Independent diligence and auditing remain required.'}
          </div>
        </div>
      </div>

      {/* Viability Summary Grid */}
      <div className="grid-3" style={{ marginBottom: '1.5rem', gap: '1rem' }}>
        {/* Overall Index */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', fontWeight: 600 }}>
              Viability Index
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: verdict.color, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
                {overallScore}
              </span>
              <span style={{ fontSize: '1rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                / 100
              </span>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div className="score-progress" style={{ height: '6px', marginBottom: '0.5rem' }}>
              <div
                className="score-progress-bar"
                style={{
                  width: `${overallScore}%`,
                  background: verdict.color
                }}
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Weighted 7-dimension synthesis
            </div>
          </div>
        </div>

        {/* Calibrated Recommendation */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', fontWeight: 600 }}>
              Analyst Screening Verdict
            </div>
            <div style={{ marginTop: '0.65rem' }}>
              <span style={{
                display: 'inline-block',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                background: verdict.bg,
                color: verdict.color,
                fontWeight: 700,
                fontSize: '0.9rem',
                border: `1px solid ${verdict.color}40`,
                letterSpacing: '0.02em'
              }}>
                {verdict.tag}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.5rem', fontWeight: 600 }}>
              {verdict.label}
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.75rem' }}>
            Decision gate for partner review queue
          </div>
        </div>

        {/* Confidence Level */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', fontWeight: 600 }}>
              Model Confidence Rating
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
                {confidencePct}%
              </span>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div className="score-progress" style={{ height: '6px', marginBottom: '0.5rem' }}>
              <div
                className="score-progress-bar"
                style={{
                  width: `${confidencePct}%`,
                  background: 'var(--accent-primary)'
                }}
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Assessing narrative completeness & specificity
            </div>
          </div>
        </div>
      </div>

      {/* Seven-Dimensional Rubric Score Breakdown */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: '1rem' }}>
          <div>
            <h2 className="card-title">Seven-Dimensional Viability Rubric</h2>
            <p className="card-description">
              Granular scoring across key venture investment pillars. Click any row to expand rationale and verbatim evidence.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {Object.entries(criteria).map(([key, crit]: [string, CriterionScore]) => {
            const isExpanded = expandedCriteria[key];
            const critScore = Math.round(crit.score);
            const scoreColor = critScore >= 80 ? 'var(--accent-emerald)' : critScore >= 65 ? 'var(--accent-primary)' : critScore >= 50 ? 'var(--accent-amber)' : 'var(--accent-rose)';

            return (
              <div
                key={key}
                style={{
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-tertiary)',
                  overflow: 'hidden'
                }}
              >
                {/* Clickable Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1.15rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: '1rem'
                  }}
                  onClick={() => toggleCriterion(key)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                    {/* Score Reticle */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-input)',
                      border: `1px solid ${scoreColor}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1rem',
                      fontFamily: 'var(--font-mono)',
                      color: scoreColor,
                      flexShrink: 0
                    }}>
                      {critScore}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--text-main)' }}>
                          {crit.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          (Weight: {crit.weight}% • Contribution: +{crit.weighted_score.toFixed(1)} pts)
                        </span>
                      </div>

                      {/* Small horizontal score bar */}
                      <div className="score-progress" style={{ height: '4px', maxWidth: '320px', marginTop: '0.35rem' }}>
                        <div
                          className="score-progress-bar"
                          style={{ width: `${critScore}%`, background: scoreColor }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: scoreColor,
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {critScore >= 80 ? 'STRONG' : critScore >= 65 ? 'ACCEPTABLE' : critScore >= 50 ? 'CONCERN' : 'CRITICAL DEFICIT'}
                    </span>
                    {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-dim)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-dim)' }} />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{
                    padding: '1rem 1.25rem 1.25rem',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)'
                  }}>
                    {/* Rationale */}
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dim)', fontWeight: 700 }}>
                        Assessment Rationale
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginTop: '0.25rem', lineHeight: 1.55 }}>
                        {crit.rationale}
                      </p>
                    </div>

                    {/* Verbatim Evidence Citations */}
                    {crit.evidence && crit.evidence.length > 0 && (
                      <div style={{ marginBottom: '0.85rem' }}>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dim)', fontWeight: 700 }}>
                          Verbatim Narrative Evidence Citations
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.35rem' }}>
                          {crit.evidence.map((ev, idx) => (
                            <div
                              key={idx}
                              style={{
                                borderLeft: '3px solid var(--accent-primary)',
                                padding: '0.35rem 0.75rem',
                                color: 'var(--text-muted)',
                                fontSize: '0.825rem',
                                fontStyle: 'italic',
                                background: 'var(--accent-muted)',
                                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                              }}
                            >
                              "{ev}"
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evidence Gap */}
                    {crit.missing_evidence && (
                      <div style={{
                        marginTop: '0.65rem',
                        fontSize: '0.825rem',
                        color: 'var(--accent-rose)',
                        background: 'rgba(244, 63, 94, 0.05)',
                        border: '1px solid rgba(244, 63, 94, 0.15)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}>
                        <AlertOctagon size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Validation Gap: </strong>
                          {crit.missing_evidence}
                        </div>
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
      <div className="grid-2" style={{ marginBottom: '1.5rem', gap: '1rem' }}>
        {/* Core Strengths */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--accent-emerald)' }} />
              <h3 className="card-title">Core Strengths</h3>
            </div>
          </div>
          <ul style={{ paddingLeft: '1.15rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            {analysis.strengths && analysis.strengths.length > 0 ? (
              analysis.strengths.map((s, idx) => (
                <li key={idx} style={{ marginBottom: '0.35rem' }}>{s}</li>
              ))
            ) : (
              <li style={{ color: 'var(--text-dim)' }}>No standout strengths identified in this narrative.</li>
            )}
          </ul>
        </div>

        {/* Identified Risks & Red Flags */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={16} style={{ color: 'var(--accent-rose)' }} />
              <h3 className="card-title">Structural Risks & Vulnerabilities</h3>
            </div>
          </div>
          <ul style={{ paddingLeft: '1.15rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            {analysis.risks && analysis.risks.length > 0 ? (
              analysis.risks.map((r, idx) => (
                <li key={idx} style={{ marginBottom: '0.35rem' }}>{r}</li>
              ))
            ) : (
              <li style={{ color: 'var(--text-dim)' }}>No critical risks flagged.</li>
            )}
          </ul>
        </div>

        {/* Underlying Assumptions */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={16} style={{ color: 'var(--accent-amber)' }} />
              <h3 className="card-title">Underlying Venture Assumptions</h3>
            </div>
          </div>
          <ul style={{ paddingLeft: '1.15rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            {analysis.assumptions && analysis.assumptions.length > 0 ? (
              analysis.assumptions.map((a, idx) => (
                <li key={idx} style={{ marginBottom: '0.35rem' }}>{a}</li>
              ))
            ) : (
              <li style={{ color: 'var(--text-dim)' }}>No explicit assumptions isolated.</li>
            )}
          </ul>
        </div>

        {/* Founder Follow-up Questions */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle size={16} style={{ color: 'var(--accent-primary)' }} />
              <h3 className="card-title">Founder Diligence Questions</h3>
            </div>
          </div>
          <ol style={{ paddingLeft: '1.15rem', margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            {analysis.founder_questions && analysis.founder_questions.length > 0 ? (
              analysis.founder_questions.map((q, idx) => (
                <li key={idx} style={{ marginBottom: '0.35rem' }}>{q}</li>
              ))
            ) : (
              <li style={{ color: 'var(--text-dim)' }}>No follow-up questions generated.</li>
            )}
          </ol>
        </div>
      </div>

      {/* Market Context & Evidence Provenance */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <div className="card-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={16} style={{ color: 'var(--accent-primary)' }} />
              <h2 className="card-title">Market Claims & Evidence Provenance</h2>
            </div>
            <p className="card-description">
              Strict attribution of factual statements to avoid confusing founder assertions with independent verification.
            </p>
          </div>
        </div>

        {(() => {
          const regularEvidence = (analysis.market_evidence || []).filter(
            (i) => i.category !== 'Missing evidence' && i.verification_status !== 'UNAVAILABLE'
          );
          const missingEvidence = (analysis.market_evidence || []).filter(
            (i) => i.category === 'Missing evidence' || i.verification_status === 'UNAVAILABLE'
          );

          if (!analysis.market_evidence || analysis.market_evidence.length === 0) {
            return (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                <p style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  No Matching Market Evidence Found
                </p>
                <p style={{ fontSize: '0.8rem', maxWidth: '520px', margin: '0 auto' }}>
                  No matching curated benchmarks were found in the local library for {pitch.industry || 'this sector'} in {pitch.target_geography || 'this geography'}.
                </p>
              </div>
            );
          }

          return (
            <div>
              {/* Provenance breakdown badges */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                {analysis.market_evidence.some((i) => i.verification_status === 'VERIFIED') && (
                  <span className="badge badge-verified" style={{ fontSize: '0.725rem' }}>
                    {analysis.market_evidence.filter((i) => i.verification_status === 'VERIFIED').length} Curated Third-Party Benchmark(s)
                  </span>
                )}
                {analysis.market_evidence.some((i) => i.verification_status === 'UNVERIFIED_CLAIM') && (
                  <span className="badge badge-unverified" style={{ fontSize: '0.725rem' }}>
                    {analysis.market_evidence.filter((i) => i.verification_status === 'UNVERIFIED_CLAIM').length} Founder Pitch Claim(s)
                  </span>
                )}
                {missingEvidence.length > 0 && (
                  <span className="badge badge-unavailable" style={{ fontSize: '0.725rem' }}>
                    {missingEvidence.length} Missing Evidence Gap(s)
                  </span>
                )}
              </div>

              {/* Context and Hypotheses Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {regularEvidence.map((item) => {
                  const badgeClass =
                    item.verification_status === 'VERIFIED'
                      ? 'badge-verified'
                      : item.verification_status === 'UNVERIFIED_CLAIM'
                        ? 'badge-unverified'
                        : '';

                  const badgeLabel =
                    item.verification_status === 'VERIFIED'
                      ? 'Verified Benchmark'
                      : item.verification_status === 'UNVERIFIED_CLAIM'
                        ? 'Founder Pitch Claim'
                        : '';

                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {badgeLabel ? (
                            <span className={`badge ${badgeClass}`}>
                              {badgeLabel}
                            </span>
                          ) : null}
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            Category: <strong>{item.category}</strong>
                            {item.verification_status ? (
                              <> • Provenance: <strong>{item.verification_status}</strong></>
                            ) : null}
                          </span>
                        </div>

                        {item.publication_date && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            Pub: {item.publication_date}
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '0.4rem', fontWeight: 500 }}>
                        {item.claim}
                      </p>

                      {item.notes && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', lineHeight: 1.4, paddingLeft: '0.5rem', borderLeft: '2px solid var(--border-default)' }}>
                          <strong style={{ color: 'var(--text-secondary)' }}>Explanation:</strong> {item.notes}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span>Source: <strong>{item.source_title}</strong></span>
                        {item.source_url ? (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <span>Inspect Source</span>
                            <ExternalLink size={11} />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Separate Missing-Evidence Section */}
              {missingEvidence.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <AlertTriangle size={15} style={{ color: 'var(--color-warning)' }} />
                    <h3 style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                      Identified Market Evidence Gaps (Missing Evidence)
                    </h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {missingEvidence.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className="badge badge-unavailable">
                              Missing Evidence
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                              Category: <strong>{item.category}</strong> • Provenance: <strong>{item.verification_status}</strong>
                            </span>
                          </div>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '0.4rem', fontWeight: 500 }}>
                          {item.claim}
                        </p>

                        {item.notes && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', lineHeight: 1.4, paddingLeft: '0.5rem', borderLeft: '2px solid var(--border-default)' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>Explanation:</strong> {item.notes}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          <span>Source: <strong>{item.source_title}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
