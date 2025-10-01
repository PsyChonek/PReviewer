import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AIProviderConfig } from '../types';
import { getDefaultPrompts } from '../utils/config';

interface ConfigState {
	// AI Configuration
	aiConfig: AIProviderConfig;
	setAiConfig: (config: AIProviderConfig) => void;

	// Prompts
	basePrompt: string;
	setBasePrompt: (prompt: string) => void;
	userPrompt: string;
	setUserPrompt: (prompt: string) => void;

	// Debug mode
	debugMode: boolean;
	setDebugMode: (debug: boolean) => void;

	// Chunking settings
	maxTokensPerChunk: number;
	setMaxTokensPerChunk: (tokens: number) => void;
	enableAutoChunking: boolean;
	setEnableAutoChunking: (enabled: boolean) => void;

	// Bulk operations
	updateConfig: (config: { aiConfig?: AIProviderConfig; basePrompt?: string; userPrompt?: string; debugMode?: boolean; maxTokensPerChunk?: number; enableAutoChunking?: boolean }) => void;

	resetPrompts: () => void;
}

const DEFAULT_AI_CONFIG: AIProviderConfig = {
	provider: 'ollama',
	ollama: {
		url: 'http://localhost:11434/api/generate',
		model: 'codellama',
	},
	azure: {
		endpoint: '',
		apiKey: '',
		deployment: '',
	},
};

export const useConfigStore = create<ConfigState>()(
	persist(
		(set, _get) => ({
			// Initial state
			aiConfig: DEFAULT_AI_CONFIG,
			basePrompt: getDefaultPrompts().basePrompt,
			userPrompt: getDefaultPrompts().userPrompt,
			debugMode: false,
			maxTokensPerChunk: 80000, // Default: 80k tokens per chunk
			enableAutoChunking: true, // Auto-chunk by default for Azure

			// AI Config actions
			setAiConfig: (config) => set({ aiConfig: config }),

			// Prompt actions
			setBasePrompt: (prompt) => set({ basePrompt: prompt }),
			setUserPrompt: (prompt) => set({ userPrompt: prompt }),

			// Debug actions
			setDebugMode: (debug) => set({ debugMode: debug }),

			// Chunking actions
			setMaxTokensPerChunk: (tokens) => set({ maxTokensPerChunk: tokens }),
			setEnableAutoChunking: (enabled) => set({ enableAutoChunking: enabled }),

			// Bulk update
			updateConfig: (config) =>
				set((state) => ({
					...state,
					...config,
				})),

			// Reset prompts to default
			resetPrompts: () => {
				const defaults = getDefaultPrompts();
				set({
					basePrompt: defaults.basePrompt,
					userPrompt: defaults.userPrompt,
				});
			},
		}),
		{
			name: 'previewr-config', // localStorage key
			partialize: (state) => ({
				aiConfig: state.aiConfig,
				basePrompt: state.basePrompt,
				userPrompt: state.userPrompt,
				debugMode: state.debugMode,
				maxTokensPerChunk: state.maxTokensPerChunk,
				enableAutoChunking: state.enableAutoChunking,
			}),
		}
	)
);
