import React, { useState, useEffect, useRef } from 'react';

interface ProgressTrackerProps {
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
	reviewInProgress: boolean;
	chunkingInfo?: {
		willChunk: boolean;
		chunkCount: number;
		currentChunk: number;
	};
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ reviewStats, reviewInProgress, chunkingInfo }) => {
	const [smoothTime, setSmoothTime] = useState(0);
	const [smoothSpeed, setSmoothSpeed] = useState(0);
	const startTimeRef = useRef<number | null>(null);

	// Start timer when review begins
	useEffect(() => {
		if (reviewInProgress && !startTimeRef.current) {
			startTimeRef.current = Date.now();
		} else if (!reviewInProgress) {
			startTimeRef.current = null;
		}
	}, [reviewInProgress]);

	// Smooth update loop for time and speed
	useEffect(() => {
		if (!reviewInProgress) {
			return;
		}

		const interval = setInterval(() => {
			if (startTimeRef.current) {
				const elapsed = (Date.now() - startTimeRef.current) / 1000;
				setSmoothTime(elapsed);

				// Calculate smooth speed based on current tokens
				const currentTokens = reviewStats?.outputTokens || 0;
				if (elapsed > 0) {
					const instantSpeed = currentTokens / elapsed;
					setSmoothSpeed(instantSpeed);
				}
			}
		}, 100); // Update every 100ms for smooth animation

		return () => clearInterval(interval);
	}, [reviewInProgress, reviewStats?.outputTokens]);

	// Calculate average speed when completed
	const avgSpeed = reviewStats && !reviewInProgress ? reviewStats.outputTokens / (reviewStats.responseTime / 1000) : smoothSpeed;

	if (!reviewInProgress && !reviewStats) {
		return null;
	}

	return (
		<div className="card bg-base-200 shadow-sm mb-4">
			<div className="card-body p-4">
				<h3 className="card-title text-sm flex items-center gap-2">
					<i className="fas fa-chart-line text-primary"></i>
					Review Progress
				</h3>

				{reviewInProgress && (
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<span className="loading loading-spinner loading-sm text-primary"></span>
							<span className="text-sm">{reviewStats?.stage || 'Processing...'}</span>
						</div>

						{reviewStats?.progress !== undefined && (
							<div className="w-full">
								<div className="flex justify-between text-xs mb-1">
									<span>Progress</span>
									<span>{Math.round(reviewStats.progress)}%</span>
								</div>
								<progress className="progress progress-primary w-full" value={reviewStats.progress} max="100"></progress>
							</div>
						)}

						{chunkingInfo?.willChunk && (
							<div className="alert alert-info py-2 text-xs">
								<i className="fas fa-layer-group"></i>
								<span>{`Processing chunk ${chunkingInfo.currentChunk} of ${chunkingInfo.chunkCount}`}</span>
							</div>
						)}

						<div className="grid grid-cols-2 gap-4 text-xs">
							<div>
								<span className="text-base-content/70">Tokens Sent:</span>
								<div className="font-mono">{(reviewStats?.inputTokens || 0).toLocaleString()}</div>
							</div>
							<div>
								<span className="text-base-content/70">Output Tokens:</span>
								<div className="font-mono">{(reviewStats?.outputTokens || 0).toLocaleString()}</div>
							</div>
							<div>
								<span className="text-base-content/70">Speed:</span>
								<div className="font-mono">{smoothSpeed.toFixed(1)} tok/s</div>
							</div>
							<div>
								<span className="text-base-content/70">Processing:</span>
								<div className="font-mono">{smoothTime.toFixed(1)}s</div>
							</div>
						</div>
					</div>
				)}

				{!reviewInProgress && reviewStats && (
					<div className="space-y-3">
						<div className="flex items-center gap-2 text-success">
							<i className="fas fa-check-circle"></i>
							<span className="text-sm font-medium">Review Completed</span>
						</div>

						<div className="grid grid-cols-2 gap-4 text-xs">
							<div>
								<span className="text-base-content/70">Input Tokens:</span>
								<div className="font-mono">{reviewStats.inputTokens}</div>
							</div>
							<div>
								<span className="text-base-content/70">Output Tokens:</span>
								<div className="font-mono">{reviewStats.outputTokens}</div>
							</div>
							<div>
								<span className="text-base-content/70">Avg Speed:</span>
								<div className="font-mono">{avgSpeed.toFixed(1)} tok/s</div>
							</div>
							<div>
								<span className="text-base-content/70">Total Time:</span>
								<div className="font-mono">{(reviewStats.responseTime / 1000).toFixed(1)}s</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default ProgressTracker;
