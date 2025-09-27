import React, { useState } from 'react';
import { BranchInfo } from '../types';

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
  disabledText
}) => {
  const [filter, setFilter] = useState<string>('');

  // Filter branches based on internal filter state
  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(filter.toLowerCase())
  );
  const handleBranchSelect = (branchName: string) => {
    onBranchSelect(branchName);
    setFilter(''); // Clear filter
    // Close dropdown
    const detailsElement = document.getElementById(id)?.closest('details');
    if (detailsElement) {
      detailsElement.open = false;
    }
  };

  return (
    <div className="form-control">
      <label className="label" htmlFor={id}>
        <span className="label-text font-medium">{label}</span>
      </label>
      <details className="dropdown dropdown-bottom w-full">
        <summary
          id={id}
          className={`btn btn-outline w-full justify-start ${disabled ? 'btn-disabled' : ''}`}
        >
          <span>
            {disabled ? disabledText : selectedBranch || placeholder}
          </span>
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
            <ul className="menu menu-lg max-h-60 overflow-y-auto">
              {isLoading ? (
                <li><span className="loading loading-spinner loading-sm"></span> Loading...</li>
              ) : filteredBranches.length > 0 ? (
                filteredBranches.map((branch) => (
                  <li key={branch.name}>
                    <a onClick={() => handleBranchSelect(branch.name)}>
                      {branch.name}
                      {branch.type === 'remote' && <span className="badge badge-sm badge-secondary ml-2">remote</span>}
                    </a>
                  </li>
                ))
              ) : (
                <li><span>No branches found</span></li>
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