import React from 'react';
import { AIProviderConfig } from '../../types';

interface OllamaSettingsProps {
	aiConfig: AIProviderConfig;
	setAiConfig: (config: AIProviderConfig) => void;
	onTestConnection: () => void;
	testingConnection: boolean;
}

const OllamaSettings: React.FC<OllamaSettingsProps> = ({ aiConfig, setAiConfig, onTestConnection, testingConnection }) => {
	return (
		<div>
			<h4 className="text-md font-semibold mb-3">Ollama Settings</h4>
			<div className="grid grid-cols-1 gap-4">
				<div className="form-control">
					<label className="label">
						<span className="label-text font-medium">Ollama URL</span>
					</label>
					<input
						type="text"
						className="input input-bordered w-full"
						value={aiConfig.ollama.url}
						onChange={(e) =>
							setAiConfig({
								...aiConfig,
								ollama: {
									...aiConfig.ollama,
									url: e.target.value,
								},
							})
						}
					/>
				</div>
				<div className="form-control">
					<label className="label">
						<span className="label-text font-medium">Ollama Model</span>
					</label>
					<input
						type="text"
						className="input input-bordered w-full"
						value={aiConfig.ollama.model}
						onChange={(e) =>
							setAiConfig({
								...aiConfig,
								ollama: {
									...aiConfig.ollama,
									model: e.target.value,
								},
							})
						}
					/>
				</div>
			</div>

			<div className="form-control mt-4">
				<button
					type="button"
					className={`btn ${testingConnection ? 'btn-disabled' : 'btn-outline btn-primary'} w-full`}
					onClick={onTestConnection}
					disabled={testingConnection}
				>
					{testingConnection ? (
						<>
							<span className="loading loading-spinner loading-sm"></span>
							Testing Connection...
						</>
					) : (
						<>
							<i className="fas fa-plug"></i>
							Test Ollama Connection
						</>
					)}
				</button>
			</div>
		</div>
	);
};

export default OllamaSettings;
