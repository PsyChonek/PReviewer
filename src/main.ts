import { app, BrowserWindow, ipcMain, dialog, Menu, IpcMainInvokeEvent, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import simpleGit, { SimpleGit } from 'simple-git';
import { OllamaProvider, OllamaConfig } from './providers/OllamaProvider';
import { AzureOpenAIProvider, AzureOpenAIConfig } from './providers/AzureOpenAIProvider';

// Handle Squirrel events on Windows
if (process.platform === 'win32') {
	const squirrelCommand = process.argv[1];

	const handleSquirrelEvent = (): boolean => {
		if (squirrelCommand === '--squirrel-install' || squirrelCommand === '--squirrel-updated') {
			// Create desktop and start menu shortcuts
			const updateDotExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
			const exeName = path.basename(process.execPath);

			// Create shortcuts
			spawn(updateDotExe, ['--createShortcut', exeName], {
				detached: true,
			});

			app.quit();
			return true;
		}

		if (squirrelCommand === '--squirrel-uninstall') {
			// Remove shortcuts
			const updateDotExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
			const exeName = path.basename(process.execPath);

			spawn(updateDotExe, ['--removeShortcut', exeName], {
				detached: true,
			});

			app.quit();
			return true;
		}

		if (squirrelCommand === '--squirrel-obsolete') {
			app.quit();
			return true;
		}

		return false;
	};

	if (handleSquirrelEvent()) {
		// Squirrel event handled, app will quit
	}
}

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
		const rendererPath = path.join(process.resourcesPath, '.vite', 'renderer', 'index.html');
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
	mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
		console.error('Page failed to load:', errorCode, errorDescription, validatedURL);
	});

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
				basePrompt: 'You are an expert code reviewer. Analyze the following code changes and provide feedback.',
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

ipcMain.handle('save-config', async (_event: IpcMainInvokeEvent, config: Config): Promise<{ success: boolean; error?: string }> => {
	try {
		await saveUserConfig(config);
		return { success: true };
	} catch (error) {
		console.error('Failed to save config:', error);
		return { success: false, error: (error as Error).message };
	}
});

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
					output[sourceKey] = mergeDeep(target[sourceKey] as Config, source[sourceKey] as Config) as (typeof output)[typeof sourceKey];
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

ipcMain.handle('git-fetch', async (_event: IpcMainInvokeEvent, repoPath: string): Promise<GitOperationResult> => {
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
});

ipcMain.handle('git-pull', async (_event: IpcMainInvokeEvent, repoPath: string): Promise<GitOperationResult> => {
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
});

ipcMain.handle('get-git-branches', async (_event: IpcMainInvokeEvent, repoPath: string): Promise<string[]> => {
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
		} else if (err.message.includes('permission') || err.message.includes('access')) {
			errorMessage +=
				'\n\nTroubleshooting steps:\n' +
				'1. Check folder permissions and user access rights\n' +
				'2. Try running the application as administrator\n' +
				'3. Ensure the repository is not locked by another process';
		}

		throw new Error(errorMessage);
	}
});

ipcMain.handle('get-git-diff', async (_event: IpcMainInvokeEvent, repoPath: string, baseBranch: string, targetBranch: string): Promise<string> => {
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
		const resolvedBaseBranch = (await branchExists(normalizeBranchName(baseBranch))) ? normalizeBranchName(baseBranch) : baseBranch;

		const resolvedTargetBranch = (await branchExists(normalizeBranchName(targetBranch))) ? normalizeBranchName(targetBranch) : targetBranch;

		// Get merge base between the two branches
		await git.raw(['merge-base', resolvedTargetBranch, resolvedBaseBranch]);

		// Get diff from target (main) to base (feature) - shows what changes are in feature branch
		// This is equivalent to: git diff target...base
		const diff = await git.raw(['diff', '--no-prefix', '-U3', resolvedTargetBranch, resolvedBaseBranch]);
		return diff;
	} catch (error) {
		const err = error as Error & { code?: string };
		let errorMessage = `Failed to get diff: ${err.message}`;

		if (err.message.includes('unknown revision') || err.message.includes('bad revision')) {
			errorMessage +=
				'\n\nTroubleshooting steps:\n' +
				'1. Verify both branches exist locally\n' +
				'2. Run "git branch -a" to see all available branches\n' +
				'3. Pull latest changes with "git fetch" if branches are remote\n' +
				'4. Check branch names for typos or special characters';
		} else if (err.message.includes('merge-base') || err.message.includes('no common commits')) {
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
});

// Initialize AI providers
const ollamaProvider = new OllamaProvider();
const azureProvider = new AzureOpenAIProvider();

// Import token utilities
import { buildPrompt } from './utils/prompts';
import { countTokens } from './utils/tokenEstimation';
import { needsChunking, DEFAULT_CHUNK_CONFIG, ChunkConfig } from './utils/diffChunker';
import { scanWorktree, scanSpecificFiles } from './utils/fileScanner';
import { WorktreeInfo, ScannedFile, ScanOptions } from './types';
import os from 'os';

// IPC handler for calculating tokens with chunking info
ipcMain.handle(
	'calculate-tokens-with-chunking',
	async (
		_event: IpcMainInvokeEvent,
		diff: string,
		basePrompt: string,
		userPrompt: string,
		provider: 'ollama' | 'azure',
		chunkConfig?: Partial<ChunkConfig>
	): Promise<{
		estimatedTokens: number;
		willChunk: boolean;
		chunkCount: number;
	}> => {
		const fullPrompt = buildPrompt(diff, basePrompt, userPrompt);
		const estimatedTokens = countTokens(fullPrompt, 'cl100k_base');

		// Only calculate chunking for Azure
		if (provider === 'azure') {
			// Calculate base prompt tokens (same logic as generateWithChunking)
			const basePromptOnly = buildPrompt('', basePrompt, userPrompt);
			const basePromptTokens = countTokens(basePromptOnly, 'cl100k_base');

			// Calculate chunk context overhead
			const estimatedChunkContextTokens = 100;

			// Configure chunking the same way as the actual generation
			// Each chunk should be AT the rate limit
			const rateLimitTokens = chunkConfig?.maxTokensPerChunk || DEFAULT_CHUNK_CONFIG.maxTokensPerChunk;
			const maxDiffTokensPerChunk = rateLimitTokens - basePromptTokens - estimatedChunkContextTokens;

			console.log('[Chunking Calculation]', {
				rateLimitTokens,
				basePromptTokens,
				estimatedChunkContextTokens,
				maxDiffTokensPerChunk,
				diffTokens: countTokens(diff, 'cl100k_base'),
			});

			const config: ChunkConfig = {
				...DEFAULT_CHUNK_CONFIG,
				maxTokensPerChunk: maxDiffTokensPerChunk,
				systemPromptTokens: 0, // Already accounted for in maxDiffTokensPerChunk calculation
			};

			const willChunk = needsChunking(diff, config);

			if (willChunk) {
				// Simple calculation: total tokens / rate limit = number of chunks
				const chunkCount = Math.ceil(estimatedTokens / rateLimitTokens);

				console.log('[Chunking Result]', {
					estimatedTokens,
					rateLimitTokens,
					chunkCount,
				});

				return {
					estimatedTokens,
					willChunk: true,
					chunkCount,
				};
			}
		}

		return {
			estimatedTokens,
			willChunk: false,
			chunkCount: 0,
		};
	}
);

// IPC handlers for Ollama API
ipcMain.handle('call-ollama-api', async (event: IpcMainInvokeEvent, config: OllamaConfig): Promise<string> => {
	return ollamaProvider.generate(event, config);
});

// IPC handlers for Azure AI API
ipcMain.handle('call-azure-ai-api', async (event: IpcMainInvokeEvent, config: AzureOpenAIConfig): Promise<string> => {
	return azureProvider.generate(event, config);
});

// IPC handler for Azure AI with automatic chunking
ipcMain.handle('call-azure-ai-api-chunked', async (event: IpcMainInvokeEvent, config: AzureOpenAIConfig & { diff: string }): Promise<string> => {
	const { diff, ...azureConfig } = config;
	return azureProvider.generateWithChunking(event, azureConfig, diff);
});

ipcMain.handle(
	'test-azure-ai-connection',
	async (
		_event: IpcMainInvokeEvent,
		config: Omit<AzureOpenAIConfig, 'prompt'>
	): Promise<{
		success: boolean;
		error?: string;
		deploymentName?: string;
		modelResponse?: string;
	}> => {
		return azureProvider.testConnection(config);
	}
);

ipcMain.handle(
	'test-ollama-connection',
	async (
		_event: IpcMainInvokeEvent,
		config: Omit<OllamaConfig, 'prompt'>
	): Promise<{
		success: boolean;
		error?: string;
		version?: string;
		modelResponse?: string;
	}> => {
		return ollamaProvider.testConnection(config);
	}
);

// Store for tracking active worktrees (cleanup on app close)
const activeWorktrees = new Set<string>();

// IPC handlers for Git Worktree operations
ipcMain.handle('create-worktree', async (_event: IpcMainInvokeEvent, repoPath: string, branch: string): Promise<WorktreeInfo> => {
	try {
		const git: SimpleGit = simpleGit(repoPath);

		// Create unique temporary directory for worktree
		const timestamp = Date.now();
		const worktreePath = path.join(os.tmpdir(), `previewer-wt-${timestamp}`);

		console.log('Creating worktree:', { repoPath, branch, worktreePath });

		// Create the worktree
		await git.raw(['worktree', 'add', worktreePath, branch]);

		// Track this worktree for cleanup
		activeWorktrees.add(worktreePath);

		const worktreeInfo: WorktreeInfo = {
			path: worktreePath,
			branch,
			createdAt: timestamp,
		};

		console.log('Worktree created successfully:', worktreeInfo);

		return worktreeInfo;
	} catch (error) {
		const err = error as Error;
		let errorMessage = `Failed to create worktree: ${err.message}`;

		if (err.message.includes('already exists')) {
			errorMessage += '\n\nThe worktree directory already exists. Try deleting it first.';
		} else if (err.message.includes('not found') || err.message.includes('unknown revision')) {
			errorMessage += '\n\nThe branch does not exist. Make sure to fetch the latest changes.';
		} else if (err.message.includes('already checked out')) {
			errorMessage += '\n\nThis branch is already checked out in another worktree.';
		}

		throw new Error(errorMessage);
	}
});

ipcMain.handle('delete-worktree', async (_event: IpcMainInvokeEvent, worktreePath: string): Promise<{ success: boolean; error?: string }> => {
	try {
		// Find the main repository path by checking the worktree's git directory
		const gitDirPath = path.join(worktreePath, '.git');
		const gitDirContent = await fs.readFile(gitDirPath, 'utf8');

		// Extract main repo path from .git file (format: "gitdir: /path/to/main/.git/worktrees/name")
		const match = gitDirContent.match(/gitdir: (.+)$/m);
		if (!match) {
			throw new Error('Could not determine main repository path');
		}

		// Get the main .git directory (remove /worktrees/name part)
		const mainGitDir = match[1].split('/worktrees/')[0];
		const repoPath = path.dirname(mainGitDir);

		const git: SimpleGit = simpleGit(repoPath);

		console.log('Deleting worktree:', worktreePath);

		// Remove the worktree
		await git.raw(['worktree', 'remove', worktreePath, '--force']);

		// Remove from tracking set
		activeWorktrees.delete(worktreePath);

		console.log('Worktree deleted successfully');

		return { success: true };
	} catch (error) {
		const err = error as Error;
		console.error('Failed to delete worktree:', err);

		// Try to clean up the directory even if git command failed
		try {
			await fs.rm(worktreePath, { recursive: true, force: true });
			activeWorktrees.delete(worktreePath);
			return { success: true };
		} catch {
			return {
				success: false,
				error: `Failed to delete worktree: ${err.message}`,
			};
		}
	}
});

ipcMain.handle('list-worktrees', async (_event: IpcMainInvokeEvent, repoPath: string): Promise<WorktreeInfo[]> => {
	try {
		const git: SimpleGit = simpleGit(repoPath);

		// Get worktree list in porcelain format
		const result = await git.raw(['worktree', 'list', '--porcelain']);

		const worktrees: WorktreeInfo[] = [];
		const lines = result.trim().split('\n');

		let currentWorktree: Partial<WorktreeInfo> = {};

		for (const line of lines) {
			if (line.startsWith('worktree ')) {
				const worktreePath = line.substring('worktree '.length);
				currentWorktree.path = worktreePath;
			} else if (line.startsWith('branch ')) {
				const branch = line.substring('branch '.length).replace('refs/heads/', '');
				currentWorktree.branch = branch;
			} else if (line === '') {
				// Empty line marks end of a worktree entry
				if (currentWorktree.path && currentWorktree.branch) {
					// Only include non-main worktrees (temporary ones in /tmp)
					if (currentWorktree.path.includes(os.tmpdir())) {
						worktrees.push({
							path: currentWorktree.path,
							branch: currentWorktree.branch,
							createdAt: 0, // We don't have this info from git
						});
					}
				}
				currentWorktree = {};
			}
		}

		return worktrees;
	} catch (error) {
		console.error('Failed to list worktrees:', error);
		return [];
	}
});

ipcMain.handle('scan-worktree-files', async (_event: IpcMainInvokeEvent, worktreePath: string, options?: ScanOptions): Promise<ScannedFile[]> => {
	try {
		console.log('Scanning worktree files:', worktreePath);
		const files = await scanWorktree(worktreePath, options);
		console.log(`Found ${files.length} files in worktree`);
		return files;
	} catch (error) {
		const err = error as Error;
		console.error('Failed to scan worktree files:', err);
		throw new Error(`Failed to scan worktree files: ${err.message}`);
	}
});

// Get list of changed files between branches (file names only, not full diff)
ipcMain.handle('get-changed-files', async (_event: IpcMainInvokeEvent, repoPath: string, baseBranch: string, targetBranch: string): Promise<string[]> => {
	try {
		const git: SimpleGit = simpleGit(repoPath);

		// Normalize branch names (same logic as get-git-diff)
		const normalizeBranchName = (branchName: string): string => {
			if (branchName.startsWith('remotes/origin/')) {
				return branchName.replace('remotes/origin/', '');
			}
			if (branchName.startsWith('remotes/')) {
				return branchName.replace(/^remotes\/[^/]+\//, '');
			}
			return branchName;
		};

		const branchExists = async (branchName: string): Promise<boolean> => {
			try {
				await git.revparse(['--verify', branchName]);
				return true;
			} catch {
				return false;
			}
		};

		const resolvedBaseBranch = (await branchExists(normalizeBranchName(baseBranch))) ? normalizeBranchName(baseBranch) : baseBranch;
		const resolvedTargetBranch = (await branchExists(normalizeBranchName(targetBranch))) ? normalizeBranchName(targetBranch) : targetBranch;

		// Get list of changed files (--name-only shows just file paths)
		const result = await git.raw(['diff', '--name-only', resolvedTargetBranch, resolvedBaseBranch]);

		// Split by newlines and filter out empty lines
		const changedFiles = result
			.split('\n')
			.map((file) => file.trim())
			.filter((file) => file.length > 0);

		console.log(`Found ${changedFiles.length} changed files between ${resolvedTargetBranch} and ${resolvedBaseBranch}`);

		return changedFiles;
	} catch (error) {
		const err = error as Error;
		console.error('Failed to get changed files:', err);
		throw new Error(`Failed to get changed files: ${err.message}`);
	}
});

// Scan specific files in worktree (optimized for changed files only)
ipcMain.handle('scan-changed-files', async (_event: IpcMainInvokeEvent, worktreePath: string, changedFiles: string[]): Promise<ScannedFile[]> => {
	try {
		console.log(`Scanning ${changedFiles.length} changed files in worktree:`, worktreePath);
		const files = await scanSpecificFiles(worktreePath, changedFiles);
		console.log(`Successfully scanned ${files.length} files`);
		return files;
	} catch (error) {
		const err = error as Error;
		console.error('Failed to scan changed files:', err);
		throw new Error(`Failed to scan changed files: ${err.message}`);
	}
});

// Get uncommitted changes (working directory changes)
ipcMain.handle('get-uncommitted-changes', async (_event: IpcMainInvokeEvent, repoPath: string): Promise<string[]> => {
	try {
		const git: SimpleGit = simpleGit(repoPath);

		// Get both staged and unstaged changes
		const result = await git.raw(['diff', '--name-only', 'HEAD']);

		// Split by newlines and filter out empty lines
		const changedFiles = result
			.split('\n')
			.map((file) => file.trim())
			.filter((file) => file.length > 0);

		console.log(`Found ${changedFiles.length} uncommitted changed files`);

		return changedFiles;
	} catch (error) {
		const err = error as Error;
		console.error('Failed to get uncommitted changes:', err);
		throw new Error(`Failed to get uncommitted changes: ${err.message}`);
	}
});

// Scan uncommitted files directly from the working directory
ipcMain.handle('scan-uncommitted-files', async (_event: IpcMainInvokeEvent, repoPath: string, changedFiles: string[]): Promise<ScannedFile[]> => {
	try {
		console.log(`Scanning ${changedFiles.length} uncommitted files in:`, repoPath);
		const files = await scanSpecificFiles(repoPath, changedFiles);
		console.log(`Successfully scanned ${files.length} uncommitted files`);
		return files;
	} catch (error) {
		const err = error as Error;
		console.error('Failed to scan uncommitted files:', err);
		throw new Error(`Failed to scan uncommitted files: ${err.message}`);
	}
});

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

// Clean up worktrees before app quits
async function cleanupWorktrees(): Promise<void> {
	console.log('Cleaning up active worktrees...');
	for (const worktreePath of activeWorktrees) {
		try {
			console.log('Cleaning up worktree:', worktreePath);
			// Try to remove via git first
			const gitDirPath = path.join(worktreePath, '.git');
			const gitDirContent = await fs.readFile(gitDirPath, 'utf8');
			const match = gitDirContent.match(/gitdir: (.+)$/m);

			if (match) {
				const mainGitDir = match[1].split('/worktrees/')[0];
				const repoPath = path.dirname(mainGitDir);
				const git: SimpleGit = simpleGit(repoPath);
				await git.raw(['worktree', 'remove', worktreePath, '--force']);
			}
		} catch (error) {
			console.error('Error cleaning up worktree via git:', error);
			// Fallback to direct deletion
			try {
				await fs.rm(worktreePath, { recursive: true, force: true });
			} catch (rmError) {
				console.error('Error removing worktree directory:', rmError);
			}
		}
	}
	activeWorktrees.clear();
	console.log('Worktree cleanup complete');
}

app.on('before-quit', async (event) => {
	if (activeWorktrees.size > 0) {
		event.preventDefault();
		await cleanupWorktrees();
		app.quit();
	}
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
