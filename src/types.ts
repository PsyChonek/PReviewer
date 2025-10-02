export interface AppState {
	currentRepoPath: string | null;
	reviewInProgress: boolean;
	reviewStartTime: number | null;
	currentOutputMarkdown: string;
}

export interface AIProviderConfig {
	provider: 'ollama' | 'azure';
	ollama: {
		url: string;
		model: string;
	};
	azure: {
		endpoint: string;
		apiKey: string;
		deployment: string;
	};
}

export interface ProgressState {
	percentage: number;
	stage: string;
	elapsedTime: number;
	status: string;
}

export interface BranchInfo {
	name: string;
	type: 'local' | 'remote';
}

export interface ReviewStats {
	timeElapsed: string;
	speed: string;
	tokens: string;
	model: string;
	stage: string;
}

export interface PreviewData {
	diffSize: number;
	inputTokens: number;
	outputTokens: number;
	totalEstimate: number;
}

export interface ProgressData extends Record<string, unknown> {
	tokens?: number;
	actualInputTokens?: number;
	actualOutputTokens?: number;
	tokensPerSecond?: number;
	processingTime?: number;
	responseTime?: number;
	stage?: string;
	message?: string;
	progress?: number;
}

export interface GitOperationResult {
	success: boolean;
	message?: string;
	error?: string;
	summary?: unknown;
}

declare global {
	interface Window {
		electronAPI: {
			selectDirectory: () => Promise<string | null>;
			getGitBranches: (repoPath: string) => Promise<string[]>;
			gitFetch: (repoPath: string) => Promise<GitOperationResult>;
			gitPull: (repoPath: string) => Promise<GitOperationResult>;
			getGitDiff: (repoPath: string, fromBranch: string, toBranch: string) => Promise<string>;
			callOllamaAPI: (config: { url: string; model: string; prompt: string }) => Promise<string>;
			testOllamaConnection: (config: { url: string; model: string }) => Promise<{
				success: boolean;
				error?: string;
				version?: string;
				modelResponse?: string;
			}>;
			callAzureAI: (config: { endpoint: string; apiKey: string; deploymentName: string; prompt: string }) => Promise<string>;
			callAzureAIChunked: (config: {
				endpoint: string;
				apiKey: string;
				deploymentName: string;
				prompt: string;
				diff: string;
				azureRateLimitTokensPerMinute?: number;
			}) => Promise<string>;
			calculateTokensWithChunking: (
				diff: string,
				basePrompt: string,
				userPrompt: string,
				provider: 'ollama' | 'azure',
				chunkConfig?: { maxTokensPerChunk?: number; encoding?: 'cl100k_base' | 'o200k_base'; systemPromptTokens?: number }
			) => Promise<{
				estimatedTokens: number;
				willChunk: boolean;
				chunkCount: number;
			}>;
			testAzureAIConnection: (config: { endpoint: string; apiKey: string; deploymentName: string }) => Promise<{
				success: boolean;
				error?: string;
				deploymentName?: string;
				modelResponse?: string;
			}>;
			loadConfig: () => Promise<AIProviderConfig>;
			saveConfig: (config: Partial<AIProviderConfig>) => Promise<{ success: boolean; error?: string }>;
			onOllamaProgress: (callback: (event: unknown, data: ProgressData) => void) => () => void;
			onAzureAIProgress: (callback: (event: unknown, data: ProgressData) => void) => () => void;
		};
	}
}
