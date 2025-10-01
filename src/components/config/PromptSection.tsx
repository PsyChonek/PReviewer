import React from 'react';
import { getDefaultPrompts } from '../../utils/config';

interface PromptSectionProps {
	basePrompt: string;
	setBasePrompt: (prompt: string) => void;
	userPrompt: string;
	setUserPrompt: (prompt: string) => void;
}

const PromptSection: React.FC<PromptSectionProps> = ({ basePrompt, setBasePrompt, userPrompt, setUserPrompt }) => {
	const handleResetPrompts = () => {
		const defaults = getDefaultPrompts();
		setBasePrompt(defaults.basePrompt);
		setUserPrompt(defaults.userPrompt);
	};

	return (
		<div>
			<h3 className="text-md font-semibold mb-3">Prompt Configuration</h3>
			<div className="space-y-4">
				<div className="form-control">
					<div className="flex justify-between items-center mb-3">
						<label className="label">
							<span className="label-text font-medium">Base System Prompt</span>
						</label>
						<button type="button" className="btn btn-ghost btn-xs hover:btn-warning" onClick={handleResetPrompts} title="Reset to default prompt">
							<i className="fas fa-undo"></i>
							Reset
						</button>
					</div>
					<textarea
						className="textarea textarea-bordered w-full h-32 text-sm"
						value={basePrompt}
						onChange={(e) => setBasePrompt(e.target.value)}
						placeholder="Enter the base system prompt for code reviews..."
					/>
					<div className="label">
						<span className="label-text-alt">This prompt sets the context and style for AI code reviews</span>
					</div>
				</div>

				<div className="form-control">
					<div className="flex justify-between items-center mb-3">
						<label className="label">
							<span className="label-text font-medium">Additional User Prompt</span>
						</label>
						<button type="button" className="btn btn-ghost btn-xs hover:btn-error" onClick={() => setUserPrompt('')} title="Clear user prompt">
							<i className="fas fa-times"></i>
							Clear
						</button>
					</div>
					<textarea
						className="textarea textarea-bordered w-full h-24 text-sm"
						value={userPrompt}
						onChange={(e) => setUserPrompt(e.target.value)}
						placeholder="Enter additional instructions for this review session..."
					/>
					<div className="label">
						<span className="label-text-alt">Optional extra instructions added to each review</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PromptSection;
