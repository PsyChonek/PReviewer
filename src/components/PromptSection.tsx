import React from 'react';
import { useConfigStore } from '../store/configStore';

const PromptSection: React.FC = () => {
	const { basePrompt, setBasePrompt, userPrompt, setUserPrompt, resetPrompts } =
		useConfigStore();
	return (
		<div>
			<h4 className="text-md font-semibold mb-3">Prompt Configuration</h4>
			<div className="space-y-4">
				<div className="form-control">
					<label className="label">
						<span className="label-text font-medium">Base System Prompt</span>
						<button
							type="button"
							className="btn btn-ghost btn-xs hover:btn-warning"
							onClick={() => resetPrompts()}
							title="Reset to default prompt"
						>
							<i className="fas fa-undo"></i>
							Reset
						</button>
					</label>
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
					<label className="label">
						<span className="label-text font-medium">
							Additional User Prompt
						</span>
						<button
							type="button"
							className="btn btn-ghost btn-xs hover:btn-error"
							onClick={() => setUserPrompt('')}
							title="Clear user prompt"
						>
							<i className="fas fa-times"></i>
							Clear
						</button>
					</label>
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

				<div className="flex justify-end mt-4">
					<button
						type="button"
						className="btn btn-outline btn-secondary btn-sm hover:btn-warning"
						onClick={() => {
							if (
								confirm(
									'Are you sure you want to reset both prompts to their default values? This action cannot be undone.'
								)
							) {
								resetPrompts();
							}
						}}
						title="Reset both prompts to defaults"
					>
						<i className="fas fa-refresh"></i>
						Reset All Prompts
					</button>
				</div>
			</div>
		</div>
	);
};

export default PromptSection;
