import { IpcMainInvokeEvent } from 'electron';
import OpenAI from 'openai';
import { IAIProvider, AIProviderConfig, ProgressData } from './IAIProvider';

/**
 * Azure OpenAI-specific configuration
 */
export interface AzureOpenAIConfig extends AIProviderConfig {
	endpoint: string;
	apiKey: string;
	deploymentName: string;
}

/**
 * Azure OpenAI provider implementation
 * Communicates with Azure OpenAI service for AI responses
 */
export class AzureOpenAIProvider implements IAIProvider<AzureOpenAIConfig> {
	readonly name = 'azure';

	/**
	 * Generate AI response using Azure OpenAI streaming API
	 */
	async generate(event: IpcMainInvokeEvent, config: AzureOpenAIConfig): Promise<string> {
		const { endpoint, apiKey, deploymentName, prompt } = config;

		try {
			// Send initial progress
			this.sendProgress(event, {
				stage: 'connecting',
				progress: 45,
				message: 'Connecting to Azure AI service...',
				timestamp: Date.now(),
			});

			const startTime = Date.now();
			let totalTokens = 0;

			// Send request started progress
			this.sendProgress(event, {
				stage: 'sending',
				progress: 50,
				message: 'Sending request to Azure AI model...',
				timestamp: Date.now(),
				modelSize: prompt.length,
			});

			// Create Azure OpenAI client
			const client = this.createClient(endpoint, apiKey, deploymentName);

			this.sendProgress(event, {
				stage: 'processing',
				progress: 60,
				message: 'Azure AI model is processing...',
				timestamp: Date.now(),
			});

			// Make the streaming request to Azure OpenAI
			const stream = await client.chat.completions.create({
				model: deploymentName,
				messages: [
					{
						role: 'system',
						content: 'You are an expert code reviewer.',
					},
					{
						role: 'user',
						content: prompt,
					},
				],
				temperature: 0.1,
				max_tokens: 2000,
				stream: true,
			});

			let responseText = '';
			let chunkCount = 0;
			let usage = null;

			// Process the stream
			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta?.content || '';
				if (delta) {
					responseText += delta;
					chunkCount++;

					// Send streaming progress every few chunks
					if (chunkCount % 3 === 0) {
						const currentTime = Date.now();
						const elapsed = (currentTime - startTime) / 1000;
						const estimatedTokens = responseText.split(' ').length;
						const tokensPerSecond = elapsed > 0 ? estimatedTokens / elapsed : 0;

						this.sendProgress(event, {
							stage: 'streaming',
							progress: Math.min(60 + responseText.length / 50, 90),
							message: `Receiving AI response... (${estimatedTokens} tokens, ${tokensPerSecond.toFixed(1)} t/s)`,
							timestamp: currentTime,
							streamingContent: responseText,
							isStreaming: true,
							tokens: estimatedTokens,
							tokensPerSecond: tokensPerSecond,
							processingTime: elapsed,
						});
					}
				}

				// Capture usage information when available
				if (chunk.usage) {
					usage = chunk.usage;
				}
			}

			const responseTime = Date.now() - startTime;
			totalTokens = usage?.completion_tokens || responseText.split(' ').length;

			this.sendProgress(event, {
				stage: 'complete',
				progress: 100,
				message: 'AI response complete',
				timestamp: Date.now(),
				responseTime,
				tokens: totalTokens,
				actualInputTokens: usage?.prompt_tokens,
				actualOutputTokens: usage?.completion_tokens,
				totalActualTokens: usage?.total_tokens,
				streamingContent: responseText,
				isStreaming: false,
			});

			return responseText;
		} catch (error) {
			const err = error as Error & { code?: string; status?: number };
			this.sendProgress(event, {
				stage: 'error',
				progress: 0,
				message: `Error: ${err.message}`,
				timestamp: Date.now(),
				error: err.message,
			});

			throw new Error(this.formatError(err));
		}
	}

	/**
	 * Test connection to Azure OpenAI service
	 */
	async testConnection(config: Omit<AzureOpenAIConfig, 'prompt'>): Promise<{
		success: boolean;
		error?: string;
		deploymentName?: string;
		modelResponse?: string;
	}> {
		const { endpoint, apiKey, deploymentName } = config;

		try {
			// Create Azure OpenAI client
			const client = this.createClient(endpoint, apiKey, deploymentName);

			// Test with a simple request
			const testResponse = await client.chat.completions.create({
				model: deploymentName,
				messages: [
					{
						role: 'user',
						content: 'What is a function in programming? Please respond with one sentence.',
					},
				],
				max_tokens: 100,
				temperature: 0.1,
			});

			return {
				success: true,
				deploymentName: deploymentName,
				modelResponse: testResponse.choices[0]?.message?.content || 'OK',
			};
		} catch (error) {
			return {
				success: false,
				error: (error as Error).message,
			};
		}
	}

	/**
	 * Create OpenAI client configured for Azure
	 */
	private createClient(endpoint: string, apiKey: string, deploymentName: string): OpenAI {
		// Extract base URL from the full endpoint if it contains the full path
		let baseURL = endpoint;
		if (endpoint.includes('/openai/deployments/')) {
			// Extract just the base URL (e.g., https://resource.cognitiveservices.azure.com)
			baseURL = endpoint.split('/openai/deployments/')[0];
		}

		return new OpenAI({
			apiKey: apiKey,
			baseURL: `${baseURL}/openai/deployments/${deploymentName}`,
			defaultQuery: { 'api-version': '2025-01-01-preview' },
			defaultHeaders: {
				'api-key': apiKey,
			},
		});
	}

	/**
	 * Send progress update to renderer process
	 */
	private sendProgress(event: IpcMainInvokeEvent, data: ProgressData): void {
		event.sender.send('azure-ai-progress', data);
	}

	/**
	 * Format error message with troubleshooting steps
	 */
	private formatError(err: Error & { code?: string; status?: number }): string {
		let errorMessage = '';

		if (err.code === 'ENOTFOUND') {
			errorMessage =
				'Network Error: Could not connect to Azure AI service\n\n' +
				'Troubleshooting steps:\n' +
				'1. Check your internet connection\n' +
				'2. Verify the Azure AI endpoint URL is correct\n' +
				'3. Ensure firewall allows connections to Azure\n' +
				'4. Check if Azure AI service is operational';
		} else if (err.status === 401) {
			errorMessage =
				'Authentication Error: Invalid API key\n\n' +
				'Troubleshooting steps:\n' +
				'1. Verify your Azure AI API key is correct\n' +
				'2. Check if the API key has expired\n' +
				'3. Ensure the key has proper permissions\n' +
				'4. Regenerate the API key if necessary';
		} else if (err.status === 404) {
			errorMessage =
				'Model Error: Deployment not found\n\n' +
				'Troubleshooting steps:\n' +
				'1. Verify the deployment name is correct\n' +
				'2. Check if the model deployment exists in Azure\n' +
				'3. Ensure the deployment is active and running\n' +
				'4. Check the endpoint URL matches your resource';
		} else if (err.status === 429) {
			errorMessage =
				'Rate Limit Error: Too many requests\n\n' +
				'Troubleshooting steps:\n' +
				'1. Wait a moment and try again\n' +
				'2. Check your Azure AI quota limits\n' +
				'3. Consider upgrading your Azure AI tier\n' +
				'4. Implement request throttling';
		} else {
			errorMessage =
				`Azure AI Error: ${err.message}\n\n` +
				'Troubleshooting steps:\n' +
				'1. Check network connectivity to Azure\n' +
				'2. Verify all configuration settings\n' +
				'3. Review Azure AI service status\n' +
				'4. Contact Azure support if issue persists';
		}

		return errorMessage;
	}
}
