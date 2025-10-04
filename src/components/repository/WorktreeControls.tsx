import React, { useState } from 'react';
import { WorktreeInfo } from '../../types';
import { formatFileSize } from '../../utils/fileScanner';

interface WorktreeControlsProps {
	worktree: WorktreeInfo | null;
	onDelete: () => Promise<void>;
	disabled?: boolean;
}

const WorktreeControls: React.FC<WorktreeControlsProps> = ({ worktree, onDelete, disabled = false }) => {
	const [isDeleting, setIsDeleting] = useState(false);
	const [showConfirmModal, setShowConfirmModal] = useState(false);

	if (!worktree) {
		return null;
	}

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await onDelete();
			setShowConfirmModal(false);
		} catch (error) {
			console.error('Failed to delete worktree:', error);
			alert(`Failed to delete worktree: ${error}`);
		} finally {
			setIsDeleting(false);
		}
	};

	const createdDate = new Date(worktree.createdAt);
	const timeAgo = getTimeAgo(worktree.createdAt);

	return (
		<>
			<div className="alert alert-info shadow-lg mb-6 w-full">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current flex-shrink-0 w-6 h-6">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<div className="flex-1 min-w-0">
					<div className="mb-2">
						<h3 className="font-bold inline">Active Worktree</h3>
						<span className="ml-2 text-sm">
							<code className="text-xs break-all">{worktree.path}</code>
						</span>
					</div>
					<div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
						<div>
							<strong>Branch:</strong> {worktree.branch}
						</div>
						<div>
							<strong>Created:</strong> {timeAgo} ({createdDate.toLocaleString()})
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
					className={`btn btn-sm btn-error ${isDeleting || disabled ? 'btn-disabled' : ''}`}
					onClick={() => setShowConfirmModal(true)}
					disabled={isDeleting || disabled}
					aria-label="Delete worktree"
				>
					{isDeleting ? (
						<>
							<span className="loading loading-spinner loading-sm"></span>
							Deleting...
						</>
					) : (
						<>
							<i className="fas fa-trash"></i>
							Delete Worktree
						</>
					)}
				</button>
			</div>

			{/* Confirmation Modal */}
			{showConfirmModal && (
				<div className="modal modal-open">
					<div className="modal-box">
						<h3 className="font-bold text-lg mb-4">Delete Worktree?</h3>
						<p className="py-4">
							Are you sure you want to delete this worktree?
							<br />
							<br />
							<strong>Branch:</strong> {worktree.branch}
							<br />
							<strong>Path:</strong> <code className="text-xs">{worktree.path}</code>
						</p>
						<div className="modal-action">
							<button className="btn btn-ghost" onClick={() => setShowConfirmModal(false)} disabled={isDeleting}>
								<i className="fas fa-times"></i>
								Cancel
							</button>
							<button className={`btn btn-error ${isDeleting ? 'btn-disabled' : ''}`} onClick={handleDelete} disabled={isDeleting}>
								{isDeleting ? (
									<>
										<span className="loading loading-spinner loading-sm"></span>
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
			)}
		</>
	);
};

function getTimeAgo(timestamp: number): string {
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
}

export default WorktreeControls;
