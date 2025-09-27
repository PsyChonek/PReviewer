import { AIProviderConfig } from '../types';
import { buildPrompt } from '../utils/prompts';
import { estimateTokens } from '../utils/tokenEstimation';

export interface ReviewRequest {
  repoPath: string;
  fromBranch: string;
  toBranch: string;
  basePrompt: string;
  userPrompt: string;
  aiConfig: AIProviderConfig;
  debugMode?: boolean;
}

export interface ReviewResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface ReviewProgress {
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  tokensPerSecond: number;
  processingTime: number;
  responseTime: number;
  stage: string;
  progress: number;
}

export class ReviewService {
  private static instance: ReviewService;
  private progressCallbacks: ((progress: ReviewProgress) => void)[] = [];

  private constructor() {}

  static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  async startReview(request: ReviewRequest): Promise<ReviewResult> {
    try {
      // Validate inputs
      if (!request.repoPath || !request.fromBranch || !request.toBranch) {
        return {
          success: false,
          error: 'Please select a repository and both branches before starting the review.'
        };
      }

      // Get the diff
      const diff = await window.electronAPI.getGitDiff(
        request.repoPath,
        request.fromBranch,
        request.toBranch
      );

      if (!diff || diff.trim() === '') {
        return {
          success: true,
          content: '## No Changes Found\n\nNo differences were found between the selected branches.'
        };
      }

      // Build the prompt
      const fullPrompt = buildPrompt(diff, request.basePrompt, request.userPrompt);

      if (request.debugMode) {
        console.log('Estimated tokens:', estimateTokens(fullPrompt));
        console.log('Full prompt:', fullPrompt);
      }

      // Call the appropriate AI service
      try {
        let response: string;
        if (request.aiConfig.provider === 'ollama') {
          response = await window.electronAPI.callOllamaAPI({
            url: request.aiConfig.ollama.url,
            model: request.aiConfig.ollama.model,
            prompt: fullPrompt
          });
        } else {
          response = await window.electronAPI.callAzureAI({
            endpoint: request.aiConfig.azure.endpoint,
            apiKey: request.aiConfig.azure.apiKey,
            deploymentName: request.aiConfig.azure.deployment,
            prompt: fullPrompt
          });
        }

        return { success: true, content: response };
      } catch (apiError) {
        return { success: false, error: String(apiError) };
      }
    } catch (error) {
      console.error('Review failed:', error);
      return {
        success: false,
        error: `Failed to complete the review: ${error}`
      };
    }
  }

  async calculateInputTokens(
    repoPath: string,
    fromBranch: string,
    toBranch: string,
    basePrompt: string,
    userPrompt: string
  ): Promise<number> {
    if (!repoPath || !fromBranch || !toBranch || fromBranch === toBranch) {
      return 0;
    }

    try {
      const diff = await window.electronAPI.getGitDiff(repoPath, fromBranch, toBranch);
      if (!diff || diff.trim() === '') {
        return 0;
      }

      const fullPrompt = buildPrompt(diff, basePrompt, userPrompt);
      return estimateTokens(fullPrompt);
    } catch (error) {
      console.error('Failed to calculate input tokens:', error);
      return 0;
    }
  }

  async testConnection(aiConfig: AIProviderConfig): Promise<{ success: boolean; message: string; provider: string }> {
    try {
      let result: any;
      let providerName: string;

      if (aiConfig.provider === 'ollama') {
        result = await window.electronAPI.testOllamaConnection({
          url: aiConfig.ollama.url,
          model: aiConfig.ollama.model
        });
        providerName = 'Ollama';
      } else {
        result = await window.electronAPI.testAzureAIConnection({
          endpoint: aiConfig.azure.endpoint,
          apiKey: aiConfig.azure.apiKey,
          deploymentName: aiConfig.azure.deployment
        });
        providerName = 'Azure AI';
      }

      if (result.success) {
        const modelInfo = aiConfig.provider === 'ollama'
          ? (result.version || result.modelResponse || 'OK')
          : (result.modelResponse || 'OK');

        return {
          success: true,
          message: `${providerName} connection successful! Model responded: "${modelInfo}"`,
          provider: providerName
        };
      } else {
        return {
          success: false,
          message: `${providerName} test failed: ${result.error}`,
          provider: providerName
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error}`,
        provider: aiConfig.provider
      };
    }
  }

  onProgress(callback: (progress: ReviewProgress) => void): () => void {
    this.progressCallbacks.push(callback);

    // Return cleanup function
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index > -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  private notifyProgress(progress: ReviewProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
  }
}

export const reviewService = ReviewService.getInstance();