import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ScoreGauge } from '../components/ScoreGauge.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { HistoryPage } from '../pages/HistoryPage.js';
import { NewScreeningPage } from '../pages/NewScreeningPage.js';
import { TranscriptReviewPage } from '../pages/TranscriptReviewPage.js';
import { api } from '../api/client.js';
import { PitchRecord } from '../types/index.js';

describe('PitchLens Frontend Component & Screen Tests', () => {
  // 1. Sidebar Brand & Navigation
  it('renders PitchLens brand and navigation tabs', () => {
    const handleSelectTab = vi.fn();
    const handleSeedDemo = vi.fn();

    render(
      <Sidebar
        currentTab="dashboard"
        onSelectTab={handleSelectTab}
        onSeedDemo={handleSeedDemo}
        totalPitches={5}
        completedPitches={3}
      />
    );

    expect(screen.getByText('PitchLens')).toBeInTheDocument();
    expect(screen.getByText('Analyst Workspace')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('New Screening')).toBeInTheDocument();
    expect(screen.getByText('Pitch History')).toBeInTheDocument();
    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Load Sample Pitch')).toBeInTheDocument();

    fireEvent.click(screen.getByText('New Screening'));
    expect(handleSelectTab).toHaveBeenCalledWith('new');

    fireEvent.click(screen.getByText('Load Sample Pitch'));
    expect(handleSeedDemo).toHaveBeenCalled();
  });

  // 2. Status Badge Variants
  it('renders status badges with appropriate analyst labels', () => {
    const { rerender } = render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();

    rerender(<StatusBadge status="PROCESSING" />);
    expect(screen.getByText('Processing Media')).toBeInTheDocument();

    rerender(<StatusBadge status="TRANSCRIPTION_READY" />);
    expect(screen.getByText('Transcript Ready')).toBeInTheDocument();

    rerender(<StatusBadge status="FAILED" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();

    rerender(<StatusBadge status="ANALYZING" />);
    expect(screen.getByText('Evaluating Viability')).toBeInTheDocument();
  });

  // 3. Score Gauge & Signals
  it('renders score gauge with score value and qualitative tier', () => {
    render(
      <ScoreGauge
        score={82}
        confidence={0.85}
        method="Deterministic Heuristic Rubric (Rule-Based Fallback)"
      />
    );

    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('High Potential / Priority Diligence')).toBeInTheDocument();
    expect(screen.getByText('Deterministic Heuristic Rubric (Rule-Based Fallback)')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  // 4. Dashboard Screen
  it('renders dashboard with populated metrics and pitch table', () => {
    const mockPitches: PitchRecord[] = [
      {
        id: 'pitch-1',
        startup_name: 'AgriScan AI',
        target_geography: 'South Asia',
        industry: 'Agriculture',
        original_filename: 'pitch.txt',
        input_type: 'TEXT',
        mime_type: 'text/plain',
        stored_file_path: null,
        file_size: 1024,
        status: 'COMPLETED',
        original_transcript: 'Test',
        normalized_transcript: 'Test',
        detected_language: 'en',
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        overall_score: 84
      }
    ];

    const onNavigate = vi.fn();
    const onSeedDemo = vi.fn();

    render(
      <DashboardPage
        pitches={mockPitches}
        isLoading={false}
        onNavigate={onNavigate}
        onSeedDemo={onSeedDemo}
      />
    );

    expect(screen.getByText('Pitch Screening Workspace')).toBeInTheDocument();
    expect(screen.getByText('AgriScan AI')).toBeInTheDocument();
    expect(screen.getByText('Open Dossier')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Open Dossier'));
    expect(onNavigate).toHaveBeenCalledWith('report', 'pitch-1');
  });

  it('renders dashboard empty state when no pitches exist', () => {
    render(
      <DashboardPage
        pitches={[]}
        isLoading={false}
        onNavigate={vi.fn()}
        onSeedDemo={vi.fn()}
      />
    );

    expect(screen.getByText('No Screenings in Workspace')).toBeInTheDocument();
  });

  // 5. History Screen
  it('renders history table with search filter and records', () => {
    const mockPitches: PitchRecord[] = [
      {
        id: 'pitch-2',
        startup_name: 'MedAI Diagnostics',
        target_geography: 'North America',
        industry: 'Healthcare',
        original_filename: 'deck.pdf',
        input_type: 'PDF',
        mime_type: 'application/pdf',
        stored_file_path: null,
        file_size: 2048,
        status: 'TRANSCRIPTION_READY',
        original_transcript: 'Test',
        normalized_transcript: 'Test',
        detected_language: 'en',
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    render(
      <HistoryPage
        pitches={mockPitches}
        isLoading={false}
        onRefresh={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('Pitch Screening History')).toBeInTheDocument();
    expect(screen.getByText('MedAI Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  // 6. New Screening Page: Ingest Modes & Optional Context
  it('renders NewScreeningPage with format tabs and upload zone', () => {
    render(
      <NewScreeningPage
        onPitchCreated={vi.fn()}
        onSeedDemo={vi.fn()}
      />
    );

    expect(screen.getByText('Ingest Startup Pitch')).toBeInTheDocument();
    expect(screen.getByText(/Drop pitch file here, or browse/)).toBeInTheDocument();
    expect(screen.getByText(/Optional Pitch Context/)).toBeInTheDocument();

    // Toggle optional context
    fireEvent.click(screen.getByText(/Optional Pitch Context/));
    expect(screen.getByText(/Startup Name/)).toBeInTheDocument();
    expect(screen.getByText(/Primary Industry/)).toBeInTheDocument();
    expect(screen.getByText(/Target Geography/)).toBeInTheDocument();
  });

  // 7. Transcript Review Page: Failed State & Retry Button
  it('renders TranscriptReviewPage failure banner with specific error and retry action', async () => {
    const mockPitch: PitchRecord = {
      id: 'failed-pitch-1',
      startup_name: 'Unknown',
      target_geography: 'Unknown',
      industry: 'Unknown',
      original_filename: 'pitch.mp4',
      input_type: 'VIDEO',
      mime_type: 'video/mp4',
      stored_file_path: '/tmp/pitch.mp4',
      file_size: 1024,
      status: 'FAILED',
      original_transcript: '',
      normalized_transcript: '',
      detected_language: null,
      error_message: "Faster-Whisper transcription failed: open() got an unexpected keyword argument 'metadata_errors'",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    vi.spyOn(api, 'getPitch').mockResolvedValue(mockPitch);
    const retrySpy = vi.spyOn(api, 'retryPitch').mockResolvedValue({
      ...mockPitch,
      status: 'QUEUED',
      error_message: null
    });

    render(
      <TranscriptReviewPage
        pitchId="failed-pitch-1"
        onAnalysisComplete={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(await screen.findByText('Ingestion / Transcription Failed')).toBeInTheDocument();
    expect(screen.getByText(/metadata_errors/)).toBeInTheDocument();
    expect(screen.getByText('Retry Ingestion')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Retry Ingestion'));
    expect(retrySpy).toHaveBeenCalledWith('failed-pitch-1');
  });
});
