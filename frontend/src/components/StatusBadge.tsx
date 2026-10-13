import React from 'react';
import { PitchStatus } from '../types/index.js';
import { Clock, RefreshCw, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

interface StatusBadgeProps {
  status: PitchStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getIcon = () => {
    switch (status) {
      case 'QUEUED':
        return <Clock size={12} />;
      case 'PROCESSING':
      case 'ANALYZING':
        return <RefreshCw size={12} style={{ animation: 'spin 1.5s linear infinite' }} />;
      case 'TRANSCRIPTION_READY':
        return <FileText size={12} />;
      case 'COMPLETED':
        return <CheckCircle2 size={12} />;
      case 'FAILED':
        return <AlertCircle size={12} />;
      default:
        return null;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'QUEUED':
        return 'Queued';
      case 'PROCESSING':
        return 'Extracting Media';
      case 'TRANSCRIPTION_READY':
        return 'Transcript Ready';
      case 'ANALYZING':
        return 'Analyzing Viability';
      case 'COMPLETED':
        return 'Analysis Complete';
      case 'FAILED':
        return 'Action Required';
      default:
        return status;
    }
  };

  return (
    <span className={`badge badge-${status}`}>
      {getIcon()}
      <span>{getLabel()}</span>
    </span>
  );
};
