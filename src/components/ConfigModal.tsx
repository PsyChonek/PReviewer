import React from 'react';
import { AIProviderConfig } from '../types';
import PromptSection from './PromptSection';
import DebugSection from './DebugSection';
import { useConfigStore } from '../store/configStore';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestConnection: (aiConfig: AIProviderConfig) => void;
  testingConnection: boolean;
  connectionTestResult: { success: boolean; message: string; provider?: string } | null;
}

const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  onTestConnection,
  testingConnection,
  connectionTestResult
}) => {
  const {
    aiConfig,
    setAiConfig,
    basePrompt,
    setBasePrompt,
    userPrompt,
    setUserPrompt,
    debugMode,
    setDebugMode
  } = useConfigStore();

  const handleSave = () => {
    // Configuration is automatically saved via Zustand persistence
    onClose();
  };

  const handleTestConnection = () => {
    onTestConnection(aiConfig);
  };
  if (!isOpen) return null;

  return (
    <dialog open className="modal">
      <div className="modal-box w-4/5 max-w-none">
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
            <h4 className="text-md font-semibold mb-3">AI Provider Selection</h4>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-medium">AI Provider</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={aiConfig.provider}
                onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value as 'ollama' | 'azure' })}
              >
                <option value="ollama">Ollama (Local)</option>
                <option value="azure">Azure AI (Cloud)</option>
              </select>
            </div>
          </div>

          {aiConfig.provider === 'ollama' && (
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
                    onChange={(e) => setAiConfig({
                      ...aiConfig,
                      ollama: { ...aiConfig.ollama, url: e.target.value }
                    })}
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
                    onChange={(e) => setAiConfig({
                      ...aiConfig,
                      ollama: { ...aiConfig.ollama, model: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>
          )}

          {aiConfig.provider === 'azure' && (
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
                    onChange={(e) => setAiConfig({
                      ...aiConfig,
                      azure: { ...aiConfig.azure, endpoint: e.target.value }
                    })}
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
                    onChange={(e) => setAiConfig({
                      ...aiConfig,
                      azure: { ...aiConfig.azure, apiKey: e.target.value }
                    })}
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
                    onChange={(e) => setAiConfig({
                      ...aiConfig,
                      azure: { ...aiConfig.azure, deployment: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="form-control mt-4">
                <button
                  type="button"
                  className={`btn ${testingConnection ? 'btn-disabled' : 'btn-outline btn-primary'} w-full`}
                  onClick={handleTestConnection}
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
          )}

          {aiConfig.provider === 'ollama' && (
            <div className="form-control mt-4">
              <button
                type="button"
                className={`btn ${testingConnection ? 'btn-disabled' : 'btn-outline btn-primary'} w-full`}
                onClick={handleTestConnection}
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
          )}

          {connectionTestResult && (
            <div className={`alert ${connectionTestResult.success ? 'alert-success' : 'alert-error'} mt-4`}>
              <div>
                <i className={`fas ${connectionTestResult.success ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                <span className="font-medium">{connectionTestResult.success ? 'Success' : 'Error'}</span>
              </div>
              <div className="text-sm">{connectionTestResult.message}</div>
            </div>
          )}

          <PromptSection />

          <DebugSection />
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-primary" onClick={handleSave}>
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