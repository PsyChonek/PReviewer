import React, { useState, useEffect } from 'react';
import { WorktreeInfo } from '../../types';
import { formatFileSize } from '../../utils/fileScanner';

interface WorktreeListModalProps {
	isOpen: boolean;
	onClose: () => void;
	repoPath: string | null;
	onDeleteWorktree: (worktreePath: string) => Promise<void>;
}

const WorktreeListModal: React.FC<WorktreeListModalProps> = ({ isOpen, onClose, repoPath, onDeleteWorktree }) => {
	const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [deletingPath, setDeletingPath] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen && repoPath) {
			loadWorktrees();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, repoPath]);

	const loadWorktrees = async () => {
		if (!repoPath) return;

		setIsLoading(true);
		try {
			const list = await window.electronAPI.listWorktrees(repoPath);
			setWorktrees(list);
		} catch (error) {
			console.error('Failed to load worktrees:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async (worktreePath: string) => {
		setDeletingPath(worktreePath);
		try {
			await onDeleteWorktree(worktreePath);
			// Reload the list after deletion
			await loadWorktrees();
		} catch (error) {
			console.error('Failed to delete worktree:', error);
			alert(`Failed to delete worktree: ${error}`);
		} finally {
			setDeletingPath(null);
		}
	};

	const getTimeAgo = (timestamp: number): string => {
		const seconds = Math.floor((Date.now() - timestamp) / 1000);

		if (seconds < 60) {
			return `${seconds}s ago`;
		}

		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			return `${minutes}m ago`;
		}

		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			return `${hours}h ago`;
		}

		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	};

	if (!isOpen) return null;

	return (
		<div className="modal modal-open">
			<div className="modal-box max-w-4xl">
				<h3 className="font-bold text-lg mb-4">Manage Worktrees</h3>

				{isLoading ? (
					<div className="flex justify-center py-8">
						<span className="loading loading-spinner loading-lg"></span>
					</div>
				) : worktrees.length === 0 ? (
					<div className="alert alert-info">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
						<span>No active worktrees found.</span>
					</div>
				) : (
					<div className="space-y-3">
						{worktrees.map((worktree) => {
							const createdDate = new Date(worktree.createdAt || Date.now());
							const timeAgo = worktree.createdAt ? getTimeAgo(worktree.createdAt) : 'Unknown';
							const isDeleting = deletingPath === worktree.path;

							return (
								<div key={worktree.path} className="card bg-base-200 shadow-sm">
									<div className="card-body p-4">
										<div className="flex items-start justify-between gap-4">
											<div className="flex-1 min-w-0">
												<h4 className="font-semibold text-sm mb-2">
													<span className="badge badge-primary badge-sm mr-2">{worktree.branch}</span>
													<code className="text-xs break-all">{worktree.path}</code>
												</h4>
												<div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-base-content/70">
													<div>
														<strong>Created:</strong> {timeAgo}
														{worktree.createdAt && <span className="ml-1">({createdDate.toLocaleString()})</span>}
													</div>
													{worktree.fileCount !== undefined && (
														<div>
															<strong>Files:</strong> {worktree.fileCount}
															{worktree.totalSize !== undefined && <span> ({formatFileSize(worktree.totalSize)})</span>}
														</div>
													)}
												</div>
											</div>
											<button
												className={`btn btn-sm btn-error ${isDeleting ? 'btn-disabled' : ''}`}
												onClick={() => handleDelete(worktree.path)}
												disabled={isDeleting}
											>
												{isDeleting ? (
													<>
														<span className="loading loading-spinner loading-xs"></span>
														Deleting...
													</>
												) : (
													<>
														<i className="fas fa-trash"></i>
														Delete
													</>
												)}
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}

				<div className="modal-action">
					<button className="btn btn-ghost" onClick={onClose}>
						<i className="fas fa-times"></i>
						Close
					</button>
				</div>
			</div>
		</div>
	);
};

export default WorktreeListModal;
