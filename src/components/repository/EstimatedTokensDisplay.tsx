import React from 'react';

interface EstimatedTokensDisplayProps {
	estimatedInputTokens: number;
	canStartReview: string | boolean | null;
	formatTokenCount: (count: number) => string;
}

const EstimatedTokensDisplay: React.FC<EstimatedTokensDisplayProps> = ({
	estimatedInputTokens,
	canStartReview,
	formatTokenCount,
}) => {
	if (estimatedInputTokens <= 0 || !canStartReview) {
		return null;
	}

	return (
		<div className="alert alert-success mt-4">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				className="stroke-current shrink-0 w-6 h-6"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="2"
					d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<div>
				<h3 className="font-bold text-lg text-success-content">
					Ready for Review
				</h3>
				<div className="text-sm text-success-content">
					Estimated input tokens:{' '}
					<span className="font-semibold">
						{formatTokenCount(estimatedInputTokens)}
					</span>
				</div>
			</div>
		</div>
	);
};

export default EstimatedTokensDisplay;
