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

	// Bulk operations
	updateConfig: (config: { aiConfig?: AIProviderConfig; basePrompt?: string; userPrompt?: string; debugMode?: boolean }) => void;

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

			// AI Config actions
			setAiConfig: (config) => set({ aiConfig: config }),

			// Prompt actions
			setBasePrompt: (prompt) => set({ basePrompt: prompt }),
			setUserPrompt: (prompt) => set({ userPrompt: prompt }),

			// Debug actions
			setDebugMode: (debug) => set({ debugMode: debug }),

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
			}),
		}
	)
);
