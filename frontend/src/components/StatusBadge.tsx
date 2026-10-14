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
        return <RefreshCw size={12} className="icon-spin" />;
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
        return 'Processing Media';
      case 'TRANSCRIPTION_READY':
        return 'Transcript Ready';
      case 'ANALYZING':
        return 'Evaluating Viability';
      case 'COMPLETED':
        return 'Completed';
      case 'FAILED':
        return 'Failed';
      default:
        return status;
    }
  };

  const getCssClass = () => {
    switch (status) {
      case 'COMPLETED':
        return 'badge-completed';
      case 'PROCESSING':
      case 'ANALYZING':
      case 'TRANSCRIPTION_READY':
        return 'badge-processing';
      case 'FAILED':
        return 'badge-failed';
      default:
        return 'badge-queued';
    }
  };

  return (
    <span className={`badge ${getCssClass()}`}>
      {getIcon()}
      <span>{getLabel()}</span>
    </span>
  );
};
