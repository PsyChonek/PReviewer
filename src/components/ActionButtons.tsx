import React from 'react';

interface ActionButtonsProps {
	onClearOutput: () => void;
	onCopyOutput: () => void;
	onExportOutput: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
	onClearOutput,
	onCopyOutput,
	onExportOutput,
}) => {
	return (
		<div className="flex gap-2" role="group" aria-label="Output actions">
			<button
				className="btn btn-sm btn-outline"
				onClick={onClearOutput}
				aria-label="Clear output text"
			>
				<i className="fas fa-trash"></i> Clear
			</button>
			<button
				className="btn btn-sm btn-outline"
				onClick={onCopyOutput}
				aria-label="Copy output to clipboard"
			>
				<i className="fas fa-copy"></i> Copy
			</button>
			<button
				className="btn btn-sm btn-outline"
				onClick={onExportOutput}
				aria-label="Export output to file"
			>
				<i className="fas fa-download"></i> Export
			</button>
		</div>
	);
};

export default ActionButtons;
