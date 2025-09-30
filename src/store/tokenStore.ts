import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TokenState {
	// Persistent totals across sessions
	totalInputTokens: number;
	totalOutputTokens: number;

	// Current session tokens (reset on each review)
	currentSessionInputTokens: number;
	currentSessionOutputTokens: number;

	// Estimated tokens for current diff
	estimatedInputTokens: number;

	// Actions
	setTotalInputTokens: (tokens: number) => void;
	setTotalOutputTokens: (tokens: number) => void;
	addToTotalInputTokens: (tokens: number) => void;
	addToTotalOutputTokens: (tokens: number) => void;
	setCurrentSessionInputTokens: (tokens: number) => void;
	setCurrentSessionOutputTokens: (tokens: number) => void;
	setEstimatedInputTokens: (tokens: number) => void;
	resetCurrentSession: () => void;

	// Computed values
	getLiveInputTokens: () => number;
	getLiveOutputTokens: () => number;
}

export const useTokenStore = create<TokenState>()(
	persist(
		(set, get) => ({
			// Initial state
			totalInputTokens: 0,
			totalOutputTokens: 0,
			currentSessionInputTokens: 0,
			currentSessionOutputTokens: 0,
			estimatedInputTokens: 0,

			// Actions
			setTotalInputTokens: (tokens) => set({ totalInputTokens: tokens }),
			setTotalOutputTokens: (tokens) => set({ totalOutputTokens: tokens }),

			addToTotalInputTokens: (tokens) =>
				set((state) => ({
					totalInputTokens: state.totalInputTokens + tokens,
				})),

			addToTotalOutputTokens: (tokens) =>
				set((state) => ({
					totalOutputTokens: state.totalOutputTokens + tokens,
				})),

			setCurrentSessionInputTokens: (tokens) =>
				set({ currentSessionInputTokens: tokens }),

			setCurrentSessionOutputTokens: (tokens) =>
				set({ currentSessionOutputTokens: tokens }),

			setEstimatedInputTokens: (tokens) =>
				set({ estimatedInputTokens: tokens }),

			resetCurrentSession: () =>
				set({
					currentSessionInputTokens: 0,
					currentSessionOutputTokens: 0,
				}),

			// Computed values
			getLiveInputTokens: () => {
				const state = get();
				return state.totalInputTokens + state.currentSessionInputTokens;
			},

			getLiveOutputTokens: () => {
				const state = get();
				return state.totalOutputTokens + state.currentSessionOutputTokens;
			},
		}),
		{
			name: 'token-storage', // localStorage key
			partialize: (state) => ({
				// Only persist totals, not current session or estimated tokens
				totalInputTokens: state.totalInputTokens,
				totalOutputTokens: state.totalOutputTokens,
			}),
		}
	)
);
