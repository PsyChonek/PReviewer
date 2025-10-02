import React from 'react';
import { AIProviderConfig } from '../../types';

interface AzureSettingsProps {
	aiConfig: AIProviderConfig;
	setAiConfig: (config: AIProviderConfig) => void;
	onTestConnection: () => void;
	testingConnection: boolean;
	azureRateLimitTokensPerMinute: number;
	setAzureRateLimitTokensPerMinute: (tokens: number) => void;
	enableAutoChunking: boolean;
	setEnableAutoChunking: (enabled: boolean) => void;
}

const AzureSettings: React.FC<AzureSettingsProps> = ({
	aiConfig,
	setAiConfig,
	onTestConnection,
	testingConnection,
	azureRateLimitTokensPerMinute,
	setAzureRateLimitTokensPerMinute,
	enableAutoChunking,
	setEnableAutoChunking,
}) => {
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

			<div className="divider mt-6 mb-4">Rate Limit & Chunking</div>

			<div className="grid grid-cols-1 gap-4">
				<div className="form-control">
					<label className="label cursor-pointer justify-start gap-3">
						<input type="checkbox" className="toggle toggle-primary" checked={enableAutoChunking} onChange={(e) => setEnableAutoChunking(e.target.checked)} />
						<div>
							<span className="label-text font-medium">Enable Auto-Chunking</span>
							<p className="text-xs text-base-content/70 mt-1">Automatically split large diffs into chunks to avoid Azure rate limits (100k tokens/min)</p>
						</div>
					</label>
				</div>

				<div className="form-control">
					<label className="label">
						<span className="label-text font-medium">Rate Limit (Tokens/Minute)</span>
					</label>
					<input
						type="number"
						className="input input-bordered w-full"
						value={azureRateLimitTokensPerMinute}
						onChange={(e) => setAzureRateLimitTokensPerMinute(Number(e.target.value))}
						min={10000}
						max={100000}
						step={5000}
					/>
					<label className="label">
						<span className="label-text-alt text-base-content/70">
							Recommended: 95,000 tokens/min (leaves 5k margin from Azure's 100k limit). Lower if you have a restricted tier.
						</span>
					</label>
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
