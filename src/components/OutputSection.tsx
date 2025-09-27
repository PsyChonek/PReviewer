import React from "react";
import { formatTokenCount } from "../utils/tokenEstimation";
import WelcomeMessage from "./WelcomeMessage";
import ActionButtons from "./ActionButtons";
import StatsDisplay from "./StatsDisplay";

interface OutputSectionProps {
	outputContent: string;
	onClearOutput: () => void;
	onCopyOutput: () => void;
	onExportOutput: () => void;
	reviewInProgress: boolean;
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
}

const OutputSection: React.FC<OutputSectionProps> = ({ outputContent, onClearOutput, onCopyOutput, onExportOutput, reviewInProgress, reviewStats, estimatedInputTokens = 0 }) => {
	const renderMarkdown = (markdown: string) => {
		if (!markdown.trim()) {
			return <WelcomeMessage />;
		}

		// Use marked library if available, otherwise just display as text
		if (typeof window !== "undefined" && (window as any).marked) {
			return <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: (window as any).marked.parse(markdown) }} />;
		}

		// Fallback: basic markdown-like formatting
		return (
			<div className="prose prose-sm max-w-none dark:prose-invert">
				<pre className="whitespace-pre-wrap font-sans">{markdown}</pre>
			</div>
		);
	};

	return (
		<section className="card bg-base-100 shadow-xl" aria-label="Output" role="region">
			<div className="card-body">
				<div className="flex justify-between items-center mb-4">
					<h2 className="card-title text-2xl">
						<i className="fas fa-bullseye"></i> Output
					</h2>
					<ActionButtons
						onClearOutput={onClearOutput}
						onCopyOutput={onCopyOutput}
						onExportOutput={onExportOutput}
					/>
				</div>

				<StatsDisplay
					reviewStats={reviewStats}
					estimatedInputTokens={estimatedInputTokens}
					reviewInProgress={reviewInProgress}
				/>

				<div className="bg-base-200 border border-base-300 rounded-lg output-text overflow-auto" role="log" aria-live="polite" aria-label="Review output display">
					<div className="px-6 py-4">{renderMarkdown(outputContent)}</div>
				</div>
			</div>
		</section>
	);
};

export default OutputSection;
