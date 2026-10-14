import React from 'react';
import { Menu, Plus, ChevronRight } from 'lucide-react';

interface TopBarProps {
  currentTab: string;
  activePitchName?: string | null;
  onOpenMobileMenu: () => void;
  onNavigateNew: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  activePitchName,
  onOpenMobileMenu,
  onNavigateNew
}) => {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Analyst Dashboard';
      case 'new':
        return 'Ingest & Screen Pitch';
      case 'review':
        return 'Transcript Verification';
      case 'report':
        return 'Viability Assessment Dossier';
      case 'history':
        return 'Screening History & Repositories';
      case 'settings':
        return 'System Telemetry & Providers';
      default:
        return 'PitchLens';
    }
  };

  return (
    <header className="app-topbar no-print">
      <div className="topbar-left">
        <button
          className="mobile-menu-btn"
          onClick={onOpenMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>

        <nav aria-label="Breadcrumb" className="topbar-breadcrumbs">
          <span>PitchLens</span>
          <ChevronRight size={14} style={{ color: 'var(--text-disabled)' }} />
          <span className="topbar-breadcrumb-curr">{getTabTitle()}</span>
          {activePitchName && (currentTab === 'report' || currentTab === 'review') && (
            <>
              <ChevronRight size={14} style={{ color: 'var(--text-disabled)' }} />
              <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                {activePitchName}
              </span>
            </>
          )}
        </nav>
      </div>

      <div className="topbar-right">
        {currentTab !== 'new' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onNavigateNew}
            title="Start a new startup idea screening"
          >
            <Plus size={14} />
            <span>New Screening</span>
          </button>
        )}
      </div>
    </header>
  );
};
