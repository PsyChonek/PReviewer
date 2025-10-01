import React, { useState, useEffect } from 'react';
import Navbar from './components/layout/Navbar';
import RepositorySection from './components/repository/RepositorySection';
import OutputSection from './components/review/OutputSection';
import ConfigModal from './components/config/ConfigModal';
import ProgressTracker from './components/review/ProgressTracker';
import { AppState, AIProviderConfig } from './types';
import { buildPrompt } from './utils/prompts';
import { estimateTokens } from './utils/tokenEstimation';
import { useTokenStore } from './store/tokenStore';
import { useConfigStore } from './store/configStore';

const App: React.FC = () => {
	const {
		setEstimatedInputTokens: setStoreEstimatedTokens,
		setCurrentSessionInputTokens,
		setCurrentSessionOutputTokens,
		addToTotalInputTokens,
		addToTotalOutputTokens,
		resetCurrentSession,
		estimatedInputTokens: storeEstimatedTokens,
	} = useTokenStore();

	const { aiConfig, basePrompt, userPrompt, debugMode } = useConfigStore();
	const [appState, setAppState] = useState<AppState>({
		currentRepoPath: null,
		reviewInProgress: false,
		reviewStartTime: null,
		currentOutputMarkdown: '',
	});

	const [fromBranch, setFromBranch] = useState<string>('');
	const [toBranch, setToBranch] = useState<string>('');
	const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
	const [testingConnection, setTestingConnection] = useState<boolean>(false);
	const [connectionTestResult, setConnectionTestResult] = useState<{
		success: boolean;
		message: string;
		provider?: string;
	} | null>(null);
	const [reviewStats, setReviewStats] = useState<{
		tokens: number;
		inputTokens: number;
		outputTokens: number;
		tokensPerSecond: number;
		processingTime: number;
		responseTime: number;
		stage: string;
		progress: number;
	} | null>(null);

	const [estimatedInputTokens, setEstimatedInputTokens] = useState<number>(0);

	// Set up progress listeners with access to current estimatedInputTokens
	useEffect(() => {
		const ollamaProgressCleanup = window.electronAPI.onOllamaProgress(
			(event, data) => {
				setReviewStats((_prevStats) => ({
					tokens: data.tokens || 0,
					inputTokens: data.actualInputTokens || estimatedInputTokens,
					outputTokens: data.actualOutputTokens || data.tokens || 0,
					tokensPerSecond: data.tokensPerSecond || 0,
					processingTime: data.processingTime || 0,
					responseTime: data.responseTime || 0,
					stage: data.stage || data.message || '',
					progress: data.progress || 0,
				}));

				// Update current session tokens live during review
				setCurrentSessionInputTokens(
					data.actualInputTokens || storeEstimatedTokens
				);
				setCurrentSessionOutputTokens(
					data.actualOutputTokens || data.tokens || 0
				);

				// Update total tokens when review completes (try multiple completion indicators)
				if (
					(data.stage === 'complete' || data.progress === 100) &&
					(data.actualInputTokens || data.actualOutputTokens)
				) {
					const newInputTokens = data.actualInputTokens || storeEstimatedTokens;
					const newOutputTokens = data.actualOutputTokens || data.tokens || 0;

					console.log('Updating total tokens from progress listener:', {
						stage: data.stage,
						progress: data.progress,
						inputTokens: newInputTokens,
						outputTokens: newOutputTokens,
					});

					if (newInputTokens > 0) {
						addToTotalInputTokens(newInputTokens);
						console.log('Added input tokens to total:', newInputTokens);
					}

					if (newOutputTokens > 0) {
						addToTotalOutputTokens(newOutputTokens);
						console.log('Added output tokens to total:', newOutputTokens);
					}
				}
			}
		);

		const azureProgressCleanup = window.electronAPI.onAzureAIProgress(
			(event, data) => {
				setReviewStats((_prevStats) => ({
					tokens: data.tokens || 0,
					inputTokens: data.actualInputTokens || estimatedInputTokens,
					outputTokens: data.actualOutputTokens || data.tokens || 0,
					tokensPerSecond: data.tokensPerSecond || 0,
					processingTime: data.processingTime || 0,
					responseTime: data.responseTime || 0,
					stage: data.stage || data.message || '',
					progress: data.progress || 0,
				}));

				// Update current session tokens live during review
				setCurrentSessionInputTokens(
					data.actualInputTokens || storeEstimatedTokens
				);
				setCurrentSessionOutputTokens(
					data.actualOutputTokens || data.tokens || 0
				);

				// Update total tokens when review completes (try multiple completion indicators)
				if (
					(data.stage === 'complete' || data.progress === 100) &&
					(data.actualInputTokens || data.actualOutputTokens)
				) {
					const newInputTokens = data.actualInputTokens || storeEstimatedTokens;
					const newOutputTokens = data.actualOutputTokens || data.tokens || 0;

					console.log('Updating total tokens from progress listener:', {
						stage: data.stage,
						progress: data.progress,
						inputTokens: newInputTokens,
						outputTokens: newOutputTokens,
					});

					if (newInputTokens > 0) {
						addToTotalInputTokens(newInputTokens);
						console.log('Added input tokens to total:', newInputTokens);
					}

					if (newOutputTokens > 0) {
						addToTotalOutputTokens(newOutputTokens);
						console.log('Added output tokens to total:', newOutputTokens);
					}
				}
			}
		);

		// Cleanup listeners on unmount
		return () => {
			ollamaProgressCleanup();
			azureProgressCleanup();
		};
	}, [
		estimatedInputTokens,
		storeEstimatedTokens,
		setCurrentSessionInputTokens,
		setCurrentSessionOutputTokens,
		addToTotalInputTokens,
		addToTotalOutputTokens,
	]);

	const calculateTokens = async () => {
		if (
			!appState.currentRepoPath ||
			!fromBranch ||
			!toBranch ||
			fromBranch === toBranch
		) {
			console.log('calculateInputTokens: Missing requirements', {
				repoPath: appState.currentRepoPath,
				fromBranch,
				toBranch,
			});
			setEstimatedInputTokens(0);
			setStoreEstimatedTokens(0);
			return;
		}

		try {
			console.log('calculateInputTokens: Getting diff...');
			const diff = await window.electronAPI.getGitDiff(
				appState.currentRepoPath,
				fromBranch,
				toBranch
			);
			if (!diff || diff.trim() === '') {
				console.log('calculateInputTokens: No diff found');
				setEstimatedInputTokens(0);
				setStoreEstimatedTokens(0);
				return;
			}

			console.log('calculateInputTokens: Building prompt...');
			const fullPrompt = buildPrompt(diff, basePrompt, userPrompt);

			console.log('calculateInputTokens: Estimating tokens...');
			const tokens = estimateTokens(fullPrompt);
			console.log('calculateInputTokens: Estimated tokens:', tokens);
			setEstimatedInputTokens(tokens);
			setStoreEstimatedTokens(tokens);
		} catch (error) {
			console.error('Error calculating input tokens:', error);
			setEstimatedInputTokens(0);
			setStoreEstimatedTokens(0);
		}
	};

	// Calculate input tokens when branches, repo, or prompts change
	useEffect(() => {
		const timer = setTimeout(() => {
			calculateTokens();
		}, 500); // Debounce to avoid too many calculations

		return () => clearTimeout(timer);
	}, [
		appState.currentRepoPath,
		fromBranch,
		toBranch,
		basePrompt,
		userPrompt,
		setStoreEstimatedTokens,
	]);

	const handleStartReview = async () => {
		if (!appState.currentRepoPath || !fromBranch || !toBranch) {
			alert(
				'Please select a repository and both branches before starting the review.'
			);
			return;
		}

		setAppState((prev) => ({
			...prev,
			reviewInProgress: true,
			reviewStartTime: Date.now(),
			currentOutputMarkdown: '',
		}));

		// Reset review stats and current session tokens
		setReviewStats(null);
		resetCurrentSession();

		try {
			if (debugMode) {
				console.log('=== Review Debug Info ===');
				console.log('Configuration:', {
					provider: aiConfig.provider,
					model:
						aiConfig.provider === 'ollama'
							? aiConfig.ollama.model
							: aiConfig.azure.deployment,
					endpoint:
						aiConfig.provider === 'ollama'
							? aiConfig.ollama.url
							: aiConfig.azure.endpoint,
				});
				console.log('Repository:', {
					path: appState.currentRepoPath,
					fromBranch: fromBranch,
					toBranch: toBranch,
					comparison: `${toBranch} → ${fromBranch}`,
				});
			}

			// Get the diff
			const diff = await window.electronAPI.getGitDiff(
				appState.currentRepoPath,
				fromBranch,
				toBranch
			);

			if (!diff || diff.trim() === '') {
				setAppState((prev) => ({
					...prev,
					currentOutputMarkdown:
						'## No Changes Found\n\nNo differences were found between the selected branches.',
					reviewInProgress: false,
				}));
				return;
			}

			// Build the prompt
			const fullPrompt = buildPrompt(diff, basePrompt, userPrompt);

			if (debugMode) {
				const diffLines = diff.split('\n').length;
				const diffSize = new TextEncoder().encode(diff).length;
				const estimatedTokens = estimateTokens(fullPrompt);

				console.log('Diff Metadata:', {
					sizeBytes: diffSize,
					sizeKB: (diffSize / 1024).toFixed(2),
					lines: diffLines,
					characters: diff.length,
				});
				console.log('Token Estimation:', {
					estimated: estimatedTokens,
					promptLength: fullPrompt.length,
					basePromptLength: basePrompt.length,
					userPromptLength: userPrompt.length,
					diffLength: diff.length,
				});
				console.log('Full prompt:', fullPrompt);
			}

			// Call the appropriate AI service
			let result;
			const apiCallStart = Date.now();
			try {
				if (debugMode) {
					console.log('API Call:', {
						timestamp: new Date().toISOString(),
						provider: aiConfig.provider,
					});
				}

				if (aiConfig.provider === 'ollama') {
					const response = await window.electronAPI.callOllamaAPI({
						url: aiConfig.ollama.url,
						model: aiConfig.ollama.model,
						prompt: fullPrompt,
					});
					result = { success: true, content: response };
				} else {
					const response = await window.electronAPI.callAzureAI({
						endpoint: aiConfig.azure.endpoint,
						apiKey: aiConfig.azure.apiKey,
						deploymentName: aiConfig.azure.deployment,
						prompt: fullPrompt,
					});
					result = { success: true, content: response };
				}

				if (debugMode) {
					const apiCallDuration = Date.now() - apiCallStart;
					console.log('API Response:', {
						success: true,
						duration: `${(apiCallDuration / 1000).toFixed(2)}s`,
						responseLength: result.content?.length || 0,
					});
				}
			} catch (apiError) {
				const apiCallDuration = Date.now() - apiCallStart;
				result = { success: false, error: String(apiError) };

				if (debugMode) {
					console.error('API Error:', {
						duration: `${(apiCallDuration / 1000).toFixed(2)}s`,
						error: String(apiError),
						stack: apiError instanceof Error ? apiError.stack : undefined,
					});
				}
			}

			if (result.success && result.content) {
				setAppState((prev) => ({
					...prev,
					currentOutputMarkdown: result.content || '',
					reviewInProgress: false,
				}));

				// Update total tokens when review completes successfully
				const currentStats = reviewStats;
				console.log('Review completed successfully, updating totals:', {
					currentStats,
					storeEstimatedTokens,
				});

				if (debugMode && currentStats) {
					const totalDuration = Date.now() - appState.reviewStartTime!;
					const estimationAccuracy =
						currentStats.inputTokens > 0
							? (
									(currentStats.inputTokens / storeEstimatedTokens) *
									100
								).toFixed(1)
							: 'N/A';

					console.log('=== Review Completed ===');
					console.log('Performance Metrics:', {
						totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
						tokensPerSecond: currentStats.tokensPerSecond.toFixed(2),
						processingTime: `${(currentStats.processingTime / 1000).toFixed(2)}s`,
						responseTime: `${(currentStats.responseTime / 1000).toFixed(2)}s`,
					});
					console.log('Token Metrics:', {
						estimatedInput: storeEstimatedTokens,
						actualInput: currentStats.inputTokens,
						actualOutput: currentStats.outputTokens,
						total: currentStats.inputTokens + currentStats.outputTokens,
						estimationAccuracy: `${estimationAccuracy}%`,
					});
				}

				if (currentStats) {
					const inputTokensToAdd =
						currentStats.inputTokens || storeEstimatedTokens;
					const outputTokensToAdd =
						currentStats.outputTokens || currentStats.tokens;

					console.log('Adding tokens:', {
						inputTokensToAdd,
						outputTokensToAdd,
					});

					if (inputTokensToAdd > 0) {
						addToTotalInputTokens(inputTokensToAdd);
						console.log(
							'Updated total input tokens (from completion):',
							inputTokensToAdd
						);
					}

					if (outputTokensToAdd > 0) {
						addToTotalOutputTokens(outputTokensToAdd);
						console.log(
							'Updated total output tokens (from completion):',
							outputTokensToAdd
						);
					}
				} else {
					// Fallback: use estimated input tokens at minimum
					console.log(
						'No current stats, using estimated input tokens:',
						storeEstimatedTokens
					);
					if (storeEstimatedTokens > 0) {
						addToTotalInputTokens(storeEstimatedTokens);
						console.log(
							'Updated total input tokens (fallback):',
							storeEstimatedTokens
						);
					}
				}
			} else {
				setAppState((prev) => ({
					...prev,
					currentOutputMarkdown: `## Error\n\n${result.error || 'An unknown error occurred during the review.'}`,
					reviewInProgress: false,
				}));
			}
		} catch (error) {
			console.error('Review failed:', error);
			setAppState((prev) => ({
				...prev,
				currentOutputMarkdown: `## Error\n\nFailed to complete the review: ${error}`,
				reviewInProgress: false,
			}));
		}
	};

	const handleStopReview = () => {
		setAppState((prev) => ({
			...prev,
			reviewInProgress: false,
		}));
	};

	const handleClearOutput = () => {
		setAppState((prev) => ({
			...prev,
			currentOutputMarkdown: '',
		}));
	};

	const handleCopyOutput = async () => {
		try {
			await navigator.clipboard.writeText(appState.currentOutputMarkdown);
			// Could add a toast notification here
		} catch (error) {
			console.error('Failed to copy to clipboard:', error);
		}
	};

	const handleExportOutput = () => {
		const blob = new Blob([appState.currentOutputMarkdown], {
			type: 'text/markdown',
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `pr-review-${Date.now()}.md`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleOpenConfig = () => {
		setShowConfigModal(true);
		setConnectionTestResult(null); // Clear previous test results
	};

	const handleTestConnection = async (configToTest: AIProviderConfig) => {
		setTestingConnection(true);
		setConnectionTestResult(null);

		try {
			let result;
			let providerName: string;

			if (configToTest.provider === 'ollama') {
				result = await window.electronAPI.testOllamaConnection({
					url: configToTest.ollama.url,
					model: configToTest.ollama.model,
				});
				providerName = 'Ollama';
			} else {
				result = await window.electronAPI.testAzureAIConnection({
					endpoint: configToTest.azure.endpoint,
					apiKey: configToTest.azure.apiKey,
					deploymentName: configToTest.azure.deployment,
				});
				providerName = 'Azure AI';
			}

			if (result.success) {
				const modelInfo =
					configToTest.provider === 'ollama'
						? ('version' in result ? result.version : '') ||
							result.modelResponse ||
							'OK'
						: result.modelResponse || 'OK';

				setConnectionTestResult({
					success: true,
					message: `${providerName} connection successful! Model responded: "${modelInfo}"`,
					provider: providerName,
				});
			} else {
				setConnectionTestResult({
					success: false,
					message: `${providerName} test failed: ${result.error}`,
					provider: providerName,
				});
			}
		} catch (error) {
			setConnectionTestResult({
				success: false,
				message: `Connection test failed: ${error}`,
				provider: configToTest.provider,
			});
		} finally {
			setTestingConnection(false);
		}
	};

	return (
		<div className="bg-base-100">
			<Navbar />

			<main className="container mx-auto px-4 py-6 max-w-7xl" role="main">
				<RepositorySection
					onRepoPathChange={(path) =>
						setAppState((prev) => ({
							...prev,
							currentRepoPath: path,
						}))
					}
					onBranchChange={(fromBranch, toBranch) => {
						setFromBranch(fromBranch);
						setToBranch(toBranch);
					}}
					onStartReview={handleStartReview}
					onStopReview={handleStopReview}
					reviewInProgress={appState.reviewInProgress}
					onOpenConfig={handleOpenConfig}
					estimatedInputTokens={storeEstimatedTokens}
					onRefreshDiff={calculateTokens}
				/>

				<ProgressTracker
					reviewStats={reviewStats}
					estimatedInputTokens={storeEstimatedTokens}
					reviewInProgress={appState.reviewInProgress}
				/>

				<OutputSection
					outputContent={appState.currentOutputMarkdown}
					onClearOutput={handleClearOutput}
					onCopyOutput={handleCopyOutput}
					onExportOutput={handleExportOutput}
					reviewInProgress={appState.reviewInProgress}
					reviewStats={reviewStats}
					estimatedInputTokens={storeEstimatedTokens}
				/>
			</main>

			<ConfigModal
				isOpen={showConfigModal}
				onClose={() => setShowConfigModal(false)}
				onTestConnection={handleTestConnection}
				testingConnection={testingConnection}
				connectionTestResult={connectionTestResult}
			/>
		</div>
	);
};

export default App;
