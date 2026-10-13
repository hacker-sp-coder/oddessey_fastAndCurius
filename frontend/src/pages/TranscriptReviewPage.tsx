import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { PitchRecord } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { RefreshCw, Save, Play, AlertCircle, FileText, Globe, CheckCircle } from 'lucide-react';

interface TranscriptReviewPageProps {
  pitchId: string;
  onAnalysisComplete: (pitchId: string) => void;
  onBack: () => void;
}

export const TranscriptReviewPage: React.FC<TranscriptReviewPageProps> = ({
  pitchId,
  onAnalysisComplete,
  onBack
}) => {
  const [pitch, setPitch] = useState<PitchRecord | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const pollingRef = useRef<number | null>(null);

  // Poll pitch status while asynchronous work is active
  useEffect(() => {
    let isMounted = true;

    const fetchPitchData = async () => {
      try {
        const data = await api.getPitch(pitchId);
        if (!isMounted) return;

        setPitch(data);
        if (!isEditing) {
          setTranscriptText(data.normalized_transcript || data.original_transcript || '');
        }

        // If completed, navigate to report
        if (data.status === 'COMPLETED') {
          onAnalysisComplete(pitchId);
          return;
        }

        // Continue polling if in processing or analyzing state
        if (['QUEUED', 'PROCESSING', 'ANALYZING'].includes(data.status)) {
          pollingRef.current = window.setTimeout(fetchPitchData, 2500);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Error fetching pitch record.');
      }
    };

    fetchPitchData();

    return () => {
      isMounted = false;
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [pitchId, onAnalysisComplete, isEditing]);

  const handleSaveTranscript = async () => {
    if (!pitch) return;
    setIsSavingTranscript(true);
    setError(null);
    setSaveSuccessMsg(null);

    try {
      const updated = await api.updateTranscript(pitch.id, transcriptText);
      setPitch(updated);
      setIsEditing(false);
      setSaveSuccessMsg('Transcript updated successfully.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save transcript.');
    } finally {
      setIsSavingTranscript(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!pitch) return;
    if (!transcriptText || !transcriptText.trim()) {
      setError('A transcript is required before running viability analysis.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // If user had pending transcript edits, save them first
      if (isEditing) {
        await api.updateTranscript(pitch.id, transcriptText);
      }
      await api.analyzePitch(pitch.id);
      onAnalysisComplete(pitch.id);
    } catch (err: any) {
      setError(err.message || 'Analysis execution failed.');
      // Refresh pitch state to show actionable error
      const refreshed = await api.getPitch(pitch.id);
      setPitch(refreshed);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!pitch) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '1rem' }} />
        <div>Loading pitch processing status...</div>
      </div>
    );
  }

  const isProcessing = ['QUEUED', 'PROCESSING'].includes(pitch.status);
  const isAnalyzingActive = pitch.status === 'ANALYZING' || isAnalyzing;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button
            onClick={onBack}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}
          >
            ← Back to Dashboard
          </button>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {pitch.startup_name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <span>{pitch.industry}</span>
            <span>•</span>
            <span>{pitch.target_geography}</span>
            <span>•</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{pitch.original_filename}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <StatusBadge status={pitch.status} />
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="alert alert-info">
          <CheckCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-emerald)' }} />
          <div>{saveSuccessMsg}</div>
        </div>
      )}

      {/* Processing State Banner */}
      {isProcessing && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(56, 189, 248, 0.05)', borderColor: 'var(--border-accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <RefreshCw size={24} style={{ animation: 'spin 2s linear infinite', color: 'var(--accent-cyan)' }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Processing Media Ingestion...
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Extracting audio stream via FFmpeg and preparing speech transcript. This page updates automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Required State Banner if audio could not be automatically transcribed */}
      {pitch.status === 'TRANSCRIPTION_READY' && !pitch.original_transcript && pitch.error_message && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Manual Transcript Input:</strong> {pitch.error_message}
            <div style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
              Paste or type your transcript in the editor below and click <strong>"Run Viability Analysis"</strong> to proceed.
            </div>
          </div>
        </div>
      )}

      {/* Main Review Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Transcript Review & Normalization</h2>
            <p className="card-description">
              Review, edit, and confirm the pitch narrative before submitting to the evaluation rubric engine.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {pitch.detected_language && (
              <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                <Globe size={12} />
                <span>Lang: {pitch.detected_language}</span>
              </span>
            )}
            <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              <FileText size={12} />
              <span>{pitch.input_type} Input</span>
            </span>
          </div>
        </div>

        <div className="form-group">
          <textarea
            className="form-textarea"
            style={{
              minHeight: '260px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              background: 'var(--bg-input)'
            }}
            placeholder="No transcript generated yet. Type or paste founder pitch transcript here..."
            value={transcriptText}
            onChange={(e) => {
              setTranscriptText(e.target.value);
              setIsEditing(true);
            }}
            disabled={isAnalyzingActive}
          />
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div>
            {isEditing && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSaveTranscript}
                disabled={isSavingTranscript}
              >
                <Save size={16} />
                <span>{isSavingTranscript ? 'Saving...' : 'Save Transcript Changes'}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRunAnalysis}
              disabled={isAnalyzingActive || !transcriptText.trim()}
              style={{ minWidth: '200px' }}
            >
              {isAnalyzingActive ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
                  <span>Evaluating Viability...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>Run Viability Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
