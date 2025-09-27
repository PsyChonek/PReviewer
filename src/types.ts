export interface AppState {
  currentRepoPath: string | null;
  reviewInProgress: boolean;
  reviewStartTime: number | null;
  currentOutputMarkdown: string;
  debugMode: boolean;
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

declare global {
  interface Window {
    electronAPI: {
      selectDirectory: () => Promise<string | null>;
      getBranches: (repoPath: string) => Promise<BranchInfo[]>;
      getDiff: (repoPath: string, fromBranch: string, toBranch: string) => Promise<string>;
      testOllamaConnection: (url: string, model: string) => Promise<{ success: boolean; message: string }>;
      testAzureConnection: (endpoint: string, apiKey: string, deployment: string) => Promise<{ success: boolean; message: string }>;
      reviewWithOllama: (url: string, model: string, prompt: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      reviewWithAzure: (endpoint: string, apiKey: string, deployment: string, prompt: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    };
  }
}