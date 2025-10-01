import { IpcMainInvokeEvent } from 'electron';
import OpenAI from 'openai';
import { IAIProvider, AIProviderConfig, ProgressData } from './IAIProvider';
import { countTokens } from '../utils/tokenEstimation';
import { chunkDiff, needsChunking, getChunkMetadata, DiffChunk, DEFAULT_CHUNK_CONFIG } from '../utils/diffChunker';

/**
 * Azure OpenAI-specific configuration
 */
export interface AzureOpenAIConfig extends AIProviderConfig {
	endpoint: string;
	apiKey: string;
	deploymentName: string;
	maxTokensPerChunk?: number; // Optional: override default chunk size
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
						const estimatedTokens = countTokens(responseText, 'cl100k_base');
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
			totalTokens = usage?.completion_tokens || countTokens(responseText, 'cl100k_base');

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
	 * Generate AI response with automatic chunking for large diffs
	 * Splits prompts that exceed rate limits and combines results
	 */
	async generateWithChunking(event: IpcMainInvokeEvent, config: AzureOpenAIConfig, diff: string): Promise<string> {
		const chunkConfig = {
			...DEFAULT_CHUNK_CONFIG,
			maxTokensPerChunk: config.maxTokensPerChunk || DEFAULT_CHUNK_CONFIG.maxTokensPerChunk,
		};

		// Check if chunking is needed
		if (!needsChunking(diff, chunkConfig)) {
			// Use normal generation for small diffs
			return this.generate(event, config);
		}

		// Get chunk metadata for progress reporting
		const metadata = getChunkMetadata(diff, chunkConfig);
		this.sendProgress(event, {
			stage: 'analyzing',
			progress: 5,
			message: `Large diff detected (${metadata.totalTokens.toLocaleString()} tokens). Splitting into ${metadata.estimatedChunks} chunks...`,
			timestamp: Date.now(),
		});

		// Chunk the diff
		const chunks = chunkDiff(diff, chunkConfig);

		this.sendProgress(event, {
			stage: 'chunking',
			progress: 10,
			message: `Processing ${chunks.length} chunks (${chunks.reduce((sum, c) => sum + c.fileCount, 0)} files total)...`,
			timestamp: Date.now(),
		});

		// Process each chunk
		const results: string[] = [];
		let totalProcessingTime = 0;

		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];

			// Update progress for this chunk
			this.sendProgress(event, {
				stage: 'processing-chunk',
				progress: 10 + (i / chunks.length) * 80,
				message: `Processing chunk ${i + 1}/${chunks.length} (${chunk.fileCount} files, ${chunk.tokenCount.toLocaleString()} tokens)...`,
				timestamp: Date.now(),
			});

			try {
				// Build prompt for this chunk with context
				const chunkPrompt = this.buildChunkPrompt(config.prompt, chunk, i, chunks.length);

				// Generate response for this chunk
				const chunkConfig: AzureOpenAIConfig = {
					...config,
					prompt: chunkPrompt,
				};

				const startTime = Date.now();
				const response = await this.generate(event, chunkConfig);
				const duration = Date.now() - startTime;
				totalProcessingTime += duration;

				results.push(response);

				// Add delay between chunks to respect rate limits
				if (i < chunks.length - 1) {
					const delayMs = 1000; // 1 second between chunks
					this.sendProgress(event, {
						stage: 'rate-limit-wait',
						progress: 10 + ((i + 1) / chunks.length) * 80,
						message: `Chunk ${i + 1}/${chunks.length} complete. Waiting before next chunk...`,
						timestamp: Date.now(),
					});
					await this.delay(delayMs);
				}
			} catch (error) {
				const err = error as Error & { status?: number };

				// Handle rate limit errors with exponential backoff
				if (err.status === 429) {
					this.sendProgress(event, {
						stage: 'rate-limit-retry',
						progress: 10 + (i / chunks.length) * 80,
						message: `Rate limit hit on chunk ${i + 1}. Waiting 60 seconds...`,
						timestamp: Date.now(),
					});

					await this.delay(60000); // Wait 60 seconds
					i--; // Retry this chunk
					continue;
				}

				// Re-throw other errors
				throw error;
			}
		}

		// Combine results
		this.sendProgress(event, {
			stage: 'combining',
			progress: 95,
			message: 'Combining results from all chunks...',
			timestamp: Date.now(),
		});

		const combinedResult = this.combineChunkResults(results, chunks);

		this.sendProgress(event, {
			stage: 'complete',
			progress: 100,
			message: `Review complete (${chunks.length} chunks processed in ${(totalProcessingTime / 1000).toFixed(1)}s)`,
			timestamp: Date.now(),
			responseTime: totalProcessingTime,
		});

		return combinedResult;
	}

	/**
	 * Build a prompt for a specific chunk with context
	 */
	private buildChunkPrompt(basePrompt: string, chunk: DiffChunk, chunkIndex: number, totalChunks: number): string {
		const chunkContext =
			totalChunks > 1
				? `\n\n## Chunk ${chunkIndex + 1} of ${totalChunks}\n` +
					`This is part ${chunkIndex + 1} of a ${totalChunks}-part review. ` +
					`This chunk contains ${chunk.fileCount} file(s): ${chunk.files.join(', ')}\n\n`
				: '';

		return `${basePrompt}${chunkContext}${chunk.content}`;
	}

	/**
	 * Combine results from multiple chunks into a single review
	 */
	private combineChunkResults(results: string[], chunks: DiffChunk[]): string {
		if (results.length === 1) {
			return results[0];
		}

		let combined = '# Code Review (Multi-Part)\n\n';
		combined += `This review was split into ${results.length} parts due to size. Below are the combined results:\n\n`;
		combined += '---\n\n';

		for (let i = 0; i < results.length; i++) {
			combined += `## Part ${i + 1} of ${results.length}\n`;
			combined += `**Files reviewed:** ${chunks[i].files.join(', ')}\n\n`;
			combined += results[i];
			combined += '\n\n---\n\n';
		}

		return combined;
	}

	/**
	 * Delay helper for rate limiting
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
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
