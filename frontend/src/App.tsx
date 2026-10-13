import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api/client.js';
import { PitchRecord } from './types/index.js';
import { Navbar } from './components/Navbar.js';
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
    // Refresh pitches on navigating back to dashboard or history
    if (tab === 'dashboard' || tab === 'history') {
      loadPitches();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSeedDemo = async () => {
    setIsSeedingDemo(true);
    try {
      const res = await api.seedDemoPitch();
      showToast('Loaded AgriScan AI demo pitch successfully.');
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

  return (
    <div className="app-container">
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleNavigate}
        onSeedDemo={handleSeedDemo}
        isSeedingDemo={isSeedingDemo}
      />

      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--accent-cyan)',
          color: 'var(--text-main)',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 100,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="main-content">
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
  );
};
