import React from 'react';
import { formatTokenCount } from '../utils/tokenEstimation';

interface TokenUsageDisplayProps {
  inputTokens: number;
  outputTokens: number;
}

export const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({
  inputTokens,
  outputTokens,
}) => {
  return (
    <div className="flex gap-3 text-sm">
      <div className="flex items-center gap-1">
        <i className="fas fa-arrow-down text-xs"></i>
        <span className="font-medium">{formatTokenCount(inputTokens)}</span>
        <span className="opacity-75">in</span>
      </div>
      <div className="flex items-center gap-1">
        <i className="fas fa-arrow-up text-xs"></i>
        <span className="font-medium">{formatTokenCount(outputTokens)}</span>
        <span className="opacity-75">out</span>
      </div>
    </div>
  );
};
