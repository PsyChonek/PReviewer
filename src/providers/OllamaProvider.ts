import { IpcMainInvokeEvent } from 'electron';
import axios, { AxiosError } from 'axios';
import { IAIProvider, AIProviderConfig, ProgressData } from './IAIProvider';
import { countTokens } from '../utils/tokenEstimation';

/**
 * Ollama-specific configuration
 */
export interface OllamaConfig extends AIProviderConfig {
	url: string;
	model: string;
}

/**
 * Ollama AI provider implementation
 * Communicates with local Ollama API for AI responses
 */
export class OllamaProvider implements IAIProvider<OllamaConfig> {
	readonly name = 'ollama';

	/**
	 * Generate AI response using Ollama streaming API
	 */
	async generate(event: IpcMainInvokeEvent, config: OllamaConfig): Promise<string> {
		const { url, model, prompt } = config;

		try {
			// Send initial progress
			this.sendProgress(event, {
				stage: 'connecting',
				progress: 45,
				message: 'Connecting to Ollama API...',
				timestamp: Date.now(),
			});

			const startTime = Date.now();
			let totalTokens = 0;
			let responseText = '';

			// Calculate request size for data transfer tracking
			const requestData = { model, prompt, stream: true };
			const requestSize = JSON.stringify(requestData).length;

			// Send request started progress
			this.sendProgress(event, {
				stage: 'sending',
				progress: 50,
				message: 'Sending request to AI model...',
				timestamp: Date.now(),
				modelSize: prompt.length,
				bytesUploaded: requestSize,
				totalBytes: requestSize,
			});

			// Use /api/generate with stream: true for streaming responses
			const response = await axios.post(url, requestData, {
				timeout: 120000, // 2 minutes timeout
				responseType: 'stream',
			});

			this.sendProgress(event, {
				stage: 'processing',
				progress: 60,
				message: 'AI model is processing...',
				timestamp: Date.now(),
			});

			return new Promise<string>((resolve, reject) => {
				let buffer = '';
				let lastProgressUpdate = Date.now();
				let bytesReceived = 0;

				response.data.on('data', (chunk: Buffer) => {
					const chunkSize = chunk.length;
					bytesReceived += chunkSize;

					buffer += chunk.toString();
					const lines = buffer.split('\n');
					buffer = lines.pop() || ''; // Keep incomplete line in buffer

					lines.forEach((line) => {
						if (line.trim()) {
							try {
								const data = JSON.parse(line) as {
									response?: string;
									done?: boolean;
									prompt_eval_count?: number;
									eval_count?: number;
								};

								if (data.response) {
									responseText += data.response;
									totalTokens++;

									// Update progress every 100ms or every 10 tokens
									const now = Date.now();
									if (now - lastProgressUpdate > 100 || totalTokens % 10 === 0) {
										const elapsed = (now - startTime) / 1000;
										const tokensPerSecond = totalTokens / elapsed;

										// Dynamic progress calculation based on response length
										const estimatedTotalTokens = Math.max(100, countTokens(prompt, 'cl100k_base'));
										const tokenProgress = Math.min(25, (totalTokens / estimatedTotalTokens) * 25);
										const progress = Math.min(95, 60 + tokenProgress);

										this.sendProgress(event, {
											stage: 'streaming',
											progress: progress,
											message: `Receiving AI response... (${totalTokens} tokens, ${tokensPerSecond.toFixed(1)} t/s)`,
											timestamp: now,
											tokens: totalTokens,
											tokensPerSecond: tokensPerSecond,
											processingTime: elapsed,
											streamingContent: responseText,
											isStreaming: true,
											bytesReceived: bytesReceived,
										});

										lastProgressUpdate = now;
									}
								}

								if (data.done) {
									const responseTime = Date.now() - startTime;

									// Ollama provides actual token counts in the final response
									const actualInputTokens = data.prompt_eval_count;
									const actualOutputTokens = data.eval_count;

									this.sendProgress(event, {
										stage: 'complete',
										progress: 100,
										message: 'AI response complete',
										timestamp: Date.now(),
										responseTime,
										tokens: actualOutputTokens || totalTokens,
										tokensPerSecond: (actualOutputTokens || totalTokens) / (responseTime / 1000),
										bytesReceived: bytesReceived,
										streamingContent: responseText,
										isStreaming: false,
										actualInputTokens: actualInputTokens,
										actualOutputTokens: actualOutputTokens,
										totalActualTokens: (actualInputTokens || 0) + (actualOutputTokens || 0),
									});

									resolve(responseText);
								}
							} catch {
								// Ignore JSON parse errors for partial chunks
							}
						}
					});
				});

				response.data.on('error', (error: Error) => {
					this.sendProgress(event, {
						stage: 'error',
						progress: 0,
						message: `Stream error: ${error.message}`,
						timestamp: Date.now(),
						error: error.message,
					});
					reject(error);
				});

				response.data.on('end', () => {
					if (!responseText) {
						reject(new Error('No response received from AI model'));
					}
				});
			});
		} catch (error) {
			const err = error as AxiosError;
			this.sendProgress(event, {
				stage: 'error',
				progress: 0,
				message: `Error: ${err.message}`,
				timestamp: Date.now(),
				error: err.message,
			});

			throw new Error(this.formatError(err, model));
		}
	}

	/**
	 * Test connection to Ollama service
	 */
	async testConnection(config: Omit<OllamaConfig, 'prompt'>): Promise<{
		success: boolean;
		error?: string;
		version?: string;
		modelResponse?: string;
	}> {
		const { url, model } = config;

		try {
			// Test server connection
			const versionUrl = url.replace('/api/generate', '/api/version');
			const versionResponse = await axios.get(versionUrl, { timeout: 5000 });

			// Test model availability with a simple coding question
			const testResponse = await axios.post<{ response?: string }>(
				url,
				{
					model: model,
					prompt: 'What is a function in programming? Please respond with one sentence.',
					stream: false,
				},
				{ timeout: 15000 }
			);

			return {
				success: true,
				version: versionResponse.data.version || 'Unknown',
				modelResponse: testResponse.data.response || 'OK',
			};
		} catch (error) {
			const err = error as AxiosError;
			let errorMessage = (error as Error).message;

			// Provide specific guidance for 404 errors
			if (err.response?.status === 404) {
				errorMessage = `Model "${model}" not found. Please install it first:\n\nRun: ollama pull ${model}\n\nOr check available models: ollama list`;
			}

			return {
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Send progress update to renderer process
	 */
	private sendProgress(event: IpcMainInvokeEvent, data: ProgressData): void {
		event.sender.send('ollama-progress', data);
	}

	/**
	 * Format error message with troubleshooting steps
	 */
	private formatError(err: AxiosError, model: string): string {
		let errorMessage = '';

		if (err.response) {
			errorMessage = `API Error: ${err.response.status} - ${err.response.statusText}`;

			if (err.response.status === 404) {
				errorMessage +=
					'\n\nTroubleshooting steps:\n' +
					`1. Install the model: ollama pull ${model}\n` +
					'2. Check available models: ollama list\n' +
					'3. Verify the model name is spelled correctly\n' +
					'4. Ensure Ollama server is running: ollama serve';
			} else if (err.response.status === 500) {
				errorMessage +=
					'\n\nTroubleshooting steps:\n' +
					'1. Check Ollama server logs for detailed error\n' +
					'2. Restart Ollama service\n' +
					'3. Try a different model if this one is corrupted\n' +
					'4. Check available system memory and disk space';
			} else if (err.response.status === 503) {
				errorMessage +=
					'\n\nTroubleshooting steps:\n' +
					'1. Ollama server may be overloaded, wait and retry\n' +
					'2. Check system resources (CPU, memory)\n' +
					'3. Restart Ollama service\n' +
					'4. Try with a smaller prompt or different model';
			}
		} else if (err.request) {
			errorMessage =
				'Network Error: Could not connect to Ollama API\n\n' +
				'Troubleshooting steps:\n' +
				'1. Ensure Ollama is running: ollama serve\n' +
				'2. Check the API URL (default: http://localhost:11434/api/generate)\n' +
				'3. Verify firewall settings allow connections to port 11434\n' +
				'4. Try accessing the API directly: curl http://localhost:11434/api/version\n' +
				'5. Check if another process is using port 11434';
		} else {
			errorMessage =
				`Request Error: ${err.message}\n\n` +
				'Troubleshooting steps:\n' +
				'1. Check network connectivity\n' +
				'2. Verify Ollama server is accessible\n' +
				'3. Review configuration settings\n' +
				'4. Restart the application';
		}

		return errorMessage;
	}
}
