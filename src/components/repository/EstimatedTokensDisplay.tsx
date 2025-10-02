import React from 'react';

interface EstimatedTokensDisplayProps {
	estimatedInputTokens: number;
	canStartReview: string | boolean | null;
	formatTokenCount: (count: number) => string;
	willChunk?: boolean;
	chunkCount?: number;
	rateLimitPerMinute?: number;
}

const EstimatedTokensDisplay: React.FC<EstimatedTokensDisplayProps> = ({
	estimatedInputTokens,
	canStartReview,
	formatTokenCount,
	willChunk = false,
	chunkCount = 0,
	rateLimitPerMinute,
}) => {
	if (estimatedInputTokens <= 0 || !canStartReview) {
		return null;
	}

	return (
		<div className={`alert ${willChunk ? 'alert-warning' : 'alert-success'} mt-4`}>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
				{willChunk ? (
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				) : (
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				)}
			</svg>
			<div className="flex-1">
				<h3 className={`font-bold text-lg ${willChunk ? 'text-warning-content' : 'text-success-content'}`}>
					{willChunk ? 'Large Diff - Will Use Chunking' : 'Ready for Review'}
				</h3>
				<div className={`text-sm ${willChunk ? 'text-warning-content' : 'text-success-content'}`}>
					<div>
						Estimated input tokens: <span className="font-semibold">{formatTokenCount(estimatedInputTokens)}</span>
						{rateLimitPerMinute && estimatedInputTokens / rateLimitPerMinute > 1 && (
							<span className="ml-1 opacity-80">/ Rate limit: {formatTokenCount(rateLimitPerMinute)}/min</span>
						)}
					</div>
					{willChunk && chunkCount > 0 && (
						<div className="mt-1 space-y-0.5">
							<div>
								<i className="fas fa-layer-group mr-1"></i>
								Will be split into <span className="font-semibold">{chunkCount}</span> chunk{chunkCount > 1 ? 's' : ''}
							</div>
							{rateLimitPerMinute && (
								<div className="opacity-80">
									<i className="fas fa-clock mr-1"></i>Estimated time: ~{chunkCount} minutes ({(chunkCount / 60).toFixed(1)} hours)
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default EstimatedTokensDisplay;
