import React, { useState } from 'react';

interface GitRefreshButtonProps {
	repoPath: string | null;
	onRefreshComplete: () => void;
}

const GitRefreshButton: React.FC<GitRefreshButtonProps> = ({ repoPath, onRefreshComplete }) => {
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [lastResult, setLastResult] = useState<{
		success: boolean;
		message: string;
	} | null>(null);

	const handleRefresh = async () => {
		if (!repoPath) return;

		setIsRefreshing(true);
		setLastResult(null);

		try {
			// First fetch
			const fetchResult = await window.electronAPI.gitFetch(repoPath);

			if (!fetchResult.success) {
				setLastResult({
					success: false,
					message: fetchResult.error || 'Failed to fetch changes',
				});
				return;
			}

			// Then pull
			const pullResult = await window.electronAPI.gitPull(repoPath);

			if (pullResult.success) {
				setLastResult({
					success: true,
					message: 'Successfully fetched and pulled latest changes',
				});
				onRefreshComplete();
			} else {
				setLastResult({
					success: false,
					message: pullResult.error || 'Failed to pull changes',
				});
			}
		} catch (error) {
			setLastResult({
				success: false,
				message: `Failed to refresh: ${error}`,
			});
		} finally {
			setIsRefreshing(false);

			// Auto-hide message after 3 seconds
			setTimeout(() => {
				setLastResult(null);
			}, 3000);
		}
	};

	const isDisabled = !repoPath || isRefreshing;

	return (
		<div className="flex items-center gap-2">
			<button
				className={`btn btn-outline btn-sm ${isDisabled ? 'btn-disabled' : ''}`}
				onClick={handleRefresh}
				disabled={isDisabled}
				title="Fetch and pull changes from remote"
				aria-label="Fetch and pull changes from remote repository"
			>
				{isRefreshing ? <span className="loading loading-spinner loading-xs"></span> : <i className="fas fa-sync-alt"></i>}
				Refresh
			</button>

			{lastResult && (
				<div className={`toast toast-top toast-end z-50`} role="alert" aria-live="polite">
					<div className={`alert ${lastResult.success ? 'alert-success' : 'alert-error'}`}>
						<span>{lastResult.message}</span>
					</div>
				</div>
			)}
		</div>
	);
};

export default GitRefreshButton;
