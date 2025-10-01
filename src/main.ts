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
import { OllamaProvider, OllamaConfig } from './providers/OllamaProvider';
import {
	AzureOpenAIProvider,
	AzureOpenAIConfig,
} from './providers/AzureOpenAIProvider';

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
					) as (typeof output)[typeof sourceKey];
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
	async (
		_event: IpcMainInvokeEvent,
		repoPath: string
	): Promise<GitOperationResult> => {
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
	async (
		_event: IpcMainInvokeEvent,
		repoPath: string
	): Promise<GitOperationResult> => {
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

			// Get merge base between the two branches
			await git.raw(['merge-base', resolvedTargetBranch, resolvedBaseBranch]);

			// Get diff from target (main) to base (feature) - shows what changes are in feature branch
			// This is equivalent to: git diff target...base
			const diff = await git.raw([
				'diff',
				'--no-prefix',
				'-U3',
				resolvedTargetBranch,
				resolvedBaseBranch,
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

// Initialize AI providers
const ollamaProvider = new OllamaProvider();
const azureProvider = new AzureOpenAIProvider();

// IPC handlers for Ollama API
ipcMain.handle(
	'call-ollama-api',
	async (event: IpcMainInvokeEvent, config: OllamaConfig): Promise<string> => {
		return ollamaProvider.generate(event, config);
	}
);

// IPC handlers for Azure AI API
ipcMain.handle(
	'call-azure-ai-api',
	async (
		event: IpcMainInvokeEvent,
		config: AzureOpenAIConfig
	): Promise<string> => {
		return azureProvider.generate(event, config);
	}
);

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
