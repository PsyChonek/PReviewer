import React, { useState, useEffect } from 'react';
import { BranchInfo } from '../../types';
import { formatTokenCount } from '../../utils/tokenEstimation';
import BranchSelector from './BranchSelector';
import GitRefreshButton from './GitRefreshButton';
import EstimatedTokensDisplay from './EstimatedTokensDisplay';

interface RepositorySectionProps {
	onRepoPathChange: (path: string | null) => void;
	onBranchChange: (fromBranch: string, toBranch: string) => void;
	onStartReview: () => void;
	onStopReview: () => void;
	reviewInProgress: boolean;
	onOpenConfig: () => void;
	estimatedInputTokens: number;
	onRefreshDiff: () => void;
}

const RepositorySection: React.FC<RepositorySectionProps> = ({
	onRepoPathChange,
	onBranchChange,
	onStartReview,
	onStopReview,
	reviewInProgress,
	onOpenConfig,
	estimatedInputTokens,
	onRefreshDiff,
}) => {
	const [repoPath, setRepoPath] = useState<string | null>(null);
	const [fromBranch, setFromBranch] = useState<string>('');
	const [toBranch, setToBranch] = useState<string>('');
	const [branches, setBranches] = useState<BranchInfo[]>([]);
	const [isLoadingBranches, setIsLoadingBranches] = useState(false);

	useEffect(() => {
		const loadBranches = async () => {
			if (!repoPath) {
				setBranches([]);
				return;
			}

			setIsLoadingBranches(true);
			try {
				const branchList = await window.electronAPI.getGitBranches(repoPath);
				// Convert string array to BranchInfo array
				const branchInfoList: BranchInfo[] = branchList.map((branchName) => ({
					name: branchName,
					type: branchName.startsWith('remotes/') ? 'remote' : 'local',
				}));
				setBranches(branchInfoList);

				// Auto-select target branch (main/master if available)
				if (branchInfoList.length > 0 && !toBranch) {
					const preferredTargets = ['main', 'master'];
					const targetBranch =
						preferredTargets.find((target) =>
							branchInfoList.some((branch) => branch.name === target)
						) || branchInfoList[0].name;
					setToBranch(targetBranch);
				}

				// Auto-select first branch as source if not already selected
				if (branchInfoList.length > 0 && !fromBranch) {
					setFromBranch(branchInfoList[0].name);
				}
			} catch (error) {
				console.error('Failed to load branches:', error);
				setBranches([]);
			} finally {
				setIsLoadingBranches(false);
			}
		};

		loadBranches();
	}, [repoPath, fromBranch, toBranch]);

	// Notify parent when branches change
	useEffect(() => {
		if (fromBranch && toBranch) {
			onBranchChange(fromBranch, toBranch);
		}
	}, [fromBranch, toBranch, onBranchChange]);

	const selectRepository = async () => {
		try {
			const selectedPath = await window.electronAPI.selectDirectory();
			if (selectedPath) {
				setRepoPath(selectedPath);
				onRepoPathChange(selectedPath);
			}
		} catch (error) {
			console.error('Failed to select repository:', error);
		}
	};

	const handleFromBranchSelect = (branchName: string) => {
		setFromBranch(branchName);
	};

	const handleToBranchSelect = (branchName: string) => {
		setToBranch(branchName);
	};

	const handleRefreshComplete = async () => {
		if (!repoPath) return;

		try {
			// Reload branches after git fetch/pull
			const branchList = await window.electronAPI.getGitBranches(repoPath);
			const branchInfoList: BranchInfo[] = branchList.map((branchName) => ({
				name: branchName,
				type: branchName.startsWith('remotes/') ? 'remote' : 'local',
			}));
			setBranches(branchInfoList);
		} catch (error) {
			console.error('Failed to reload branches:', error);
		}
	};

	const canStartReview =
		repoPath &&
		fromBranch &&
		toBranch &&
		fromBranch !== toBranch &&
		!reviewInProgress;

	return (
		<div className="card bg-base-200 shadow-xl mb-6">
			<div className="card-body">
				<div className="flex justify-between items-center mb-4">
					<h2 className="card-title text-2xl">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
							/>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="m8 1 4 4 4-4"
							/>
						</svg>
						Repository & Branches
					</h2>
					<div className="flex gap-2">
						<GitRefreshButton
							repoPath={repoPath}
							onRefreshComplete={handleRefreshComplete}
						/>
						<button
							className={`btn btn-outline btn-sm ${!repoPath || !fromBranch || !toBranch || fromBranch === toBranch ? 'btn-disabled' : ''}`}
							onClick={onRefreshDiff}
							disabled={
								!repoPath || !fromBranch || !toBranch || fromBranch === toBranch
							}
							title="Recalculate diff and token estimation"
							aria-label="Recalculate diff and token estimation"
						>
							<i className="fas fa-calculator"></i>
							Recalculate
						</button>
						<button
							className="btn btn-outline btn-sm"
							onClick={onOpenConfig}
							title="Open Configuration"
							aria-label="Open configuration settings"
						>
							<i className="fas fa-cog"></i>
							Settings
						</button>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4">
					<div className="form-control">
						<label className="label" htmlFor="repo-path">
							<span className="label-text font-medium">Repository Path</span>
						</label>
						<div className="flex gap-2">
							<input
								type="text"
								id="repo-path"
								placeholder="Select a Git repository..."
								className="input input-bordered flex-1"
								value={repoPath || ''}
								readOnly
								aria-describedby="repo-path-help"
							/>
							<button
								className="btn btn-outline btn-primary"
								onClick={selectRepository}
								aria-label="Browse for repository folder"
							>
								<i className="fas fa-folder-open"></i> Browse
							</button>
						</div>
						<div
							id="repo-path-help"
							className="label-text-alt text-sm text-gray-500 mt-1"
							aria-live="polite"
						>
							Choose a folder containing a Git repository
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<BranchSelector
							id="from-branch-button"
							label="From Branch (Source)"
							helpText="Branch containing the changes to review"
							disabled={!repoPath}
							selectedBranch={fromBranch}
							branches={branches}
							isLoading={isLoadingBranches}
							onBranchSelect={handleFromBranchSelect}
							placeholder="Select from branch..."
							disabledText="Select repository first..."
						/>

						<BranchSelector
							id="to-branch-button"
							label="To Branch (Target)"
							helpText="Target branch to compare against (usually main/master)"
							disabled={!repoPath}
							selectedBranch={toBranch}
							branches={branches}
							isLoading={isLoadingBranches}
							onBranchSelect={handleToBranchSelect}
							placeholder="Select to branch..."
							disabledText="Select repository first..."
						/>
					</div>
				</div>

				<EstimatedTokensDisplay
					estimatedInputTokens={estimatedInputTokens}
					canStartReview={canStartReview}
					formatTokenCount={formatTokenCount}
				/>

				<div className="card-actions justify-center mt-6">
					{!reviewInProgress ? (
						<button
							className={`btn btn-success btn-lg ${!canStartReview ? 'btn-disabled' : ''}`}
							onClick={onStartReview}
							disabled={!canStartReview}
							aria-describedby="review-status"
						>
							<i className="fas fa-rocket"></i> Start AI Review
						</button>
					) : (
						<button
							className="btn btn-warning btn-lg"
							onClick={onStopReview}
							aria-label="Stop the current review process"
						>
							<i className="fas fa-stop"></i> Stop Review
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default RepositorySection;
