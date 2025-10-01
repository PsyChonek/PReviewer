import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { AIProviderConfig, ProgressData, GitOperationResult } from './types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
	selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('select-directory'),

	getGitBranches: (repoPath: string): Promise<string[]> => ipcRenderer.invoke('get-git-branches', repoPath),

	gitFetch: (repoPath: string): Promise<GitOperationResult> => ipcRenderer.invoke('git-fetch', repoPath),

	gitPull: (repoPath: string): Promise<GitOperationResult> => ipcRenderer.invoke('git-pull', repoPath),

	getGitDiff: (repoPath: string, baseBranch: string, targetBranch: string): Promise<string> =>
		ipcRenderer.invoke('get-git-diff', repoPath, baseBranch, targetBranch),

	callOllamaAPI: (config: { url: string; model: string; prompt: string }): Promise<string> => ipcRenderer.invoke('call-ollama-api', config),

	testOllamaConnection: (config: {
		url: string;
		model: string;
	}): Promise<{
		success: boolean;
		error?: string;
		version?: string;
		modelResponse?: string;
	}> => ipcRenderer.invoke('test-ollama-connection', config),

	// Azure AI APIs
	callAzureAI: (config: { endpoint: string; apiKey: string; deploymentName: string; prompt: string }): Promise<string> =>
		ipcRenderer.invoke('call-azure-ai-api', config),

	testAzureAIConnection: (config: {
		endpoint: string;
		apiKey: string;
		deploymentName: string;
	}): Promise<{
		success: boolean;
		error?: string;
		deploymentName?: string;
		modelResponse?: string;
	}> => ipcRenderer.invoke('test-azure-ai-connection', config),

	// Config management
	loadConfig: (): Promise<AIProviderConfig> => ipcRenderer.invoke('load-config'),

	saveConfig: (config: Partial<AIProviderConfig>): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('save-config', config),

	// Progress listeners
	onOllamaProgress: (callback: (event: IpcRendererEvent, data: ProgressData) => void): (() => void) => {
		ipcRenderer.on('ollama-progress', callback);
		return () => ipcRenderer.removeListener('ollama-progress', callback);
	},

	onAzureAIProgress: (callback: (event: IpcRendererEvent, data: ProgressData) => void): (() => void) => {
		ipcRenderer.on('azure-ai-progress', callback);
		return () => ipcRenderer.removeListener('azure-ai-progress', callback);
	},
});
