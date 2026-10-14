import React from 'react';
import { LayoutDashboard, PlusCircle, History, Activity, Sparkles } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onSeedDemo: (demoType?: string) => void;
  isSeedingDemo?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onSeedDemo,
  isSeedingDemo = false
}) => {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <a 
          href="#dashboard" 
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('dashboard');
          }}
        >
          <div className="brand-icon">P</div>
          <div>
            <span className="brand-text">PitchLens</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '1px' }}>
              <span className="brand-badge">Analyst Workspace</span>
            </div>
          </div>
        </a>

        <div className="nav-links">
          <button
            className={`nav-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onSelectTab('dashboard')}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-btn ${currentTab === 'new' ? 'active' : ''}`}
            onClick={() => onSelectTab('new')}
          >
            <PlusCircle size={16} />
            <span>New Pitch</span>
          </button>

          <button
            className={`nav-btn ${currentTab === 'history' ? 'active' : ''}`}
            onClick={() => onSelectTab('history')}
          >
            <History size={16} />
            <span>History</span>
          </button>

          <button
            className={`nav-btn ${currentTab === 'settings' ? 'active' : ''}`}
            onClick={() => onSelectTab('settings')}
          >
            <Activity size={16} />
            <span>System Health</span>
          </button>

          <button
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', borderColor: 'var(--color-synthetic)' }}
            onClick={() => onSeedDemo('doordash')}
            disabled={isSeedingDemo}
            title="Load DoorDash YC S13 demo pitch with synthetic market evidence"
          >
            <Sparkles size={14} style={{ color: 'var(--color-synthetic)' }} />
            <span>{isSeedingDemo ? 'Loading...' : 'DoorDash Demo'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
