import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import RepositorySection from './components/RepositorySection';
import OutputSection from './components/OutputSection';
import { AppState, AIProviderConfig } from './types';
import { buildPrompt, DEFAULT_BASE_PROMPT } from './utils/prompts';
import { estimateTokens } from './utils/tokenEstimation';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    currentRepoPath: null,
    reviewInProgress: false,
    reviewStartTime: null,
    currentOutputMarkdown: '',
    debugMode: false
  });

  const [fromBranch, setFromBranch] = useState<string>('');
  const [toBranch, setToBranch] = useState<string>('');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({
    provider: 'ollama',
    ollama: {
      url: 'http://localhost:11434/api/generate',
      model: 'codellama'
    },
    azure: {
      endpoint: '',
      apiKey: '',
      deployment: ''
    }
  });

  const [basePrompt, setBasePrompt] = useState<string>(DEFAULT_BASE_PROMPT);
  const [userPrompt, setUserPrompt] = useState<string>('');

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = () => {
    const savedConfig = localStorage.getItem('aiConfig');
    if (savedConfig) {
      try {
        setAiConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error('Failed to load configuration:', error);
      }
    }

    const savedBasePrompt = localStorage.getItem('basePrompt');
    if (savedBasePrompt) {
      setBasePrompt(savedBasePrompt);
    }

    const savedUserPrompt = localStorage.getItem('userPrompt');
    if (savedUserPrompt) {
      setUserPrompt(savedUserPrompt);
    }

    const savedDebugMode = localStorage.getItem('debugMode') === 'true';
    setAppState(prev => ({ ...prev, debugMode: savedDebugMode }));
  };

  const saveConfiguration = () => {
    localStorage.setItem('aiConfig', JSON.stringify(aiConfig));
    localStorage.setItem('basePrompt', basePrompt);
    localStorage.setItem('userPrompt', userPrompt);
    localStorage.setItem('debugMode', appState.debugMode.toString());
  };

  const handleStartReview = async () => {
    if (!appState.currentRepoPath || !fromBranch || !toBranch) {
      alert('Please select a repository and both branches before starting the review.');
      return;
    }

    setAppState(prev => ({
      ...prev,
      reviewInProgress: true,
      reviewStartTime: Date.now(),
      currentOutputMarkdown: ''
    }));

    try {
      // Get the diff
      const diff = await window.electronAPI.getDiff(appState.currentRepoPath, fromBranch, toBranch);

      if (!diff || diff.trim() === '') {
        setAppState(prev => ({
          ...prev,
          currentOutputMarkdown: '## No Changes Found\n\nNo differences were found between the selected branches.',
          reviewInProgress: false
        }));
        return;
      }

      // Build the prompt
      const fullPrompt = buildPrompt(diff, basePrompt, userPrompt);

      if (appState.debugMode) {
        console.log('Estimated tokens:', estimateTokens(fullPrompt));
        console.log('Full prompt:', fullPrompt);
      }

      // Call the appropriate AI service
      let result;
      if (aiConfig.provider === 'ollama') {
        result = await window.electronAPI.reviewWithOllama(
          aiConfig.ollama.url,
          aiConfig.ollama.model,
          fullPrompt
        );
      } else {
        result = await window.electronAPI.reviewWithAzure(
          aiConfig.azure.endpoint,
          aiConfig.azure.apiKey,
          aiConfig.azure.deployment,
          fullPrompt
        );
      }

      if (result.success && result.content) {
        setAppState(prev => ({
          ...prev,
          currentOutputMarkdown: result.content || '',
          reviewInProgress: false
        }));
      } else {
        setAppState(prev => ({
          ...prev,
          currentOutputMarkdown: `## Error\n\n${result.error || 'An unknown error occurred during the review.'}`,
          reviewInProgress: false
        }));
      }

    } catch (error) {
      console.error('Review failed:', error);
      setAppState(prev => ({
        ...prev,
        currentOutputMarkdown: `## Error\n\nFailed to complete the review: ${error}`,
        reviewInProgress: false
      }));
    }
  };

  const handleStopReview = () => {
    setAppState(prev => ({
      ...prev,
      reviewInProgress: false
    }));
  };

  const handleClearOutput = () => {
    setAppState(prev => ({
      ...prev,
      currentOutputMarkdown: ''
    }));
  };

  const handleCopyOutput = async () => {
    try {
      await navigator.clipboard.writeText(appState.currentOutputMarkdown);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleExportOutput = () => {
    const blob = new Blob([appState.currentOutputMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pr-review-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenConfig = () => {
    setShowConfigModal(true);
  };

  const handleSaveConfig = () => {
    saveConfiguration();
    setShowConfigModal(false);
  };

  return (
    <div className="bg-base-100">
      <Navbar onOpenConfig={handleOpenConfig} />

      <main className="container mx-auto px-4 py-6 max-w-7xl" role="main">
        <RepositorySection
          repoPath={appState.currentRepoPath}
          fromBranch={fromBranch}
          toBranch={toBranch}
          onRepoPathChange={(path) => setAppState(prev => ({ ...prev, currentRepoPath: path }))}
          onFromBranchChange={setFromBranch}
          onToBranchChange={setToBranch}
          onStartReview={handleStartReview}
          onStopReview={handleStopReview}
          reviewInProgress={appState.reviewInProgress}
          onOpenConfig={handleOpenConfig}
        />

        <OutputSection
          outputContent={appState.currentOutputMarkdown}
          onClearOutput={handleClearOutput}
          onCopyOutput={handleCopyOutput}
          onExportOutput={handleExportOutput}
        />
      </main>

      {/* Configuration Modal - Simplified for now */}
      {showConfigModal && (
        <dialog open className="modal">
          <div className="modal-box w-4/5 max-w-none">
            <form method="dialog">
              <button
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={() => setShowConfigModal(false)}
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
                    onChange={(e) => setAiConfig(prev => ({ ...prev, provider: e.target.value as 'ollama' | 'azure' }))}
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
                        onChange={(e) => setAiConfig(prev => ({
                          ...prev,
                          ollama: { ...prev.ollama, url: e.target.value }
                        }))}
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
                        onChange={(e) => setAiConfig(prev => ({
                          ...prev,
                          ollama: { ...prev.ollama, model: e.target.value }
                        }))}
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
                        onChange={(e) => setAiConfig(prev => ({
                          ...prev,
                          azure: { ...prev.azure, endpoint: e.target.value }
                        }))}
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
                        onChange={(e) => setAiConfig(prev => ({
                          ...prev,
                          azure: { ...prev.azure, apiKey: e.target.value }
                        }))}
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
                        onChange={(e) => setAiConfig(prev => ({
                          ...prev,
                          azure: { ...prev.azure, deployment: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-md font-semibold mb-3">Debug Options</h4>
                <div className="form-control">
                  <label className="cursor-pointer label justify-between items-center">
                    <span className="label-text font-medium">Enable Debug Logging</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={appState.debugMode}
                      onChange={(e) => setAppState(prev => ({ ...prev, debugMode: e.target.checked }))}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-primary" onClick={handleSaveConfig}>
                Save Settings
              </button>
              <button className="btn" onClick={() => setShowConfigModal(false)}>
                Close
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};

export default App;