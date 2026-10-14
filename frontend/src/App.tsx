import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api/client.js';
import { PitchRecord } from './types/index.js';
import { Sidebar } from './components/Sidebar.js';
import { TopBar } from './components/TopBar.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { NewScreeningPage } from './pages/NewScreeningPage.js';
import { TranscriptReviewPage } from './pages/TranscriptReviewPage.js';
import { ReportPage } from './pages/ReportPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { SettingsHealthPage } from './pages/SettingsHealthPage.js';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activePitchId, setActivePitchId] = useState<string | null>(null);
  const [pitches, setPitches] = useState<PitchRecord[]>([]);
  const [isLoadingPitches, setIsLoadingPitches] = useState<boolean>(true);
  const [isSeedingDemo, setIsSeedingDemo] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadPitches = useCallback(async () => {
    setIsLoadingPitches(true);
    try {
      const data = await api.fetchPitches();
      setPitches(data);
    } catch (err: any) {
      console.warn('Could not load pitches list:', err);
    } finally {
      setIsLoadingPitches(false);
    }
  }, []);

  useEffect(() => {
    loadPitches();
  }, [loadPitches]);

  const handleNavigate = (tab: string, pitchId?: string) => {
    setCurrentTab(tab);
    if (pitchId) {
      setActivePitchId(pitchId);
    }
    if (tab === 'dashboard' || tab === 'history') {
      loadPitches();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSeedDemo = async (demoType: string = 'doordash') => {
    setIsSeedingDemo(true);
    try {
      const res = await api.seedDemoPitch(demoType);
      const isDD = demoType === 'doordash' || res.pitch.id.includes('doordash');
      showToast(isDD ? 'Loaded DoorDash YC S13 demo screening dossier.' : 'Loaded AgriScan AI benchmark screening dossier.');
      await loadPitches();
      setActivePitchId(res.pitch.id);
      setCurrentTab('report');
    } catch (err: any) {
      alert(`Failed to load demo pitch: ${err.message}`);
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const handlePitchCreated = (pitchId: string) => {
    setActivePitchId(pitchId);
    setCurrentTab('review');
    loadPitches();
  };

  const handleAnalysisComplete = (pitchId: string) => {
    setActivePitchId(pitchId);
    setCurrentTab('report');
    loadPitches();
  };

  // Find active pitch name for breadcrumb in TopBar
  const activePitch = activePitchId ? pitches.find(p => p.id === activePitchId) : null;
  const activePitchName = activePitch?.startup_name || (activePitchId ? `Pitch ${activePitchId.slice(0, 8)}` : null);

  const totalPitches = pitches.length;
  const completedPitches = pitches.filter(p => p.status === 'COMPLETED').length;

  return (
    <div className="app-shell">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Persistent Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleNavigate}
        onSeedDemo={handleSeedDemo}
        isSeedingDemo={isSeedingDemo}
        totalPitches={totalPitches}
        completedPitches={completedPitches}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="app-main-area">
        <TopBar
          currentTab={currentTab}
          activePitchName={activePitchName}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigateNew={() => handleNavigate('new')}
        />

        <main className="app-content">
          {currentTab === 'dashboard' && (
            <DashboardPage
              pitches={pitches}
              isLoading={isLoadingPitches}
              onNavigate={handleNavigate}
              onSeedDemo={handleSeedDemo}
            />
          )}

          {currentTab === 'new' && (
            <NewScreeningPage
              onPitchCreated={handlePitchCreated}
              onSeedDemo={handleSeedDemo}
            />
          )}

          {currentTab === 'review' && activePitchId && (
            <TranscriptReviewPage
              pitchId={activePitchId}
              onAnalysisComplete={handleAnalysisComplete}
              onBack={() => handleNavigate('dashboard')}
            />
          )}

          {currentTab === 'report' && activePitchId && (
            <ReportPage
              pitchId={activePitchId}
              onBack={() => handleNavigate('dashboard')}
              onReviewTranscript={(id) => handleNavigate('review', id)}
            />
          )}

          {currentTab === 'history' && (
            <HistoryPage
              pitches={pitches}
              isLoading={isLoadingPitches}
              onRefresh={loadPitches}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsHealthPage />
          )}
        </main>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--accent-primary)',
          color: 'var(--text-main)',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 1000,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>•</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
