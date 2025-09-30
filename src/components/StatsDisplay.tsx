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

	return (
		<div className="mb-4">
			{reviewInProgress && reviewStats && (
				<div className="mb-3">
					<div className="flex justify-between items-center mb-2">
						<span className="text-sm font-medium">{reviewStats.stage}</span>
						<span className="text-sm">{Math.round(reviewStats.progress)}%</span>
					</div>
					<progress
						className="progress progress-primary w-full"
						value={reviewStats.progress}
						max="100"
					></progress>
				</div>
			)}

		</div>
	);
};

export default StatsDisplay;
