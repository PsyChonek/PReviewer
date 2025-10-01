import { IpcMainInvokeEvent } from 'electron';

/**
 * Progress data interface for streaming responses
 */
export interface ProgressData {
	stage: string;
	progress: number;
	message: string;
	timestamp: number;
	tokens?: number;
	tokensPerSecond?: number;
	processingTime?: number;
	streamingContent?: string;
	isStreaming?: boolean;
	bytesReceived?: number;
	responseTime?: number;
	actualInputTokens?: number;
	actualOutputTokens?: number;
	totalActualTokens?: number;
	error?: string;
	[key: string]: unknown;
}

/**
 * Base configuration interface for all AI providers
 */
export interface AIProviderConfig {
	prompt: string;
}

/**
 * Interface for AI provider implementations
 */
export interface IAIProvider<
	TConfig extends AIProviderConfig = AIProviderConfig,
> {
	/**
	 * Name of the provider (e.g., 'ollama', 'azure')
	 */
	readonly name: string;

	/**
	 * Generate AI response with streaming support
	 * @param event - IPC event for sending progress updates
	 * @param config - Provider-specific configuration
	 * @returns Promise resolving to the complete response text
	 */
	generate(event: IpcMainInvokeEvent, config: TConfig): Promise<string>;

	/**
	 * Test connection to the AI service
	 * @param config - Provider-specific configuration (without prompt)
	 * @returns Promise resolving to connection test result
	 */
	testConnection(config: Omit<TConfig, 'prompt'>): Promise<{
		success: boolean;
		error?: string;
		[key: string]: unknown;
	}>;
}
