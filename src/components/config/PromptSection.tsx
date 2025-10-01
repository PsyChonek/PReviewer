import React from 'react';
import { useConfigStore } from '../../store/configStore';

const PromptSection: React.FC = () => {
	const { basePrompt, setBasePrompt, userPrompt, setUserPrompt, resetPrompts } =
		useConfigStore();
	return (
		<div>
			<h3 className="text-md font-semibold mb-3">Prompt Configuration</h3>
			<div className="space-y-4">
				<div className="form-control">
					<div className="flex justify-between items-center mb-3">
						<label className="label">
							<span className="label-text font-medium">Base System Prompt</span>
						</label>
						<button
							type="button"
							className="btn btn-ghost btn-xs hover:btn-warning"
							onClick={() => resetPrompts()}
							title="Reset to default prompt"
						>
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
						<span className="label-text-alt">
							This prompt sets the context and style for AI code reviews
						</span>
					</div>
				</div>

				<div className="form-control">
					<div className="flex justify-between items-center mb-3">
						<label className="label">
							<span className="label-text font-medium">
								Additional User Prompt
							</span>
						</label>
						<button
							type="button"
							className="btn btn-ghost btn-xs hover:btn-error"
							onClick={() => setUserPrompt('')}
							title="Clear user prompt"
						>
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
						<span className="label-text-alt">
							Optional extra instructions added to each review
						</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PromptSection;
