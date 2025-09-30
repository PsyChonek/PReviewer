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

			{reviewStats && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
					<div className="stat bg-base-200 rounded-lg p-3">
						<div className="stat-title text-xs">Input Tokens</div>
						<div className="stat-value text-lg">
							{formatTokenCount(
								reviewStats?.inputTokens || estimatedInputTokens || 0
							)}
						</div>
						{!reviewStats && estimatedInputTokens > 0 && (
							<div className="stat-desc text-xs">estimated</div>
						)}
					</div>
					<div className="stat bg-base-200 rounded-lg p-3">
						<div className="stat-title text-xs">Output Tokens</div>
						<div className="stat-value text-lg">
							{formatTokenCount(reviewStats.outputTokens || reviewStats.tokens)}
						</div>
					</div>
					<div className="stat bg-base-200 rounded-lg p-3">
						<div className="stat-title text-xs">Speed</div>
						<div className="stat-value text-lg">
							{reviewStats.processingTime > 0
								? (
										(reviewStats.outputTokens || reviewStats.tokens) /
										reviewStats.processingTime
									).toFixed(1)
								: reviewStats.tokensPerSecond.toFixed(1)}
						</div>
						<div className="stat-desc text-xs">t/s</div>
					</div>
					<div className="stat bg-base-200 rounded-lg p-3">
						<div className="stat-title text-xs">Total Time</div>
						<div className="stat-value text-lg">
							{reviewStats.responseTime
								? (reviewStats.responseTime / 1000).toFixed(1)
								: reviewStats.processingTime.toFixed(1)}
						</div>
						<div className="stat-desc text-xs">seconds</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default StatsDisplay;
