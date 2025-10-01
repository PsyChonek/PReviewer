import React, { useRef, useEffect } from 'react';
import { AIProviderConfig } from '../../types';
import PromptSection from './PromptSection';
import DebugSection from './DebugSection';
import OllamaSettings from './OllamaSettings';
import AzureSettings from './AzureSettings';
import { useConfigStore } from '../../store/configStore';

interface ConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	onTestConnection: (aiConfig: AIProviderConfig) => void;
	testingConnection: boolean;
	connectionTestResult: {
		success: boolean;
		message: string;
		provider?: string;
	} | null;
}

const ConfigModal: React.FC<ConfigModalProps> = ({
	isOpen,
	onClose,
	onTestConnection,
	testingConnection,
	connectionTestResult,
}) => {
	const { aiConfig, setAiConfig } = useConfigStore();
	const modalBoxRef = useRef<HTMLDivElement>(null);

	const handleSave = () => {
		// Configuration is automatically saved via Zustand persistence
		onClose();
	};

	const handleTestConnection = () => {
		onTestConnection(aiConfig);
	};

	// Close modal when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				modalBoxRef.current &&
				!modalBoxRef.current.contains(event.target as Node)
			) {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<dialog open className="modal">
			<div ref={modalBoxRef} className="modal-box w-4/5 max-w-none">
				<form method="dialog">
					<button
						className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
						onClick={onClose}
					>
						<i className="fas fa-times"></i>
					</button>
				</form>
				<h3 className="font-bold text-lg mb-4">Configuration Settings</h3>

				<div className="space-y-6">
					<div>
						<h4 className="text-md font-semibold mb-3">
							AI Provider Selection
						</h4>
						<div className="form-control mb-4">
							<label className="label">
								<span className="label-text font-medium">AI Provider</span>
							</label>
							<select
								className="select select-bordered w-full"
								value={aiConfig.provider}
								onChange={(e) =>
									setAiConfig({
										...aiConfig,
										provider: e.target.value as 'ollama' | 'azure',
									})
								}
							>
								<option value="ollama">Ollama (Local)</option>
								<option value="azure">Azure AI (Cloud)</option>
							</select>
						</div>
					</div>

					{aiConfig.provider === 'ollama' && (
						<OllamaSettings
							aiConfig={aiConfig}
							setAiConfig={setAiConfig}
							onTestConnection={handleTestConnection}
							testingConnection={testingConnection}
						/>
					)}

					{aiConfig.provider === 'azure' && (
						<AzureSettings
							aiConfig={aiConfig}
							setAiConfig={setAiConfig}
							onTestConnection={handleTestConnection}
							testingConnection={testingConnection}
						/>
					)}

					{connectionTestResult && (
						<div
							className={`alert ${connectionTestResult.success ? 'alert-success' : 'alert-error'} mt-4`}
						>
							<div>
								<i
									className={`fas ${connectionTestResult.success ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}
								></i>
								<span className="font-medium">
									{connectionTestResult.success ? 'Success' : 'Error'}
								</span>
							</div>
							<div className="text-sm">{connectionTestResult.message}</div>
						</div>
					)}

					<PromptSection />

					<DebugSection />
				</div>

				<div className="modal-action">
					<button
						type="button"
						className="btn btn-primary"
						onClick={handleSave}
					>
						Save Settings
					</button>
					<button className="btn" onClick={onClose}>
						Close
					</button>
				</div>
			</div>
		</dialog>
	);
};

export default ConfigModal;
