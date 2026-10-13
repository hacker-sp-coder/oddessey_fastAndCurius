import React, { useState, useRef } from 'react';
import { api } from '../api/client.js';
import { Upload, FileText, CheckCircle2, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';

interface NewScreeningPageProps {
  onPitchCreated: (pitchId: string) => void;
  onSeedDemo: () => void;
}

export const NewScreeningPage: React.FC<NewScreeningPageProps> = ({
  onPitchCreated,
  onSeedDemo
}) => {
  const [mode, setMode] = useState<'upload' | 'manual'>('upload');
  const [startupName, setStartupName] = useState('');
  const [industry, setIndustry] = useState('Agriculture');
  const [geography, setGeography] = useState('South Asia');
  const [manualTranscript, setManualTranscript] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_FILE_SIZE_MB = 100;
  const ACCEPTED_EXTENSIONS = '.mp4,.mov,.webm,.wav,.mp3,.m4a,.pdf,.txt,.md';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds limit of ${MAX_FILE_SIZE_MB}MB.`);
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      if (!startupName) {
        // Derive startup name from filename
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setStartupName(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'upload' && !selectedFile) {
      setError('Please select a video, audio, PDF, or text file to upload.');
      return;
    }

    if (mode === 'manual' && (!manualTranscript || !manualTranscript.trim())) {
      setError('Please paste or type the pitch transcript before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'upload' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('startup_name', startupName || selectedFile.name);
        formData.append('industry', industry);
        formData.append('target_geography', geography);

        const created = await api.uploadPitch(formData);
        onPitchCreated(created.id);
      } else {
        const created = await api.createManualPitch({
          startup_name: startupName || 'Manual Pitch',
          industry,
          target_geography: geography,
          manual_transcript: manualTranscript
        });
        onPitchCreated(created.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit pitch for screening.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            New Startup Screening
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Submit an audio/video pitch, PDF deck summary, or raw founder transcript for viability triage.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={onSeedDemo}
          title="Instant pre-computed evaluation using AgriScan AI bundled fixture"
        >
          <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>Use Bundled Demo Fixture</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      {/* Mode Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--bg-tertiary)', padding: '0.35rem', borderRadius: 'var(--radius-sm)' }}>
        <button
          type="button"
          className="btn"
          style={{
            flex: 1,
            background: mode === 'upload' ? 'var(--bg-card)' : 'transparent',
            color: mode === 'upload' ? 'var(--text-main)' : 'var(--text-muted)',
            boxShadow: mode === 'upload' ? 'var(--shadow-sm)' : 'none'
          }}
          onClick={() => { setMode('upload'); setError(null); }}
        >
          <Upload size={16} />
          <span>Upload File (Video / Audio / PDF / TXT)</span>
        </button>

        <button
          type="button"
          className="btn"
          style={{
            flex: 1,
            background: mode === 'manual' ? 'var(--bg-card)' : 'transparent',
            color: mode === 'manual' ? 'var(--text-main)' : 'var(--text-muted)',
            boxShadow: mode === 'manual' ? 'var(--shadow-sm)' : 'none'
          }}
          onClick={() => { setMode('manual'); setError(null); }}
        >
          <FileText size={16} />
          <span>Paste / Type Transcript Directly</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card">
        {/* Startup Metadata */}
        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Startup Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. AgriScan AI"
              value={startupName}
              onChange={(e) => setStartupName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Primary Industry</label>
            <select
              className="form-select"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              <option value="Agriculture">Agriculture / Agritech</option>
              <option value="Healthcare">Healthcare / HealthTech</option>
              <option value="FinTech">FinTech & Payments</option>
              <option value="B2B SaaS">B2B SaaS / Enterprise</option>
              <option value="CleanTech">CleanTech & Energy</option>
              <option value="General Tech">Other / General Tech</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Target Geography</label>
            <select
              className="form-select"
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
            >
              <option value="South Asia">South Asia</option>
              <option value="North America">North America</option>
              <option value="Europe">Europe</option>
              <option value="Southeast Asia">Southeast Asia</option>
              <option value="Latin America">Latin America</option>
              <option value="Global">Global / Cross-border</option>
            </select>
          </div>
        </div>

        {/* Input Mode 1: File Upload */}
        {mode === 'upload' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                border: selectedFile ? '2px solid var(--accent-cyan)' : '2px dashed var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: selectedFile ? 'var(--accent-cyan-bg)' : 'var(--bg-input)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {selectedFile ? (
                <div>
                  <CheckCircle2 size={40} style={{ color: 'var(--accent-cyan)', marginBottom: '0.75rem' }} />
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to replace file
                  </div>
                </div>
              ) : (
                <div>
                  <Upload size={36} style={{ color: 'var(--text-dim)', marginBottom: '0.75rem' }} />
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                    Drop pitch file here or click to browse
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Supported: MP4, MOV, WEBM, WAV, MP3, M4A, PDF, TXT, MD (Max {MAX_FILE_SIZE_MB}MB)
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              * Audio/Video files are extracted via local FFmpeg. If local Whisper is unconfigured, you can review and supply the speech transcript before running evaluation.
            </div>
          </div>
        )}

        {/* Input Mode 2: Manual Transcript */}
        {mode === 'manual' && (
          <div className="form-group">
            <label className="form-label">Pitch Transcript / Pitch Deck Narrative</label>
            <textarea
              className="form-textarea"
              placeholder="Paste transcript here. Example:&#10;[00:00] AgriScan AI is an offline AI tool for 120M farmers...&#10;[00:20] We license our B2B2C enterprise dashboard for $1.20/farmer/year..."
              rows={8}
              value={manualTranscript}
              onChange={(e) => setManualTranscript(e.target.value)}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Include timestamps (e.g. [00:15]) if available to enable verifiable evidence links in the assessment report.
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ minWidth: '160px' }}
          >
            {isSubmitting ? (
              <span>Submitting...</span>
            ) : (
              <>
                <span>Continue to Screening</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
