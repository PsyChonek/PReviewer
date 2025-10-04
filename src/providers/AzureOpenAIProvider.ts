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
	azureRateLimitTokensPerMinute?: number; // Optional: override default rate limit (default: 95k tokens/min)
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
	async generate(event: IpcMainInvokeEvent, config: AzureOpenAIConfig, suppressProgress = false): Promise<string> {
		const { endpoint, apiKey, deploymentName, prompt } = config;

		try {
			const startTime = Date.now();
			let totalTokens = 0;

			// Send initial progress (unless suppressed for chunking)
			if (!suppressProgress) {
				this.sendProgress(event, {
					stage: 'connecting',
					progress: 45,
					message: 'Connecting to Azure AI service...',
					timestamp: Date.now(),
				});

				// Send request started progress
				this.sendProgress(event, {
					stage: 'sending',
					progress: 50,
					message: 'Sending request to Azure AI model...',
					timestamp: Date.now(),
					modelSize: prompt.length,
				});
			}

			// Create Azure OpenAI client
			const client = this.createClient(endpoint, apiKey, deploymentName);

			if (!suppressProgress) {
				this.sendProgress(event, {
					stage: 'processing',
					progress: 60,
					message: 'Azure AI model is processing...',
					timestamp: Date.now(),
				});
			}

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

					// Send streaming progress every few chunks (unless suppressed)
					if (!suppressProgress && chunkCount % 3 === 0) {
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

			if (!suppressProgress) {
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
			}

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
	 * Uses thread-based chunking where all chunks are sent to the same conversation
	 * AI is instructed to wait until all chunks are received before responding
	 */
	async generateWithChunking(event: IpcMainInvokeEvent, config: AzureOpenAIConfig, diff: string): Promise<string> {
		// Calculate base prompt tokens once (shared across all chunks)
		const basePromptTokens = countTokens(config.prompt, 'cl100k_base');

		// Calculate chunk context overhead (the "Part X of Y" text added to each chunk)
		const estimatedChunkContextTokens = 150; // Conservative estimate for chunk header text

		// Configure chunking: each chunk should be AT the rate limit
		// Rate limit = base prompt + diff content + chunk context overhead
		// So: diff content per chunk = rate limit - base prompt - overhead
		const rateLimitTokens = config.azureRateLimitTokensPerMinute || DEFAULT_CHUNK_CONFIG.maxTokensPerChunk;
		const maxDiffTokensPerChunk = rateLimitTokens - basePromptTokens - estimatedChunkContextTokens;

		const chunkConfig = {
			...DEFAULT_CHUNK_CONFIG,
			maxTokensPerChunk: maxDiffTokensPerChunk,
			systemPromptTokens: 0, // Already accounted for above
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
			message: `Processing ${chunks.length} chunks in threaded conversation (${chunks.reduce((sum, c) => sum + c.fileCount, 0)} files total, rate limit: ${(config.azureRateLimitTokensPerMinute || 95000).toLocaleString()} tokens/min)...`,
			timestamp: Date.now(),
		});

		// Track rate limiting
		const RATE_LIMIT_TOKENS = config.azureRateLimitTokensPerMinute || 95000; // Default: 95k to leave 5k margin from Azure's 100k limit
		const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
		let tokensInCurrentWindow = 0;
		let windowStartTime = Date.now();

		// Maintain conversation history for thread-based chunking
		const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
			{
				role: 'system',
				content: 'You are an expert code reviewer.',
			},
			{
				role: 'user',
				content: config.prompt,
			},
		];

		let totalProcessingTime = 0;
		let cumulativeInputTokens = 0;

		// Create Azure OpenAI client once for the entire conversation
		const client = this.createClient(config.endpoint, config.apiKey, config.deploymentName);

		// Send all chunks in the same conversation thread
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];
			const isLastChunk = i === chunks.length - 1;

			// Calculate total tokens for this request
			const chunkTotalTokens = basePromptTokens + chunk.tokenCount;

			// Check if we need to wait for rate limit window
			const elapsedSinceWindowStart = Date.now() - windowStartTime;
			if (tokensInCurrentWindow + chunkTotalTokens > RATE_LIMIT_TOKENS && elapsedSinceWindowStart < RATE_LIMIT_WINDOW_MS) {
				const waitTime = RATE_LIMIT_WINDOW_MS - elapsedSinceWindowStart;
				this.sendProgress(event, {
					stage: 'rate-limit-wait',
					progress: 10 + (i / chunks.length) * 70,
					message: `Rate limit: waiting ${(waitTime / 1000).toFixed(0)}s before chunk ${i + 1}/${chunks.length} (${tokensInCurrentWindow.toLocaleString()}/${RATE_LIMIT_TOKENS.toLocaleString()} tokens used)...`,
					timestamp: Date.now(),
					actualInputTokens: cumulativeInputTokens,
				});

				await this.delay(waitTime);

				// Reset window
				windowStartTime = Date.now();
				tokensInCurrentWindow = 0;
			}

			// Update progress for this chunk
			this.sendProgress(event, {
				stage: 'processing-chunk',
				progress: 10 + (i / chunks.length) * 70,
				message: `Sending chunk ${i + 1}/${chunks.length} to thread (${chunk.fileCount} files, ${chunkTotalTokens.toLocaleString()} tokens)...`,
				timestamp: Date.now(),
				actualInputTokens: cumulativeInputTokens,
			});

			try {
				// Build chunk message with instructions
				const chunkMessage = this.buildThreadChunkMessage(chunk, i, chunks.length, isLastChunk);

				// Add chunk to conversation
				conversationHistory.push({
					role: 'user',
					content: chunkMessage,
				});

				const startTime = Date.now();

				// For all chunks except the last, request acknowledgment only
				if (!isLastChunk) {
					// Send chunk and get acknowledgment
					const stream = await client.chat.completions.create({
						model: config.deploymentName,
						messages: conversationHistory,
						temperature: 0.1,
						max_tokens: 50, // Minimal tokens for acknowledgment
						stream: true,
					});

					let ackText = '';
					for await (const part of stream) {
						const delta = part.choices[0]?.delta?.content || '';
						ackText += delta;
					}

					// Add AI acknowledgment to conversation history
					conversationHistory.push({
						role: 'assistant',
						content: ackText.trim() || 'Acknowledged.',
					});

					const duration = Date.now() - startTime;
					totalProcessingTime += duration;
				} else {
					// Last chunk: request full review response
					const stream = await client.chat.completions.create({
						model: config.deploymentName,
						messages: conversationHistory,
						temperature: 0.1,
						max_tokens: 4000, // Full response for review
						stream: true,
					});

					let responseText = '';
					let chunkCount = 0;
					let usage = null;

					// Update progress to show we're generating the final response
					this.sendProgress(event, {
						stage: 'generating',
						progress: 85,
						message: 'Generating final review from all chunks...',
						timestamp: Date.now(),
						actualInputTokens: cumulativeInputTokens,
					});

					// Process the stream for final response
					for await (const part of stream) {
						const delta = part.choices[0]?.delta?.content || '';
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
									progress: Math.min(85 + responseText.length / 200, 98),
									message: `Receiving final review... (${estimatedTokens} tokens, ${tokensPerSecond.toFixed(1)} t/s)`,
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
						if (part.usage) {
							usage = part.usage;
						}
					}

					const duration = Date.now() - startTime;
					totalProcessingTime += duration;

					const totalTokens = usage?.completion_tokens || countTokens(responseText, 'cl100k_base');

					this.sendProgress(event, {
						stage: 'complete',
						progress: 100,
						message: `Review complete (${chunks.length} chunks processed in thread in ${(totalProcessingTime / 1000).toFixed(1)}s)`,
						timestamp: Date.now(),
						responseTime: totalProcessingTime,
						actualInputTokens: usage?.prompt_tokens || cumulativeInputTokens,
						actualOutputTokens: usage?.completion_tokens,
						totalActualTokens: usage?.total_tokens,
						tokens: totalTokens,
						streamingContent: responseText,
						isStreaming: false,
					});

					return responseText;
				}

				// Update rate limit tracking with full token count
				tokensInCurrentWindow += chunkTotalTokens;
				cumulativeInputTokens += chunkTotalTokens;

				// Small delay between chunks within same window
				if (i < chunks.length - 1 && tokensInCurrentWindow < RATE_LIMIT_TOKENS) {
					await this.delay(1000);
				}
			} catch (error) {
				const err = error as Error & { status?: number };

				// Handle rate limit errors with exponential backoff
				if (err.status === 429) {
					this.sendProgress(event, {
						stage: 'rate-limit-retry',
						progress: 10 + (i / chunks.length) * 70,
						message: `Rate limit hit on chunk ${i + 1}. Waiting 60 seconds...`,
						timestamp: Date.now(),
						actualInputTokens: cumulativeInputTokens,
					});

					await this.delay(60000); // Wait 60 seconds

					// Reset window and retry
					windowStartTime = Date.now();
					tokensInCurrentWindow = 0;
					i--; // Retry this chunk
					continue;
				}

				// Re-throw other errors
				throw error;
			}
		}

		// Should not reach here as last chunk returns the response
		throw new Error('Chunking process completed without generating final response');
	}

	/**
	 * Build a message for a specific chunk in the threaded conversation
	 * Instructs AI to acknowledge receipt for non-final chunks, or provide full review for final chunk
	 */
	private buildThreadChunkMessage(chunk: DiffChunk, chunkIndex: number, totalChunks: number, isLastChunk: boolean): string {
		if (!isLastChunk) {
			// For non-final chunks: send the chunk and ask for acknowledgment only
			return (
				`## Code Review - Part ${chunkIndex + 1} of ${totalChunks}\n\n` +
				`I am sending you a large code diff split into ${totalChunks} parts. This is part ${chunkIndex + 1}.\n` +
				`**IMPORTANT: Do NOT provide your review yet. Simply acknowledge receipt of this chunk.**\n\n` +
				`This chunk contains ${chunk.fileCount} file(s): ${chunk.files.join(', ')}\n\n` +
				`Please respond with ONLY: "Received part ${chunkIndex + 1} of ${totalChunks}. Ready for next part."\n\n` +
				`Here is the code diff for part ${chunkIndex + 1}:\n\n` +
				`${chunk.content}`
			);
		} else {
			// For the final chunk: send the chunk and request the complete review
			return (
				`## Code Review - Part ${chunkIndex + 1} of ${totalChunks} (FINAL)\n\n` +
				`This is the final part (${chunkIndex + 1} of ${totalChunks}).\n` +
				`This chunk contains ${chunk.fileCount} file(s): ${chunk.files.join(', ')}\n\n` +
				`Here is the code diff for the final part:\n\n` +
				`${chunk.content}\n\n` +
				`---\n\n` +
				`**You have now received ALL ${totalChunks} parts of the code diff.**\n` +
				`Please provide your complete code review now, considering all ${totalChunks} parts together as a cohesive whole.`
			);
		}
	}

	/**
	 * Delay helper for rate limiting
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
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
