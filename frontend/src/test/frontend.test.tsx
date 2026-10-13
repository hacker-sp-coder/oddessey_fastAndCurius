import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '../components/Navbar.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { ScoreGauge } from '../components/ScoreGauge.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { HistoryPage } from '../pages/HistoryPage.js';
import { PitchRecord } from '../types/index.js';

describe('Frontend Component & Screen Tests', () => {
  // 1. Navbar Navigation
  it('renders navbar brand and navigation buttons', () => {
    const handleSelectTab = vi.fn();
    const handleSeedDemo = vi.fn();

    render(
      <Navbar
        currentTab="dashboard"
        onSelectTab={handleSelectTab}
        onSeedDemo={handleSeedDemo}
      />
    );

    expect(screen.getByText('ScreenAI')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('New Pitch')).toBeInTheDocument();
    expect(screen.getByText('Demo Pitch')).toBeInTheDocument();

    fireEvent.click(screen.getByText('New Pitch'));
    expect(handleSelectTab).toHaveBeenCalledWith('new');

    fireEvent.click(screen.getByText('Demo Pitch'));
    expect(handleSeedDemo).toHaveBeenCalled();
  });

  // 2. Status Badge Variants
  it('renders status badges with appropriate labels', () => {
    const { rerender } = render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText('Analysis Complete')).toBeInTheDocument();

    rerender(<StatusBadge status="PROCESSING" />);
    expect(screen.getByText('Extracting Media')).toBeInTheDocument();

    rerender(<StatusBadge status="TRANSCRIPTION_READY" />);
    expect(screen.getByText('Transcript Ready')).toBeInTheDocument();

    rerender(<StatusBadge status="FAILED" />);
    expect(screen.getByText('Action Required')).toBeInTheDocument();
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
    expect(screen.getByText('Strong Viability Signal')).toBeInTheDocument();
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
        updated_at: new Date().toISOString()
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

    expect(screen.getByText('AI Idea Screening Dashboard')).toBeInTheDocument();
    expect(screen.getByText('AgriScan AI')).toBeInTheDocument();
    expect(screen.getByText('View Report')).toBeInTheDocument();

    fireEvent.click(screen.getByText('View Report'));
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

    expect(screen.getByText('No Pitches Screened Yet')).toBeInTheDocument();
  });

  // 5. History Screen
  it('renders history table and delete confirmation state', () => {
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
});
