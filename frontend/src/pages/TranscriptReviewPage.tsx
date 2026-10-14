import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { PitchRecord } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { 
  RefreshCw, 
  Save, 
  Play, 
  AlertCircle, 
  FileText, 
  Globe, 
  CheckCircle, 
  Edit3, 
  ArrowLeft,
  Info
} from 'lucide-react';

import { formatFileSize } from '../utils/formatters.js';

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
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Metadata editing state
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editStartupName, setEditStartupName] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editGeography, setEditGeography] = useState('');

  const pollingRef = useRef<number | null>(null);

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

        if (!isEditingMetadata) {
          setEditStartupName(data.startup_name || '');
          setEditIndustry(data.industry || '');
          setEditGeography(data.target_geography || '');
        }

        if (data.status === 'COMPLETED') {
          onAnalysisComplete(pitchId);
          return;
        }

        if (['QUEUED', 'PROCESSING', 'ANALYZING'].includes(data.status)) {
          pollingRef.current = window.setTimeout(fetchPitchData, 2000);
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
  }, [pitchId, onAnalysisComplete, isEditing, isEditingMetadata]);

  const handleSaveTranscript = async () => {
    if (!pitch) return;
    setIsSavingTranscript(true);
    setError(null);
    setSaveSuccessMsg(null);

    try {
      const updated = await api.updateTranscript(pitch.id, transcriptText);
      setPitch(updated);
      setIsEditing(false);
      setSaveSuccessMsg('Transcript updated and persisted.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save transcript.');
    } finally {
      setIsSavingTranscript(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!pitch) return;
    try {
      const updated = await api.updatePitchMetadata(pitch.id, {
        startup_name: editStartupName,
        industry: editIndustry,
        target_geography: editGeography
      });
      setPitch(updated);
      setIsEditingMetadata(false);
      setSaveSuccessMsg('Pitch context updated successfully.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update pitch metadata.');
    }
  };

  const handleRetryTranscription = async () => {
    if (!pitch) return;
    setIsRetrying(true);
    setError(null);

    try {
      const updated = await api.retryPitch(pitch.id);
      setPitch(updated);
      setSaveSuccessMsg('Transcription job re-enqueued.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to retry transcription.');
    } finally {
      setIsRetrying(false);
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
      if (isEditing) {
        await api.updateTranscript(pitch.id, transcriptText);
      }
      if (isEditingMetadata) {
        await api.updatePitchMetadata(pitch.id, {
          startup_name: editStartupName,
          industry: editIndustry,
          target_geography: editGeography
        });
      }

      await api.analyzePitch(pitch.id);
      onAnalysisComplete(pitch.id);
    } catch (err: any) {
      setError(err.message || 'Analysis execution failed.');
      const refreshed = await api.getPitch(pitch.id);
      setPitch(refreshed);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!pitch) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '1rem', color: 'var(--accent-primary)' }} />
        <div style={{ fontSize: '0.9rem' }}>Retrieving pitch verification state...</div>
      </div>
    );
  }

  const isProcessing = ['QUEUED', 'PROCESSING'].includes(pitch.status);
  const isAnalyzingActive = pitch.status === 'ANALYZING' || isAnalyzing;
  const isFailed = pitch.status === 'FAILED';
  const wordCount = transcriptText.trim() ? transcriptText.trim().split(/\s+/).length : 0;
  const charCount = transcriptText.length;

  return (
    <div className="page-container" style={{ maxWidth: '1040px' }}>
      {/* Top Breadcrumb & Action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button
          onClick={onBack}
          className="btn btn-secondary btn-sm"
        >
          <ArrowLeft size={14} />
          <span>Dashboard</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            ID: {pitch.id.slice(0, 8)}
          </span>
          <StatusBadge status={pitch.status} />
        </div>
      </div>

      {/* Pitch Header Card */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
                {pitch.startup_name || 'Pitch Transcript'}
              </h1>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditingMetadata(!isEditingMetadata)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                title="Edit startup name, industry, and geography context"
              >
                <Edit3 size={12} />
                <span>{isEditingMetadata ? 'Cancel Edit' : 'Edit Context'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.5rem', fontSize: '0.825rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span>Industry: <strong style={{ color: 'var(--text-main)' }}>{pitch.industry || 'Unknown (Inferred)'}</strong></span>
              <span style={{ color: 'var(--border-subtle)' }}>•</span>
              <span>Geography: <strong style={{ color: 'var(--text-main)' }}>{pitch.target_geography || 'Unknown (Inferred)'}</strong></span>
              <span style={{ color: 'var(--border-subtle)' }}>•</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                {pitch.original_filename || `${pitch.input_type} input`}
              </span>
              {pitch.file_size > 0 && (
                <>
                  <span style={{ color: 'var(--border-subtle)' }}>•</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    {formatFileSize(pitch.file_size)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {pitch.detected_language && (
              <span className="badge badge-default">
                <Globe size={11} />
                <span>Lang: {pitch.detected_language}</span>
              </span>
            )}
            <span className="badge badge-default">
              <FileText size={11} />
              <span>{pitch.input_type} Format</span>
            </span>
          </div>
        </div>

        {/* Metadata Inline Editor */}
        {isEditingMetadata && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
              Analyst Context Overrides (Optional)
            </div>
            <div className="grid-3" style={{ gap: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Startup Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editStartupName}
                  onChange={(e) => setEditStartupName(e.target.value)}
                  placeholder="e.g. AgriScan AI"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Industry Sector</label>
                <input
                  type="text"
                  className="form-input"
                  value={editIndustry}
                  onChange={(e) => setEditIndustry(e.target.value)}
                  placeholder="e.g. Agricultural Technology"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Geography</label>
                <input
                  type="text"
                  className="form-input"
                  value={editGeography}
                  onChange={(e) => setEditGeography(e.target.value)}
                  placeholder="e.g. South Asia"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.85rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditingMetadata(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveMetadata}
              >
                Save Overrides
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div style={{ flex: 1, fontSize: '0.875rem' }}>{error}</div>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="alert alert-info" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle size={18} style={{ flexShrink: 0, marginTop: '1px', color: 'var(--accent-emerald)' }} />
          <div style={{ flex: 1, fontSize: '0.875rem' }}>{saveSuccessMsg}</div>
        </div>
      )}

      {/* Processing State Banner */}
      {isProcessing && (
        <div className="card" style={{ marginBottom: '1.25rem', borderColor: 'var(--accent-primary)', background: 'var(--accent-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <RefreshCw size={22} style={{ animation: 'spin 2s linear infinite', color: 'var(--accent-primary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Ingesting Media & Transcribing...
              </div>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Faster-Whisper is processing the audio waveform. This view polls the backend and transitions automatically when ready.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failure State Banner with Retry */}
      {isFailed && (
        <div className="card" style={{ marginBottom: '1.25rem', borderColor: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <AlertCircle size={22} style={{ color: 'var(--accent-rose)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Ingestion / Transcription Failed
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--accent-rose)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                {pitch.error_message || 'Automatic speech-to-text extraction failed.'}
              </p>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                You can retry transcription with the button below, or paste the pitch narrative manually into the editor below to proceed with evaluation.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleRetryTranscription}
                  disabled={isRetrying}
                >
                  <RefreshCw size={13} style={{ animation: isRetrying ? 'spin 1.5s linear infinite' : 'none' }} />
                  <span>{isRetrying ? 'Retrying Job...' : 'Retry Ingestion'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Review Card */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: '0.85rem' }}>
          <div>
            <h2 className="card-title">Narrative Verification Editor</h2>
            <p className="card-description">
              Review extracted evidence before submitting to the seven-dimensional evaluation rubric engine.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{charCount} chars</span>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <textarea
            className="form-textarea"
            style={{
              minHeight: '320px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              background: 'var(--bg-input)'
            }}
            placeholder={isProcessing ? "Transcribing media waveform via Faster-Whisper..." : "Paste or verify founder pitch narrative here..."}
            value={transcriptText}
            onChange={(e) => {
              setTranscriptText(e.target.value);
              setIsEditing(true);
            }}
            disabled={isAnalyzingActive || isProcessing}
          />
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div>
            {isEditing ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSaveTranscript}
                disabled={isSavingTranscript}
              >
                <Save size={14} />
                <span>{isSavingTranscript ? 'Saving...' : 'Save Transcript Changes'}</span>
              </button>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Info size={13} />
                <span>Transcript synchronized with persistent storage</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRunAnalysis}
              disabled={isAnalyzingActive || isProcessing || !transcriptText.trim()}
              style={{ minWidth: '220px' }}
            >
              {isAnalyzingActive ? (
                <>
                  <RefreshCw size={15} style={{ animation: 'spin 1.5s linear infinite' }} />
                  <span>Evaluating Viability...</span>
                </>
              ) : (
                <>
                  <Play size={15} />
                  <span>Execute Viability Rubric</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
