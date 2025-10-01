import React from 'react';
import { AIProviderConfig } from '../../types';

interface AzureSettingsProps {
	aiConfig: AIProviderConfig;
	setAiConfig: (config: AIProviderConfig) => void;
	onTestConnection: () => void;
	testingConnection: boolean;
}

const AzureSettings: React.FC<AzureSettingsProps> = ({ aiConfig, setAiConfig, onTestConnection, testingConnection }) => {
	return (
		<div>
			<h4 className="text-md font-semibold mb-3">Azure AI Settings</h4>
			<div className="grid grid-cols-1 gap-4">
				<div className="form-control">
					<label className="label">
						<span className="label-text font-medium">Azure AI Endpoint</span>
					</label>
					<input
						type="text"
						className="input input-bordered w-full"
						value={aiConfig.azure.endpoint}
						onChange={(e) =>
							setAiConfig({
								...aiConfig,
								azure: {
									...aiConfig.azure,
									endpoint: e.target.value,
								},
							})
						}
					/>
				</div>
				<div className="form-control">
					<label className="label">
						<span className="label-text font-medium">API Key</span>
					</label>
					<input
						type="password"
						className="input input-bordered w-full"
						value={aiConfig.azure.apiKey}
						onChange={(e) =>
							setAiConfig({
								...aiConfig,
								azure: {
									...aiConfig.azure,
									apiKey: e.target.value,
								},
							})
						}
					/>
				</div>
				<div className="form-control">
					<label className="label">
						<span className="label-text font-medium">Deployment Name</span>
					</label>
					<input
						type="text"
						className="input input-bordered w-full"
						value={aiConfig.azure.deployment}
						onChange={(e) =>
							setAiConfig({
								...aiConfig,
								azure: {
									...aiConfig.azure,
									deployment: e.target.value,
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
							Test Azure AI Connection
						</>
					)}
				</button>
			</div>
		</div>
	);
};

export default AzureSettings;
