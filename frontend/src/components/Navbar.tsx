import React from 'react';
import { LayoutDashboard, PlusCircle, History, Activity, Sparkles } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onSeedDemo: () => void;
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
          <div className="brand-icon">S</div>
          <div>
            <span className="brand-text">ScreenAI</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '1px' }}>
              <span className="brand-badge">MVP Edition</span>
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
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', borderColor: 'var(--accent-cyan)' }}
            onClick={onSeedDemo}
            disabled={isSeedingDemo}
            title="Load instant pre-computed demo evaluation (AgriScan AI)"
          >
            <Sparkles size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span>{isSeedingDemo ? 'Loading...' : 'Demo Pitch'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
