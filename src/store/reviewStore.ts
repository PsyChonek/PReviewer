import { create } from 'zustand';

interface ReviewStats {
	tokens: number;
	inputTokens: number;
	outputTokens: number;
	tokensPerSecond: number;
	processingTime: number;
	responseTime: number;
	stage: string;
	progress: number;
}

interface ReviewState {
	// Review status
	reviewInProgress: boolean;
	reviewStartTime: number | null;
	setReviewInProgress: (inProgress: boolean) => void;
	setReviewStartTime: (time: number | null) => void;

	// Output content
	currentOutputMarkdown: string;
	setCurrentOutputMarkdown: (content: string) => void;
	clearOutput: () => void;

	// Review statistics
	reviewStats: ReviewStats | null;
	setReviewStats: (stats: ReviewStats | null) => void;

	// Connection testing
	testingConnection: boolean;
	connectionTestResult: {
		success: boolean;
		message: string;
		provider?: string;
	} | null;
	setTestingConnection: (testing: boolean) => void;
	setConnectionTestResult: (
		result: { success: boolean; message: string; provider?: string } | null
	) => void;

	// Actions
	startReview: () => void;
	stopReview: () => void;
	completeReview: (output: string) => void;
	resetReviewState: () => void;
}

export const useReviewStore = create<ReviewState>((set, _get) => ({
	// Initial state
	reviewInProgress: false,
	reviewStartTime: null,
	currentOutputMarkdown: '',
	reviewStats: null,
	testingConnection: false,
	connectionTestResult: null,

	// Review status actions
	setReviewInProgress: (inProgress) => set({ reviewInProgress: inProgress }),
	setReviewStartTime: (time) => set({ reviewStartTime: time }),

	// Output actions
	setCurrentOutputMarkdown: (content) =>
		set({ currentOutputMarkdown: content }),
	clearOutput: () => set({ currentOutputMarkdown: '' }),

	// Stats actions
	setReviewStats: (stats) => set({ reviewStats: stats }),

	// Connection testing actions
	setTestingConnection: (testing) => set({ testingConnection: testing }),
	setConnectionTestResult: (result) => set({ connectionTestResult: result }),

	// Compound actions
	startReview: () =>
		set({
			reviewInProgress: true,
			reviewStartTime: Date.now(),
			currentOutputMarkdown: '',
			reviewStats: null,
		}),

	stopReview: () =>
		set({
			reviewInProgress: false,
		}),

	completeReview: (output) =>
		set({
			reviewInProgress: false,
			currentOutputMarkdown: output,
		}),

	resetReviewState: () =>
		set({
			reviewInProgress: false,
			reviewStartTime: null,
			currentOutputMarkdown: '',
			reviewStats: null,
			testingConnection: false,
			connectionTestResult: null,
		}),
}));
