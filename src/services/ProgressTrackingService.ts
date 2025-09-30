export interface ProgressData {
	tokens: number;
	inputTokens: number;
	outputTokens: number;
	tokensPerSecond: number;
	processingTime: number;
	responseTime: number;
	stage: string;
	progress: number;
	actualInputTokens?: number;
	actualOutputTokens?: number;
	message?: string;
}

export interface ProgressSummary {
	totalInputTokens: number;
	totalOutputTokens: number;
	averageSpeed: number;
	totalTime: number;
	isComplete: boolean;
	finalStage: string;
}

export type ProgressCallback = (progress: ProgressData) => void;

export class ProgressTrackingService {
	private static instance: ProgressTrackingService;
	private callbacks: ProgressCallback[] = [];
	private currentProgress: ProgressData | null = null;
	private progressHistory: ProgressData[] = [];
	private estimatedInputTokens: number = 0;

	private constructor() {
		this.setupElectronListeners();
	}

	static getInstance(): ProgressTrackingService {
		if (!ProgressTrackingService.instance) {
			ProgressTrackingService.instance = new ProgressTrackingService();
		}
		return ProgressTrackingService.instance;
	}

	private setupElectronListeners(): void {
		// Set up Ollama progress listener
		if (window.electronAPI?.onOllamaProgress) {
			window.electronAPI.onOllamaProgress((event, data) => {
				this.handleProgressUpdate(data, 'ollama');
			});
		}

		// Set up Azure AI progress listener
		if (window.electronAPI?.onAzureAIProgress) {
			window.electronAPI.onAzureAIProgress((event, data) => {
				this.handleProgressUpdate(data, 'azure');
			});
		}
	}

	private handleProgressUpdate(
		data: Record<string, unknown>,
		provider: string
	): void {
		const progressData: ProgressData = {
			tokens: (data.tokens as number) || 0,
			inputTokens:
				(data.actualInputTokens as number) || this.estimatedInputTokens,
			outputTokens:
				(data.actualOutputTokens as number) || (data.tokens as number) || 0,
			tokensPerSecond: (data.tokensPerSecond as number) || 0,
			processingTime: (data.processingTime as number) || 0,
			responseTime: (data.responseTime as number) || 0,
			stage:
				(data.stage as string) ||
				(data.message as string) ||
				`Processing (${provider})`,
			progress: (data.progress as number) || 0,
			actualInputTokens: data.actualInputTokens as number | undefined,
			actualOutputTokens: data.actualOutputTokens as number | undefined,
			message: data.message as string | undefined,
		};

		this.currentProgress = progressData;
		this.progressHistory.push({ ...progressData });

		// Notify all callbacks
		this.callbacks.forEach((callback) => {
			try {
				callback(progressData);
			} catch (error) {
				console.error('Error in progress callback:', error);
			}
		});
	}

	onProgress(callback: ProgressCallback): () => void {
		this.callbacks.push(callback);

		// Return cleanup function
		return () => {
			const index = this.callbacks.indexOf(callback);
			if (index > -1) {
				this.callbacks.splice(index, 1);
			}
		};
	}

	setEstimatedInputTokens(tokens: number): void {
		this.estimatedInputTokens = tokens;
	}

	getCurrentProgress(): ProgressData | null {
		return this.currentProgress;
	}

	getProgressHistory(): ProgressData[] {
		return [...this.progressHistory];
	}

	getProgressSummary(): ProgressSummary | null {
		if (this.progressHistory.length === 0) {
			return null;
		}

		const latest = this.progressHistory[this.progressHistory.length - 1];
		const totalTime = Math.max(
			...this.progressHistory.map((p) => p.responseTime || p.processingTime)
		);
		const totalOutputTokens = latest.outputTokens;
		const averageSpeed =
			totalTime > 0 ? totalOutputTokens / (totalTime / 1000) : 0;

		return {
			totalInputTokens: latest.inputTokens,
			totalOutputTokens: totalOutputTokens,
			averageSpeed: averageSpeed,
			totalTime: totalTime,
			isComplete: latest.progress >= 100 || latest.stage === 'complete',
			finalStage: latest.stage,
		};
	}

	reset(): void {
		this.currentProgress = null;
		this.progressHistory = [];
		this.estimatedInputTokens = 0;
	}

	isInProgress(): boolean {
		return (
			this.currentProgress !== null &&
			this.currentProgress.progress < 100 &&
			this.currentProgress.stage !== 'complete'
		);
	}

	getEstimatedTimeRemaining(): number | null {
		if (!this.currentProgress || this.currentProgress.progress <= 0) {
			return null;
		}

		const elapsed = this.currentProgress.processingTime;
		const progressPercent = this.currentProgress.progress / 100;

		if (progressPercent <= 0) {
			return null;
		}

		const estimatedTotal = elapsed / progressPercent;
		return Math.max(0, estimatedTotal - elapsed);
	}

	getPerformanceMetrics(): {
		peakTokensPerSecond: number;
		averageTokensPerSecond: number;
		totalProcessingTime: number;
		efficiency: number;
	} | null {
		if (this.progressHistory.length === 0) {
			return null;
		}

		const speeds = this.progressHistory
			.map((p) => p.tokensPerSecond)
			.filter((speed) => speed > 0);

		if (speeds.length === 0) {
			return null;
		}

		const peakTokensPerSecond = Math.max(...speeds);
		const averageTokensPerSecond =
			speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
		const totalProcessingTime =
			this.progressHistory[this.progressHistory.length - 1]?.processingTime ||
			0;

		// Efficiency: how close average is to peak performance
		const efficiency =
			peakTokensPerSecond > 0
				? (averageTokensPerSecond / peakTokensPerSecond) * 100
				: 0;

		return {
			peakTokensPerSecond,
			averageTokensPerSecond,
			totalProcessingTime,
			efficiency,
		};
	}

	exportProgressData(): string {
		const summary = this.getProgressSummary();
		const metrics = this.getPerformanceMetrics();

		const exportData = {
			timestamp: new Date().toISOString(),
			summary,
			metrics,
			history: this.progressHistory,
			estimatedInputTokens: this.estimatedInputTokens,
		};

		return JSON.stringify(exportData, null, 2);
	}

	// For debugging/monitoring
	logCurrentStatus(): void {
		console.group('Progress Tracking Status');
		console.log('Current Progress:', this.currentProgress);
		console.log('History Length:', this.progressHistory.length);
		console.log('Summary:', this.getProgressSummary());
		console.log('Performance:', this.getPerformanceMetrics());
		console.log('In Progress:', this.isInProgress());
		console.log('ETA:', this.getEstimatedTimeRemaining());
		console.groupEnd();
	}
}

export const progressTrackingService = ProgressTrackingService.getInstance();
