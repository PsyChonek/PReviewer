import React from 'react';
import { formatTokenCount } from '../utils/tokenEstimation';

interface StatsDisplayProps {
	reviewStats: {
		tokens: number;
		inputTokens: number;
		outputTokens: number;
		tokensPerSecond: number;
		processingTime: number;
		responseTime: number;
		stage: string;
		progress: number;
	} | null;
	estimatedInputTokens?: number;
	reviewInProgress: boolean;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({
	reviewStats,
	estimatedInputTokens = 0,
	reviewInProgress,
}) => {
	if (!reviewInProgress && !reviewStats && estimatedInputTokens <= 0) {
		return null;
	}

	return null;
};

export default StatsDisplay;
