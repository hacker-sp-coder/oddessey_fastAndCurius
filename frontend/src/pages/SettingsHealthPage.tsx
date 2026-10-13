import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { SystemCapabilities } from '../types/index.js';
import { 
  CheckCircle2, XCircle, RefreshCw, Cpu, 
  Database, Server, AlertCircle 
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
      setError(err.message || 'Failed to connect to backend services.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            System Health & Provider Capabilities
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Live status of services, database, FFmpeg, transcription engines, and evaluation providers.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={fetchStatus}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          <span>Refresh Health</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* Primary Infrastructure Grid */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        {/* Node.js API */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={18} style={{ color: 'var(--accent-cyan)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Node.js Express API</h3>
            </div>
            {healthData ? (
              <span className="badge badge-COMPLETED">Online</span>
            ) : (
              <span className="badge badge-FAILED">Offline</span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <div>Port: 4000</div>
            <div>Runtime: {healthData?.node_version || 'Node.js'}</div>
            <div>Max Upload: {capabilities?.api_server?.max_upload_size_mb || 100} MB</div>
          </div>
        </div>

        {/* SQLite Database */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} style={{ color: 'var(--accent-indigo)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>SQLite Storage</h3>
            </div>
            {healthData?.database?.status === 'ok' ? (
              <span className="badge badge-COMPLETED">Connected</span>
            ) : (
              <span className="badge badge-FAILED">Error</span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <div>Driver: better-sqlite3</div>
            <div>Journal Mode: WAL</div>
            <div>State: Idempotent Schema Ready</div>
          </div>
        </div>

        {/* Python AI Service */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} style={{ color: 'var(--accent-emerald)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Python AI Service</h3>
            </div>
            {healthData?.ai_service?.status === 'ok' ? (
              <span className="badge badge-COMPLETED">Online</span>
            ) : (
              <span className="badge badge-FAILED">Offline</span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <div>Port: 8000 (FastAPI)</div>
            <div>FFmpeg: {healthData?.ai_service?.ffmpeg_available ? 'Available' : 'Missing'}</div>
            <div>CUDA GPU: {capabilities?.ai_service?.cuda_available ? 'Detected' : 'CPU Mode (Safe)'}</div>
          </div>
        </div>
      </div>

      {/* Transcription Providers Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Speech-to-Text Transcription Providers</h3>
            <p className="card-description">
              Hardware requirement analysis and operational provider status (zero secrets exposed)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                    <strong style={{ textTransform: 'capitalize' }}>{p.name}</strong>
                    {capabilities.ai_service.active_transcription_provider === p.name && (
                      <span className="badge badge-TRANSCRIPTION_READY" style={{ fontSize: '0.65rem' }}>Active Default</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {p.details}
                  </div>
                </div>

                <div>
                  {p.available ? (
                    <span className="badge badge-COMPLETED">
                      <CheckCircle2 size={12} />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <span className="badge badge-FAILED">
                      <XCircle size={12} />
                      <span>Unconfigured</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              AI service is not reporting transcription providers.
            </div>
          )}
        </div>
      </div>

      {/* Evaluation Rubric Providers Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Startup Viability Evaluation Providers</h3>
            <p className="card-description">
              Deterministic offline heuristic rubric vs hosted LLM synthesis
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {capabilities?.ai_service?.evaluation_providers ? (
            capabilities.ai_service.evaluation_providers.map((p) => (
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
                    <strong style={{ textTransform: 'capitalize' }}>{p.name}</strong>
                    {capabilities.ai_service.active_evaluation_provider === p.name && (
                      <span className="badge badge-TRANSCRIPTION_READY" style={{ fontSize: '0.65rem' }}>Active Default</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {p.details}
                  </div>
                </div>

                <div>
                  {p.available ? (
                    <span className="badge badge-COMPLETED">
                      <CheckCircle2 size={12} />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <span className="badge badge-FAILED">
                      <XCircle size={12} />
                      <span>Unconfigured</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              AI service is not reporting evaluation providers.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
