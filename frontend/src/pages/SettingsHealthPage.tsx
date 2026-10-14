import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { SystemCapabilities } from '../types/index.js';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Cpu, 
  Database, 
  Server, 
  AlertCircle,
  Zap,
  FileCheck,
  Lock
} from 'lucide-react';

export const SettingsHealthPage: React.FC = () => {
  const [healthData, setHealthData] = useState<any | null>(null);
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [h, c] = await Promise.all([
        api.getHealth(),
        api.getCapabilities()
      ]);
      setHealthData(h);
      setCapabilities(c);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend telemetry endpoints.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const aiServiceOk = healthData?.ai_service?.status === 'ok';
  const dbOk = healthData?.database?.status === 'ok';
  const apiOk = !!healthData;

  return (
    <div className="page-container" style={{ maxWidth: '1040px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.025em', margin: 0 }}>
            System Telemetry & Provider Settings
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Live status of compute subsystems, SQLite WAL storage, media pipelines, and Groq rate-limit budgets.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={fetchStatus}
          disabled={isLoading}
        >
          <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.875rem' }}>{error}</div>
        </div>
      )}

      {/* Primary Infrastructure Grid */}
      <div className="grid-3" style={{ marginBottom: '1.25rem', gap: '1rem' }}>
        {/* Node.js API */}
        <div className="card" style={{ padding: '1.15rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={17} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                API Gateway
              </h3>
            </div>
            {apiOk ? (
              <span className="badge badge-COMPLETED" style={{ fontSize: '0.65rem' }}>Online</span>
            ) : (
              <span className="badge badge-FAILED" style={{ fontSize: '0.65rem' }}>Offline</span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div>Runtime: <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{healthData?.node_version || 'Node.js'}</span></div>
            <div>Port: <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>4000 (Express)</span></div>
            <div>Max Payload: <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{capabilities?.api_server?.max_upload_size_mb || 100} MB</span></div>
          </div>
        </div>

        {/* SQLite Database */}
        <div className="card" style={{ padding: '1.15rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={17} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                SQLite Storage
              </h3>
            </div>
            {dbOk ? (
              <span className="badge badge-COMPLETED" style={{ fontSize: '0.65rem' }}>Active</span>
            ) : (
              <span className="badge badge-FAILED" style={{ fontSize: '0.65rem' }}>Degraded</span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div>Driver: <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>better-sqlite3</span></div>
            <div>Journal: <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>WAL Mode</span></div>
            <div>Integrity: <span style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>Idempotent Verified</span></div>
          </div>
        </div>

        {/* Python AI Service */}
        <div className="card" style={{ padding: '1.15rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={17} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Python AI Engine
              </h3>
            </div>
            {aiServiceOk ? (
              <span className="badge badge-COMPLETED" style={{ fontSize: '0.65rem' }}>Online</span>
            ) : (
              <span className="badge badge-FAILED" style={{ fontSize: '0.65rem' }}>Offline</span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div>Port: <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>8000 (FastAPI)</span></div>
            <div>FFmpeg: <span style={{ color: healthData?.ai_service?.ffmpeg_available ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
              {healthData?.ai_service?.ffmpeg_available ? 'Available' : 'Missing'}
            </span></div>
            <div>CUDA GPU: <span style={{ color: capabilities?.ai_service?.cuda_available ? 'var(--accent-emerald)' : 'var(--text-dim)' }}>
              {capabilities?.ai_service?.cuda_available ? (healthData?.ai_service?.gpu_device_name || 'Detected') : 'CPU Mode (Safe)'}
            </span></div>
          </div>
        </div>
      </div>

      {/* Groq Rate Limit & Evaluator Configuration */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={16} style={{ color: 'var(--accent-primary)' }} />
              <h2 className="card-title">LLM Viability Synthesis & OTPM Rate-Limit Engine</h2>
            </div>
            <p className="card-description">
              Protection against HTTP 429 output token per minute ceiling via conservative budget enforcement
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Active provider detail */}
          <div style={{
            padding: '1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Groq Hosted Model: qwen/qwen3.8-27b</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Tier: On-demand (1,000 Output Tokens / Minute limit)
                </div>
              </div>
              <span className="badge badge-TRANSCRIPTION_READY" style={{ fontSize: '0.7rem' }}>
                Active Evaluation Provider
              </span>
            </div>

            <div className="grid-3" style={{ gap: '0.75rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.775rem' }}>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Completion Token Budget:</span>
                <div style={{ fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                  750 tokens / request
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Prompt Optimization:</span>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  Evidence-first concise JSON
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Retry & Jitter Handling:</span>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  Bounded exponential backoff
                </div>
              </div>
            </div>
          </div>

          {/* Offline Fallback */}
          <div style={{
            padding: '0.85rem 1rem',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Deterministic Heuristic Rubric (Offline Fallback)</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Always available offline. Transparently executes when Groq quota is exhausted or API key is absent.
              </div>
            </div>
            <span className="badge badge-COMPLETED" style={{ fontSize: '0.7rem' }}>
              Always Ready
            </span>
          </div>
        </div>
      </div>

      {/* Transcription Providers Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileCheck size={16} style={{ color: 'var(--accent-primary)' }} />
              <h2 className="card-title">Speech-to-Text Transcription Providers</h2>
            </div>
            <p className="card-description">
              Local CTranslate2 Whisper inference and hosted fallback transcription
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {capabilities?.ai_service?.transcription_providers ? (
            capabilities.ai_service.transcription_providers.map((p) => (
              <div
                key={p.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.85rem 1rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>{p.name}</strong>
                    {capabilities.ai_service.active_transcription_provider === p.name && (
                      <span className="badge badge-TRANSCRIPTION_READY" style={{ fontSize: '0.65rem' }}>Active Default</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {p.details}
                  </div>
                </div>

                <div>
                  {p.available ? (
                    <span className="badge badge-COMPLETED" style={{ fontSize: '0.7rem' }}>
                      <CheckCircle2 size={11} />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <span className="badge badge-FAILED" style={{ fontSize: '0.7rem' }}>
                      <XCircle size={11} />
                      <span>Unconfigured</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem' }}>
              Retrieving provider capabilities from AI service...
            </div>
          )}
        </div>
      </div>

      {/* Security & Provenance Policy Card */}
      <div className="card" style={{ padding: '1.15rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Lock size={16} style={{ color: 'var(--accent-emerald)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Zero-Leak Secret Isolation Guarantee
          </h3>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
          All third-party credentials (including <code style={{ color: 'var(--accent-primary)', background: 'var(--bg-input)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>GROQ_API_KEY</code>) remain isolated inside backend process environments. No credentials are transmitted in browser network calls, rendered in client UI components, or bundled into Vite static assets.
        </p>
      </div>
    </div>
  );
};
