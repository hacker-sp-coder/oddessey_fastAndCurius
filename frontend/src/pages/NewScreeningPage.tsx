import React, { useState, useRef } from 'react';
import { api } from '../api/client.js';
import { 
  Upload, 
  FileText, 
  Video, 
  Mic, 
  Sparkles, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  FileCheck, 
  Info
} from 'lucide-react';

interface NewScreeningPageProps {
  onPitchCreated: (pitchId: string) => void;
  onSeedDemo: (demoType?: string) => void;
}

type IngestionTab = 'document' | 'media' | 'text' | 'sample';

export const NewScreeningPage: React.FC<NewScreeningPageProps> = ({
  onPitchCreated,
  onSeedDemo
}) => {
  const [activeTab, setActiveTab] = useState<IngestionTab>('document');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualTranscript, setManualTranscript] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Optional metadata context (not blocking submission)
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [startupName, setStartupName] = useState('');
  const [industry, setIndustry] = useState('');
  const [geography, setGeography] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_FILE_SIZE_MB = 100;

  const getAcceptedExtensions = () => {
    switch (activeTab) {
      case 'document':
        return '.pdf,.txt,.md';
      case 'media':
        return '.mp4,.mov,.webm,.wav,.mp3,.m4a';
      default:
        return '.pdf,.txt,.md,.mp4,.mov,.webm,.wav,.mp3';
    }
  };

  const handleFileSelect = (file: File) => {
    setError(null);
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds limit of ${MAX_FILE_SIZE_MB}MB.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeTab === 'sample') {
      onSeedDemo();
      return;
    }

    if ((activeTab === 'document' || activeTab === 'media') && !selectedFile) {
      setError('Please select a file to upload before submitting.');
      return;
    }

    if (activeTab === 'text' && (!manualTranscript || !manualTranscript.trim())) {
      setError('Please provide pitch narrative or transcript text.');
      return;
    }

    setIsSubmitting(true);

    try {
      if ((activeTab === 'document' || activeTab === 'media') && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (startupName.trim()) formData.append('startup_name', startupName.trim());
        if (industry.trim()) formData.append('industry', industry.trim());
        if (geography.trim()) formData.append('target_geography', geography.trim());

        const created = await api.uploadPitch(formData);
        onPitchCreated(created.id);
      } else {
        const created = await api.createManualPitch({
          startup_name: startupName.trim() || undefined,
          industry: industry.trim() || undefined,
          target_geography: geography.trim() || undefined,
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
    <div className="workspace-container" style={{ maxWidth: '880px' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Ingest Startup Pitch</h1>
          <p className="page-description">
            Submit presentation decks, audio recordings, pitch videos, or text narratives for structured evaluation.
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger" role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>{error}</div>
        </div>
      )}

      {/* Ingestion Mode Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.25rem',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '0.75rem',
        overflowX: 'auto'
      }}>
        <button
          type="button"
          className={`btn ${activeTab === 'document' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setActiveTab('document'); setSelectedFile(null); }}
        >
          <FileText size={15} />
          <span>Pitch Deck (PDF / Text)</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'media' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setActiveTab('media'); setSelectedFile(null); }}
        >
          <Video size={15} />
          <span>Media (Video / Audio)</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'text' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => { setActiveTab('text'); setSelectedFile(null); }}
        >
          <Mic size={15} />
          <span>Pasted Narrative</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'sample' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('sample')}
        >
          <Sparkles size={15} style={{ color: activeTab === 'sample' ? '#000' : 'var(--accent-primary)' }} />
          <span>Benchmark Sample</span>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Sample Pitch Preset Tab */}
        {activeTab === 'sample' ? (
          <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <Sparkles size={36} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>AgriScan AI Benchmark Sample</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
              Load our pre-configured Agritech drone crop scanner pitch (500 pilot farmers, $12/yr SaaS coop model in South Asia) to inspect the complete 7-dimension evaluation dossier immediately.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onSeedDemo()}
            >
              <span>Instant Benchmark Screening</span>
              <ArrowRight size={15} />
            </button>
          </div>
        ) : activeTab === 'text' ? (
          /* Text Pitch Ingestion Tab */
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="manual_transcript">
                Founder Pitch Narrative or Transcript
              </label>
              <textarea
                id="manual_transcript"
                className="form-textarea"
                rows={10}
                placeholder="Paste the founder's pitch narrative, meeting transcript, or problem-solution breakdown here..."
                value={manualTranscript}
                onChange={(e) => setManualTranscript(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.825rem', lineHeight: 1.6 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                <span>Word count: {manualTranscript.trim() ? manualTranscript.trim().split(/\s+/).length : 0}</span>
                <span>Minimum recommended: ~100 words for substantive scoring</span>
              </div>
            </div>
          </div>
        ) : (
          /* File Upload Dropzone Tab (Document or Media) */
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept={getAcceptedExtensions()}
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                backgroundColor: isDragOver ? 'var(--accent-primary-dim)' : 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                padding: '2.75rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {selectedFile ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-success-bg)',
                    border: '1px solid var(--color-success-border)',
                    color: 'var(--color-success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.875rem'
                  }}>
                    <FileCheck size={22} />
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Binary file'}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '0.75rem', textDecoration: 'underline' }}>
                    Click or drop to replace file
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.875rem'
                  }}>
                    <Upload size={20} />
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    Drop pitch file here, or browse
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    {activeTab === 'document' ? 'Supports PDF pitch decks, TXT, and Markdown files' : 'Supports MP4, MOV, WEBM videos, and WAV, MP3 recordings'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                    Maximum file size: {MAX_FILE_SIZE_MB} MB
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Optional Context Accordion (Never blocks upload) */}
        {activeTab !== 'sample' && (
          <div className="card" style={{ marginBottom: '1.75rem', padding: '1rem 1.25rem' }}>
            <button
              type="button"
              onClick={() => setShowOptionalDetails(!showOptionalDetails)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Info size={15} style={{ color: 'var(--text-muted)' }} />
                <span>Optional Pitch Context</span>
                <span style={{ fontSize: '0.725rem', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                  (Auto-inferred if omitted)
                </span>
              </div>
              {showOptionalDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showOptionalDetails && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  If omitted, PitchLens will automatically extract and infer the startup name, industry, and target geography from the pitch content during evaluation.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="startup_name">
                      Startup Name <span className="form-label-optional">(optional)</span>
                    </label>
                    <input
                      id="startup_name"
                      type="text"
                      className="form-input"
                      placeholder="e.g. AgriScan AI"
                      value={startupName}
                      onChange={(e) => setStartupName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="industry">
                      Primary Industry <span className="form-label-optional">(optional)</span>
                    </label>
                    <input
                      id="industry"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Agriculture / AI"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="geography">
                      Target Geography <span className="form-label-optional">(optional)</span>
                    </label>
                    <input
                      id="geography"
                      type="text"
                      className="form-input"
                      placeholder="e.g. South Asia / Global"
                      value={geography}
                      onChange={(e) => setGeography(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Actions */}
        {activeTab !== 'sample' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || ((activeTab === 'document' || activeTab === 'media') && !selectedFile) || (activeTab === 'text' && !manualTranscript.trim())}
              style={{ minWidth: '180px' }}
            >
              {isSubmitting ? (
                <span>Ingesting Pitch...</span>
              ) : (
                <>
                  <span>Initiate Screening</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
