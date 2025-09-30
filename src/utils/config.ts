import { AIProviderConfig } from '../types';

export interface AppConfig {
	app: {
		name: string;
		version: string;
		description: string;
	};
	defaults: {
		aiProvider: AIProviderConfig;
		debugMode: boolean;
	};
	prompts: {
		basePrompt: string;
		userPrompt: string;
	};
	ui: {
		window: {
			width: number;
			height: number;
			minWidth: number;
			minHeight: number;
		};
		devServer: {
			url: string;
			port: number;
		};
	};
	git: {
		diffOptions: {
			context: number;
			noPrefix: boolean;
		};
	};
	tokenEstimation: {
		charsPerToken: {
			diff: number;
			code: number;
			naturalText: number;
			mixed: number;
		};
		wordTokenMultiplier: number;
	};
	shortcuts: {
		devTools: string;
		reload: string[];
	};
}

let configCache: AppConfig | null = null;

export function getDefaultConfig(): AppConfig {
	return {
		app: {
			name: 'PReviewer',
			version: '1.0.0',
			description: 'AI-powered Git repository change reviewer',
		},
		defaults: {
			aiProvider: {
				provider: 'ollama',
				ollama: {
					url: 'http://localhost:11434',
					model: 'llama3.2:3b',
				},
				azure: {
					endpoint: '',
					apiKey: '',
					deployment: '',
				},
			},
			debugMode: false,
		},
		prompts: {
			basePrompt: `You are an expert code reviewer. Analyze the following code changes (diff format).
Identify potential bugs, security vulnerabilities, performance issues, and suggest improvements
based on best practices. Focus on the *newly added or modified lines*.
Provide concise, actionable feedback. If no issues, state 'No major issues found.'.

Consider the context of a C# and SQL development environment.

**IMPORTANT: Format your response using Markdown with the following structure:**
- Use ## for main sections (e.g., ## Summary, ## Issues Found, ## Recommendations)
- Use ### for subsections
- Use **bold** for important points
- Use \`code\` for inline code references
- Use \`\`\`language blocks for code examples
- Use bullet points (-) for lists
- Use > for important warnings or notes
- Include line numbers when referencing specific changes

Example format:
## Summary
Brief overview of the changes reviewed.

## Issues Found
### 🚨 Critical Issues
- **Security vulnerability on line 42**: Description
### ⚠️ Potential Issues
- **Performance concern on line 18**: Description

## Recommendations
- Suggestion 1
- Suggestion 2`,
			userPrompt: '',
		},
		ui: {
			window: {
				width: 1200,
				height: 800,
				minWidth: 800,
				minHeight: 600,
			},
			devServer: {
				url: 'http://localhost:3002',
				port: 3002,
			},
		},
		git: {
			diffOptions: {
				context: 3,
				noPrefix: true,
			},
		},
		tokenEstimation: {
			charsPerToken: {
				diff: 3.8,
				code: 4.2,
				naturalText: 4.8,
				mixed: 4.3,
			},
			wordTokenMultiplier: 1.33,
		},
		shortcuts: {
			devTools: 'F12',
			reload: ['F5', 'CommandOrControl+R'],
		},
	};
}

export async function loadConfig(): Promise<AppConfig> {
	if (configCache) {
		return configCache;
	}

	let defaultConfig = getDefaultConfig();

	try {
		// In the renderer process, request config from main process
		if (typeof window !== 'undefined' && window.electronAPI) {
			let loadedConfig = await window.electronAPI.loadConfig();
			let mergedConfig = { ...defaultConfig, ...loadedConfig };
			configCache = mergedConfig;
			return mergedConfig;
		}

		// Fallback to default config if no electronAPI
		configCache = defaultConfig;
		return configCache;
	} catch (error) {
		console.warn('Failed to load config, using defaults:', error);
		configCache = defaultConfig;
		return configCache;
	}
}

export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
	try {
		if (typeof window !== 'undefined' && window.electronAPI) {
			// Extract only the AI provider config to save
			const aiProviderConfig: Partial<AIProviderConfig> =
				config.defaults?.aiProvider || {};
			await window.electronAPI.saveConfig(aiProviderConfig);
			// Update cache with merged config
			configCache = { ...getDefaultConfig(), ...config };
		}
	} catch (error) {
		console.error('Failed to save config:', error);
		throw error;
	}
}

export function getConfig(): AppConfig {
	return configCache || getDefaultConfig();
}

// Specific getters for commonly used values
export function getBasePrompt(): string {
	let config = getConfig();
	return config.prompts.basePrompt;
}

export function getDefaultAIConfig(): AIProviderConfig {
	let config = getConfig();
	return config.defaults.aiProvider;
}

export function getTokenEstimationConfig() {
	let config = getConfig();
	return config.tokenEstimation;
}

export function getDefaultPrompts() {
	let defaultConfig = getDefaultConfig();
	return {
		basePrompt: defaultConfig.prompts.basePrompt,
		userPrompt: defaultConfig.prompts.userPrompt,
	};
}
