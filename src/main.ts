import {
	app,
	BrowserWindow,
	ipcMain,
	dialog,
	Menu,
	IpcMainInvokeEvent,
	globalShortcut,
} from 'electron';
import path from 'path';
import fs from 'fs/promises';
import simpleGit, { SimpleGit } from 'simple-git';
import axios, { AxiosError } from 'axios';
import OpenAI from 'openai';

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			sandbox: false, // Disable sandbox for development
			preload: path.join(__dirname, 'preload.js'),
		},
		icon: path.join(process.resourcesPath, 'assets', 'icon.png'), // Icon from assets directory
		titleBarStyle: 'default',
		show: false,
	});

	// Load the app - Check for development vs production
	const isDev = process.env.NODE_ENV === 'development';

	if (isDev) {
		// In development, load from Vite dev server
		const devServerUrl = 'http://localhost:3002';
		console.log('Loading development URL:', devServerUrl);
		mainWindow.loadURL(devServerUrl);
	} else {
		// In production, load the built files from .vite/renderer
		console.log('Loading production file');
		const rendererPath = path.join(
			process.resourcesPath,
			'.vite',
			'renderer',
			'index.html'
		);
		console.log('Renderer path:', rendererPath);
		mainWindow.loadFile(rendererPath);
	}

	// Development tools and shortcuts
	if (isDev) {
		mainWindow.webContents.openDevTools();

		try {
			// Add keyboard shortcuts for development
			globalShortcut.register('F5', () => {
				if (mainWindow && !mainWindow.isDestroyed()) {
					mainWindow.webContents.reloadIgnoringCache();
				}
			});
			globalShortcut.register('CommandOrControl+R', () => {
				if (mainWindow && !mainWindow.isDestroyed()) {
					mainWindow.webContents.reloadIgnoringCache();
				}
			});
		} catch (error) {
			console.log('Dev tools not available:', (error as Error).message);
		}
	}

	// Add error and success handlers for both dev and prod
	mainWindow.webContents.on(
		'did-fail-load',
		(event, errorCode, errorDescription, validatedURL) => {
			console.error(
				'Page failed to load:',
				errorCode,
				errorDescription,
				validatedURL
			);
		}
	);

	mainWindow.webContents.on('did-finish-load', () => {
		console.log('Page finished loading successfully');
	});

	// Add keyboard shortcut handling as fallback
	mainWindow.webContents.on('before-input-event', (event, input) => {
		if (input.key === 'F12') {
			console.log('F12 detected via before-input-event');
			if (mainWindow) {
				mainWindow.webContents.toggleDevTools();
			}
		}
	});

	// Show window when ready to prevent visual flash
	mainWindow.once('ready-to-show', () => {
		console.log('Window ready to show');
		if (mainWindow) {
			mainWindow.show();
		}

		// Register F12 shortcut after window is ready
		try {
			const registered = globalShortcut.register('F12', () => {
				console.log('F12 pressed - toggling dev tools');
				if (mainWindow && !mainWindow.isDestroyed()) {
					mainWindow.webContents.toggleDevTools();
				}
			});

			if (registered) {
				console.log('F12 shortcut registered successfully');
			} else {
				console.log('F12 shortcut registration failed');
			}
		} catch (error) {
			console.log('F12 shortcut not available:', (error as Error).message);
		}
	});

	// Open DevTools in development
	if (process.env.NODE_ENV === 'development') {
		mainWindow.webContents.openDevTools();
	}
};

// Config file management
interface Config {
	defaults?: {
		aiProvider?: {
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
		};
		debugMode?: boolean;
	};
	prompts?: {
		basePrompt?: string;
		userPrompt?: string;
	};
}

const getConfigPath = (): string => {
	const userDataPath = app.getPath('userData');
	return path.join(userDataPath, 'config.json');
};

const getDefaultConfigPath = (): string => {
	return path.join(__dirname, '..', 'config.json');
};

async function loadDefaultConfig(): Promise<Config> {
	try {
		const defaultConfigPath = getDefaultConfigPath();
		const data = await fs.readFile(defaultConfigPath, 'utf8');
		return JSON.parse(data);
	} catch (error) {
		console.error('Failed to load default config:', error);
		// Return minimal fallback config
		return {
			defaults: {
				aiProvider: {
					provider: 'ollama',
					ollama: {
						url: 'http://localhost:11434',
						model: 'llama3.2:3b',
					},
					azure: { endpoint: '', apiKey: '', deployment: '' },
				},
				debugMode: false,
			},
			prompts: {
				basePrompt:
					'You are an expert code reviewer. Analyze the following code changes and provide feedback.',
				userPrompt: '',
			},
		};
	}
}

async function loadUserConfig(): Promise<Config> {
	try {
		const userConfigPath = getConfigPath();
		const data = await fs.readFile(userConfigPath, 'utf8');
		return JSON.parse(data);
	} catch {
		// File doesn't exist or is corrupted, return empty object
		return {};
	}
}

async function saveUserConfig(config: Config): Promise<void> {
	try {
		const userConfigPath = getConfigPath();
		const userDir = path.dirname(userConfigPath);

		// Ensure directory exists
		await fs.mkdir(userDir, { recursive: true });

		// Load existing user config and merge
		const existingConfig = await loadUserConfig();
		const mergedConfig = { ...existingConfig, ...config };

		await fs.writeFile(userConfigPath, JSON.stringify(mergedConfig, null, 2));
		console.log('User config saved to:', userConfigPath);
	} catch (error) {
		console.error('Failed to save user config:', error);
		throw error;
	}
}

// IPC handlers for config
ipcMain.handle('load-config', async (): Promise<Config> => {
	try {
		const defaultConfig = await loadDefaultConfig();
		const userConfig = await loadUserConfig();

		// Merge default config with user overrides
		const mergedConfig = mergeDeep(defaultConfig, userConfig);
		return mergedConfig;
	} catch (error) {
		console.error('Failed to load config:', error);
		throw error;
	}
});

ipcMain.handle(
	'save-config',
	async (
		_event: IpcMainInvokeEvent,
		config: Config
	): Promise<{ success: boolean; error?: string }> => {
		try {
			await saveUserConfig(config);
			return { success: true };
		} catch (error) {
			console.error('Failed to save config:', error);
			return { success: false, error: (error as Error).message };
		}
	}
);

// Deep merge utility function
function mergeDeep(target: Config, source: Config): Config {
	const output = Object.assign({}, target);
	if (isObject(target) && isObject(source)) {
		Object.keys(source).forEach((key) => {
			const sourceKey = key as keyof Config;
			if (isObject(source[sourceKey])) {
				if (!(key in target)) {
					Object.assign(output, { [key]: source[sourceKey] });
				} else {
					output[sourceKey] = mergeDeep(
						target[sourceKey] as Config,
						source[sourceKey] as Config
					) as typeof output[typeof sourceKey];
				}
			} else {
				Object.assign(output, { [key]: source[sourceKey] });
			}
		});
	}
	return output;
}

function isObject(item: unknown): item is Record<string, unknown> {
	return item !== null && typeof item === 'object' && !Array.isArray(item);
}

// IPC handlers for file operations
ipcMain.handle('select-directory', async (): Promise<string | null> => {
	if (!mainWindow) return null;

	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ['openDirectory'],
		title: 'Select Git Repository',
	});

	if (!result.canceled && result.filePaths.length > 0) {
		return result.filePaths[0];
	}
	return null;
});

// IPC handlers for Git operations
interface GitOperationResult {
	success: boolean;
	message?: string;
	error?: string;
	summary?: unknown;
}

ipcMain.handle(
	'git-fetch',
	async (_event: IpcMainInvokeEvent, repoPath: string): Promise<GitOperationResult> => {
		try {
			const git: SimpleGit = simpleGit(repoPath);
			await git.fetch();
			return { success: true, message: 'Successfully fetched latest changes' };
		} catch (error) {
			console.error('Git fetch failed:', error);
			return {
				success: false,
				error: `Failed to fetch: ${(error as Error).message}`,
			};
		}
	}
);

ipcMain.handle(
	'git-pull',
	async (_event: IpcMainInvokeEvent, repoPath: string): Promise<GitOperationResult> => {
		try {
			const git: SimpleGit = simpleGit(repoPath);
			const result = await git.pull();
			return {
				success: true,
				message: 'Successfully pulled latest changes',
				summary: result.summary,
			};
		} catch (error) {
			console.error('Git pull failed:', error);
			return {
				success: false,
				error: `Failed to pull: ${(error as Error).message}`,
			};
		}
	}
);

ipcMain.handle(
	'get-git-branches',
	async (_event: IpcMainInvokeEvent, repoPath: string): Promise<string[]> => {
		try {
			const git: SimpleGit = simpleGit(repoPath);
			const branches = await git.branchLocal();
			return branches.all;
		} catch (error) {
			const err = error as Error & { code?: string };
			let errorMessage = `Failed to get branches: ${err.message}`;

			if (err.code === 'ENOENT') {
				errorMessage +=
					'\n\nTroubleshooting steps:\n' +
					'1. Ensure Git is installed and accessible in PATH\n' +
					'2. Try running "git --version" in terminal\n' +
					'3. Restart the application after installing Git';
			} else if (err.message.includes('not a git repository')) {
				errorMessage +=
					'\n\nTroubleshooting steps:\n' +
					'1. Select a folder that contains a .git directory\n' +
					'2. Initialize a Git repository with "git init" if needed\n' +
					'3. Ensure the selected path is the repository root';
			} else if (err.message.includes('dubious ownership')) {
				errorMessage +=
					'\n\nDubious ownership detected (common with mounted drives):\n' +
					'1. This repository is on a mounted drive or network share\n' +
					'2. Git blocks access for security reasons\n' +
					'3. Run this command to fix it:\n' +
					`   git config --global --add safe.directory "${repoPath}"`;
			} else if (
				err.message.includes('permission') ||
				err.message.includes('access')
			) {
				errorMessage +=
					'\n\nTroubleshooting steps:\n' +
					'1. Check folder permissions and user access rights\n' +
					'2. Try running the application as administrator\n' +
					'3. Ensure the repository is not locked by another process';
			}

			throw new Error(errorMessage);
		}
	}
);

ipcMain.handle(
	'get-git-diff',
	async (
		_event: IpcMainInvokeEvent,
		repoPath: string,
		baseBranch: string,
		targetBranch: string
	): Promise<string> => {
		try {
			const git: SimpleGit = simpleGit(repoPath);

			// Check if a branch exists locally
			const branchExists = async (branchName: string): Promise<boolean> => {
				try {
					await git.revparse(['--verify', branchName]);
					return true;
				} catch {
					return false;
				}
			};

			// Strip 'remotes/' prefix and get local branch name if remote branch is provided
			const normalizeBranchName = (branchName: string): string => {
				if (branchName.startsWith('remotes/origin/')) {
					return branchName.replace('remotes/origin/', '');
				}
				if (branchName.startsWith('remotes/')) {
					return branchName.replace(/^remotes\/[^/]+\//, '');
				}
				return branchName;
			};

			// Prefer local branch, fallback to remote if local doesn't exist
			const resolvedBaseBranch = (await branchExists(
				normalizeBranchName(baseBranch)
			))
				? normalizeBranchName(baseBranch)
				: baseBranch;

			const resolvedTargetBranch = (await branchExists(
				normalizeBranchName(targetBranch)
			))
				? normalizeBranchName(targetBranch)
				: targetBranch;

			// Get merge base
			const mergeBase = await git.raw([
				'merge-base',
				resolvedBaseBranch,
				resolvedTargetBranch,
			]);
			const mergeBaseCommit = mergeBase.trim();

			// Get diff from merge base to target
			const diff = await git.raw([
				'diff',
				'--no-prefix',
				'-U3',
				mergeBaseCommit,
				resolvedTargetBranch,
			]);
			return diff;
		} catch (error) {
			const err = error as Error & { code?: string };
			let errorMessage = `Failed to get diff: ${err.message}`;

			if (
				err.message.includes('unknown revision') ||
				err.message.includes('bad revision')
			) {
				errorMessage +=
					'\n\nTroubleshooting steps:\n' +
					'1. Verify both branches exist locally\n' +
					'2. Run "git branch -a" to see all available branches\n' +
					'3. Pull latest changes with "git fetch" if branches are remote\n' +
					'4. Check branch names for typos or special characters';
			} else if (
				err.message.includes('merge-base') ||
				err.message.includes('no common commits')
			) {
				errorMessage +=
					'\n\nTroubleshooting steps:\n' +
					'1. Check if branches share common history\n' +
					'2. Try comparing with a different base branch\n' +
					'3. Ensure branches are not from completely separate repositories';
			} else if (err.code === 'ENOENT') {
				errorMessage +=
					'\n\nTroubleshooting steps:\n' +
					'1. Ensure Git is installed and accessible in PATH\n' +
					'2. Verify the repository path is correct\n' +
					'3. Check if the .git directory exists';
			}

			throw new Error(errorMessage);
		}
	}
);

// IPC handlers for Ollama API
interface OllamaConfig {
	url: string;
	model: string;
	prompt: string;
}

interface ProgressData {
	stage: string;
	progress: number;
	message: string;
	timestamp: number;
	[key: string]: unknown;
}

ipcMain.handle(
	'call-ollama-api',
	async (event: IpcMainInvokeEvent, { url, model, prompt }: OllamaConfig): Promise<string> => {
		try {
			// Send initial progress
			event.sender.send('ollama-progress', {
				stage: 'connecting',
				progress: 45,
				message: 'Connecting to Ollama API...',
				timestamp: Date.now(),
			});

			const startTime = Date.now();
			let totalTokens = 0;
			let responseText = '';

			// Use streaming endpoint for real-time progress
			const streamUrl = url.replace('/api/generate', '/api/generate');

			// Calculate request size for data transfer tracking
			const requestData = { model: model, prompt: prompt, stream: true };
			const requestSize = JSON.stringify(requestData).length;

			// Send request started progress
			event.sender.send('ollama-progress', {
				stage: 'sending',
				progress: 50,
				message: 'Sending request to AI model...',
				timestamp: Date.now(),
				modelSize: prompt.length,
				bytesUploaded: requestSize,
				totalBytes: requestSize,
			});

			const response = await axios.post(streamUrl, requestData, {
				timeout: 120000, // 2 minutes timeout
				responseType: 'stream',
			});

			event.sender.send('ollama-progress', {
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
										const estimatedTotalTokens = Math.max(100, prompt.length / 4); // Rough estimate
										const tokenProgress = Math.min(
											25,
											(totalTokens / estimatedTotalTokens) * 25
										);
										const progress = Math.min(95, 60 + tokenProgress);

										event.sender.send('ollama-progress', {
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

									event.sender.send('ollama-progress', {
										stage: 'complete',
										progress: 100,
										message: 'AI response complete',
										timestamp: Date.now(),
										responseTime,
										tokens: actualOutputTokens || totalTokens,
										tokensPerSecond:
											(actualOutputTokens || totalTokens) / (responseTime / 1000),
										bytesReceived: bytesReceived,
										streamingContent: responseText,
										isStreaming: false,
										actualInputTokens: actualInputTokens,
										actualOutputTokens: actualOutputTokens,
										totalActualTokens:
											(actualInputTokens || 0) + (actualOutputTokens || 0),
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
					event.sender.send('ollama-progress', {
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
			event.sender.send('ollama-progress', {
				stage: 'error',
				progress: 0,
				message: `Error: ${err.message}`,
				timestamp: Date.now(),
				error: err.message,
			});

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

			throw new Error(errorMessage);
		}
	}
);

// IPC handlers for Azure AI API
interface AzureAIConfig {
	endpoint: string;
	apiKey: string;
	deploymentName: string;
	prompt: string;
}

ipcMain.handle(
	'call-azure-ai-api',
	async (
		event: IpcMainInvokeEvent,
		{ endpoint, apiKey, deploymentName, prompt }: AzureAIConfig
	): Promise<string> => {
		try {
			// Send initial progress
			event.sender.send('azure-ai-progress', {
				stage: 'connecting',
				progress: 45,
				message: 'Connecting to Azure AI service...',
				timestamp: Date.now(),
			});

			const startTime = Date.now();
			let totalTokens = 0;

			// Send request started progress
			event.sender.send('azure-ai-progress', {
				stage: 'sending',
				progress: 50,
				message: 'Sending request to Azure AI model...',
				timestamp: Date.now(),
				modelSize: prompt.length,
			});

			// Create Azure OpenAI client using the stable OpenAI SDK
			// Extract base URL from the full endpoint if it contains the full path
			let baseURL = endpoint;
			if (endpoint.includes('/openai/deployments/')) {
				// Extract just the base URL (e.g., https://resource.cognitiveservices.azure.com)
				baseURL = endpoint.split('/openai/deployments/')[0];
			}

			const client = new OpenAI({
				apiKey: apiKey,
				baseURL: `${baseURL}/openai/deployments/${deploymentName}`,
				defaultQuery: { 'api-version': '2025-01-01-preview' },
				defaultHeaders: {
					'api-key': apiKey,
				},
			});

			event.sender.send('azure-ai-progress', {
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

						event.sender.send('azure-ai-progress', {
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

			event.sender.send('azure-ai-progress', {
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
			event.sender.send('azure-ai-progress', {
				stage: 'error',
				progress: 0,
				message: `Error: ${err.message}`,
				timestamp: Date.now(),
				error: err.message,
			});

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

			throw new Error(errorMessage);
		}
	}
);

ipcMain.handle(
	'test-azure-ai-connection',
	async (
		_event: IpcMainInvokeEvent,
		{ endpoint, apiKey, deploymentName }: Omit<AzureAIConfig, 'prompt'>
	): Promise<{
		success: boolean;
		error?: string;
		deploymentName?: string;
		modelResponse?: string;
	}> => {
		try {
			// Create Azure OpenAI client using the stable OpenAI SDK
			// Extract base URL from the full endpoint if it contains the full path
			let baseURL = endpoint;
			if (endpoint.includes('/openai/deployments/')) {
				// Extract just the base URL (e.g., https://resource.cognitiveservices.azure.com)
				baseURL = endpoint.split('/openai/deployments/')[0];
			}

			const client = new OpenAI({
				apiKey: apiKey,
				baseURL: `${baseURL}/openai/deployments/${deploymentName}`,
				defaultQuery: { 'api-version': '2025-01-01-preview' },
				defaultHeaders: {
					'api-key': apiKey,
				},
			});

			// Test with a simple request
			const testResponse = await client.chat.completions.create({
				model: deploymentName,
				messages: [
					{
						role: 'user',
						content:
							'What is a function in programming? Please respond with one sentence.',
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
);

ipcMain.handle(
	'test-ollama-connection',
	async (
		_event: IpcMainInvokeEvent,
		{ url, model }: Omit<OllamaConfig, 'prompt'>
	): Promise<{
		success: boolean;
		error?: string;
		version?: string;
		modelResponse?: string;
	}> => {
		try {
			// Test server connection
			const versionUrl = url.replace('/api/generate', '/api/version');
			const versionResponse = await axios.get(versionUrl, { timeout: 5000 });

			// Test model availability with a simple coding question
			const testResponse = await axios.post<{ response?: string }>(
				url,
				{
					model: model,
					prompt:
						'What is a function in programming? Please respond with one sentence.',
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
			return {
				success: false,
				error: (error as Error).message,
			};
		}
	}
);

app.whenReady().then(() => {
	// Remove the application menu
	Menu.setApplicationMenu(null);

	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	// Unregister all global shortcuts
	try {
		globalShortcut.unregisterAll();
		console.log('Global shortcuts unregistered');
	} catch (error) {
		console.log('Error unregistering shortcuts:', (error as Error).message);
	}

	if (process.platform !== 'darwin') {
		app.quit();
	}
});
