import React, { useState, useRef, useEffect } from 'react';
import { BranchInfo } from '../../types';

interface BranchSelectorProps {
	id: string;
	label: string;
	helpText: string;
	disabled: boolean;
	selectedBranch: string;
	branches: BranchInfo[];
	isLoading: boolean;
	onBranchSelect: (branchName: string) => void;
	placeholder: string;
	disabledText: string;
}

const BranchSelector: React.FC<BranchSelectorProps> = ({
	id,
	label,
	helpText,
	disabled,
	selectedBranch,
	branches,
	isLoading,
	onBranchSelect,
	placeholder,
	disabledText,
}) => {
	const [filter, setFilter] = useState<string>('');
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const detailsRef = useRef<HTMLDetailsElement>(null);

	// Filter branches based on internal filter state
	const filteredBranches = branches.filter((branch) => branch.name.toLowerCase().includes(filter.toLowerCase()));

	const handleBranchSelect = (branchName: string) => {
		onBranchSelect(branchName);
		setFilter(''); // Clear filter
		setIsOpen(false);
	};

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen]);

	return (
		<div className="form-control">
			<label className="label" htmlFor={id}>
				<span className="label-text font-medium">{label}</span>
			</label>
			<details ref={detailsRef} className="dropdown dropdown-bottom w-full" open={isOpen} onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}>
				<summary id={id} className={`btn btn-outline w-full justify-start ${disabled ? 'btn-disabled' : ''}`}>
					<span>{disabled ? disabledText : selectedBranch || placeholder}</span>
					<i className="fas fa-chevron-down ml-auto"></i>
				</summary>
				{!disabled && (
					<div className="dropdown-content z-[1] menu p-0 shadow bg-base-100 rounded-box w-full">
						<div className="p-2">
							<input
								type="text"
								placeholder="Search branches..."
								className="input input-bordered input-sm w-full"
								value={filter}
								onChange={(e) => setFilter(e.target.value)}
							/>
						</div>
						<ul className="menu max-h-60 overflow-y-auto flex-nowrap">
							{isLoading ? (
								<li>
									<span className="loading loading-spinner loading-sm"></span> Loading...
								</li>
							) : filteredBranches.length > 0 ? (
								filteredBranches.map((branch) => (
									<li key={branch.name}>
										<a
											onClick={() => handleBranchSelect(branch.name)}
											className={`flex items-center justify-between hover:bg-base-300 ${selectedBranch === branch.name ? 'bg-primary text-primary-content' : ''}`}
										>
											<span className="flex items-center gap-2">
												<i className={`fas ${branch.type === 'remote' ? 'fa-cloud' : 'fa-code-branch'} text-sm`}></i>
												<span className="font-mono text-sm">{branch.name}</span>
											</span>
											{branch.type === 'remote' && <span className="badge badge-xs badge-secondary">remote</span>}
										</a>
									</li>
								))
							) : (
								<li>
									<span className="text-gray-500 italic">No branches found</span>
								</li>
							)}
						</ul>
					</div>
				)}
			</details>
			<div className="label-text-alt text-sm text-gray-500 mt-1">{helpText}</div>
		</div>
	);
};

export default BranchSelector;
