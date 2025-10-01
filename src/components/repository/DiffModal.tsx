import React from 'react';

interface DiffModalProps {
	isOpen: boolean;
	onClose: () => void;
	diffContent: string;
	fromBranch: string;
	toBranch: string;
	isLoading: boolean;
}

const DiffModal: React.FC<DiffModalProps> = ({ isOpen, onClose, diffContent, fromBranch, toBranch, isLoading }) => {
	if (!isOpen) return null;

	const handleCopyDiff = async () => {
		try {
			await navigator.clipboard.writeText(diffContent);
		} catch (error) {
			console.error('Failed to copy diff to clipboard:', error);
		}
	};

	return (
		<dialog className="modal modal-open">
			<div className="modal-box w-11/12 max-w-5xl">
				<h3 className="font-bold text-lg flex items-center gap-2">
					<i className="fas fa-code-branch"></i>
					Git Diff: {toBranch} → {fromBranch}
				</h3>
				<p className="text-sm text-gray-500 mt-1">
					Shows changes from {fromBranch} compared to {toBranch}
				</p>

				<div className="divider"></div>

				{isLoading ? (
					<div className="flex justify-center items-center py-8">
						<span className="loading loading-spinner loading-lg"></span>
						<span className="ml-4">Loading diff...</span>
					</div>
				) : diffContent ? (
					<div className="bg-base-300 p-4 rounded-lg max-h-96 overflow-auto">
						<pre className="text-xs whitespace-pre-wrap break-words">{diffContent}</pre>
					</div>
				) : (
					<div className="alert alert-info">
						<i className="fas fa-info-circle"></i>
						<span>No differences found between the selected branches.</span>
					</div>
				)}

				<div className="modal-action">
					<button className="btn btn-outline btn-sm" onClick={handleCopyDiff} disabled={!diffContent || isLoading} title="Copy diff to clipboard">
						<i className="fas fa-copy"></i>
						Copy
					</button>
					<button className="btn btn-primary" onClick={onClose}>
						Close
					</button>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop" onClick={onClose}>
				<button>close</button>
			</form>
		</dialog>
	);
};

export default DiffModal;
