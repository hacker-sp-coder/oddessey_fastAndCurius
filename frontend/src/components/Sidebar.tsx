import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Activity, 
  Sparkles,
  X
} from 'lucide-react';
import { api } from '../api/client.js';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onSeedDemo: (demoType?: string) => void;
  isSeedingDemo?: boolean;
  totalPitches?: number;
  completedPitches?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onSeedDemo,
  isSeedingDemo = false,
  totalPitches = 0,
  completedPitches = 0,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const [healthStatus, setHealthStatus] = useState<'operational' | 'degraded' | 'offline' | 'unknown'>('unknown');
  const [activeEngine, setActiveEngine] = useState<string>('checking...');

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const [healthRes, capRes] = await Promise.allSettled([
          api.getHealth(),
          api.getCapabilities()
        ]);

        if (!mounted) return;

        if (healthRes.status === 'fulfilled' && healthRes.value.status === 'ok') {
          const aiOk = healthRes.value.ai_service?.status === 'ok';
          if (aiOk) {
            setHealthStatus('operational');
            const evalProvider = capRes.status === 'fulfilled' 
              ? capRes.value.ai_service?.active_evaluation_provider 
              : 'groq';
            setActiveEngine(evalProvider === 'groq' ? 'Groq / qwen3.8' : 'Heuristic Engine');
          } else {
            setHealthStatus('degraded');
            setActiveEngine('AI Service Degraded');
          }
        } else {
          setHealthStatus('offline');
          setActiveEngine('Backend Offline');
        }
      } catch {
        if (mounted) {
          setHealthStatus('offline');
          setActiveEngine('API Offline');
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleNavClick = (tab: string) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside className={`app-sidebar ${isOpenMobile ? 'open' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-icon-wrapper" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="10" stroke="#38bdf8" strokeWidth="2.2" strokeOpacity="0.9" />
            <path d="M16 3.5V7M16 25V28.5M3.5 16H7M25 16H28.5" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.8" />
            <circle cx="16" cy="16" r="4.5" fill="#0284c7" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="1.5" />
            <circle cx="16" cy="16" r="1.75" fill="#ffffff" />
          </svg>
        </div>

        <div className="brand-info">
          <span className="brand-name">PitchLens</span>
          <span className="brand-sub">Analyst Workspace</span>
        </div>

        {onCloseMobile && (
          <button 
            className="mobile-close-btn no-print" 
            onClick={onCloseMobile}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: isOpenMobile ? 'block' : 'none'
            }}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="sidebar-nav">
        <span className="nav-section-label">Screening Platform</span>

        <button
          className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleNavClick('dashboard')}
          aria-current={currentTab === 'dashboard' ? 'page' : undefined}
        >
          <LayoutDashboard size={17} />
          <span>Dashboard</span>
          {totalPitches > 0 && (
            <span className="nav-item-badge">{totalPitches}</span>
          )}
        </button>

        <button
          className={`nav-item ${currentTab === 'new' ? 'active' : ''}`}
          onClick={() => handleNavClick('new')}
          aria-current={currentTab === 'new' ? 'page' : undefined}
        >
          <PlusCircle size={17} />
          <span>New Screening</span>
        </button>

        <button
          className={`nav-item ${currentTab === 'history' ? 'active' : ''}`}
          onClick={() => handleNavClick('history')}
          aria-current={currentTab === 'history' ? 'page' : undefined}
        >
          <History size={17} />
          <span>Pitch History</span>
          {completedPitches > 0 && (
            <span className="nav-item-badge">{completedPitches}</span>
          )}
        </button>

        <span className="nav-section-label" style={{ marginTop: '0.75rem' }}>Infrastructure</span>

        <button
          className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavClick('settings')}
          aria-current={currentTab === 'settings' ? 'page' : undefined}
        >
          <Activity size={17} />
          <span>System Health</span>
        </button>
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <button
          className="demo-seed-btn"
          onClick={() => onSeedDemo('doordash')}
          disabled={isSeedingDemo}
          title="Seed and inspect DoorDash YC S13 demo pitch with synthetic market evidence"
        >
          <Sparkles size={14} style={{ color: 'var(--color-synthetic)' }} />
          <span>{isSeedingDemo ? 'Loading Demo...' : 'Load Sample Pitch'}</span>
        </button>

        {/* Real System Telemetry Indicator */}
        <div className="system-status-indicator" title={`Status: ${healthStatus} • Engine: ${activeEngine}`}>
          <div className="status-indicator-left">
            <span 
              className={`status-dot ${
                healthStatus === 'operational' ? '' :
                healthStatus === 'degraded' ? 'warning' :
                healthStatus === 'offline' ? 'danger' : 'unknown'
              }`} 
            />
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {healthStatus === 'operational' ? 'Operational' :
               healthStatus === 'degraded' ? 'Degraded' :
               healthStatus === 'offline' ? 'Offline' : 'Checking...'}
            </span>
          </div>
          <span className="status-engine-text">{activeEngine}</span>
        </div>
      </div>
    </aside>
  );
};
