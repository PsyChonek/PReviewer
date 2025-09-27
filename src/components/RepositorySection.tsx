import React, { useState, useEffect } from 'react';
import { BranchInfo } from '../types';

interface RepositorySectionProps {
  repoPath: string | null;
  fromBranch: string;
  toBranch: string;
  onRepoPathChange: (path: string | null) => void;
  onFromBranchChange: (branch: string) => void;
  onToBranchChange: (branch: string) => void;
  onStartReview: () => void;
  onStopReview: () => void;
  reviewInProgress: boolean;
  onOpenConfig: () => void;
}

const RepositorySection: React.FC<RepositorySectionProps> = ({
  repoPath,
  fromBranch,
  toBranch,
  onRepoPathChange,
  onFromBranchChange,
  onToBranchChange,
  onStartReview,
  onStopReview,
  reviewInProgress,
  onOpenConfig
}) => {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [filteredFromBranches, setFilteredFromBranches] = useState<BranchInfo[]>([]);
  const [filteredToBranches, setFilteredToBranches] = useState<BranchInfo[]>([]);
  const [fromBranchFilter, setFromBranchFilter] = useState('');
  const [toBranchFilter, setToBranchFilter] = useState('');
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  useEffect(() => {
    if (repoPath) {
      loadBranches();
    } else {
      setBranches([]);
      setFilteredFromBranches([]);
      setFilteredToBranches([]);
    }
  }, [repoPath]);

  useEffect(() => {
    filterBranches(fromBranchFilter, 'from');
  }, [branches, fromBranchFilter]);

  useEffect(() => {
    filterBranches(toBranchFilter, 'to');
  }, [branches, toBranchFilter]);

  const selectRepository = async () => {
    try {
      const selectedPath = await window.electronAPI.selectDirectory();
      if (selectedPath) {
        onRepoPathChange(selectedPath);
      }
    } catch (error) {
      console.error('Failed to select repository:', error);
    }
  };

  const loadBranches = async () => {
    if (!repoPath) return;

    setIsLoadingBranches(true);
    try {
      const branchList = await window.electronAPI.getBranches(repoPath);
      setBranches(branchList);
    } catch (error) {
      console.error('Failed to load branches:', error);
      setBranches([]);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const filterBranches = (filter: string, type: 'from' | 'to') => {
    const filtered = branches.filter(branch =>
      branch.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (type === 'from') {
      setFilteredFromBranches(filtered);
    } else {
      setFilteredToBranches(filtered);
    }
  };

  const canStartReview = repoPath && fromBranch && toBranch && fromBranch !== toBranch && !reviewInProgress;

  return (
    <div className="card bg-base-200 shadow-xl mb-6">
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title text-2xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m8 1 4 4 4-4" />
            </svg>
            Repository & Branches
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onOpenConfig}
            title="Open Configuration"
            aria-label="Open configuration settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
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
            <div id="repo-path-help" className="label-text-alt text-sm text-gray-500 mt-1" aria-live="polite">
              Choose a folder containing a Git repository
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label" htmlFor="from-branch-button">
                <span className="label-text font-medium">From Branch (Source)</span>
              </label>
              <div className="dropdown dropdown-bottom w-full">
                <div
                  id="from-branch-button"
                  tabIndex={0}
                  role="button"
                  className={`btn btn-outline w-full justify-start ${!repoPath ? 'btn-disabled' : ''}`}
                >
                  <span id="from-branch-display">
                    {!repoPath ? 'Select repository first...' : fromBranch || 'Select from branch...'}
                  </span>
                  <i className="fas fa-chevron-down ml-auto"></i>
                </div>
                {repoPath && (
                  <div tabIndex={0} className="dropdown-content z-[1] menu p-0 shadow bg-base-100 rounded-box w-full">
                    <div className="p-2">
                      <input
                        type="text"
                        placeholder="Search branches..."
                        className="input input-bordered input-sm w-full"
                        value={fromBranchFilter}
                        onChange={(e) => setFromBranchFilter(e.target.value)}
                      />
                    </div>
                    <ul className="menu menu-lg max-h-60 overflow-y-auto">
                      {isLoadingBranches ? (
                        <li><span className="loading loading-spinner loading-sm"></span> Loading...</li>
                      ) : filteredFromBranches.length > 0 ? (
                        filteredFromBranches.map((branch) => (
                          <li key={branch.name}>
                            <a onClick={() => onFromBranchChange(branch.name)}>
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
              </div>
              <div className="label-text-alt text-sm text-gray-500 mt-1">Branch containing the changes to review</div>
            </div>

            <div className="form-control">
              <label className="label" htmlFor="to-branch-button">
                <span className="label-text font-medium">To Branch (Target)</span>
              </label>
              <div className="dropdown dropdown-bottom w-full">
                <div
                  id="to-branch-button"
                  tabIndex={0}
                  role="button"
                  className={`btn btn-outline w-full justify-start ${!repoPath ? 'btn-disabled' : ''}`}
                >
                  <span id="to-branch-display">
                    {!repoPath ? 'Select repository first...' : toBranch || 'Select to branch...'}
                  </span>
                  <i className="fas fa-chevron-down ml-auto"></i>
                </div>
                {repoPath && (
                  <div tabIndex={0} className="dropdown-content z-[1] menu p-0 shadow bg-base-100 rounded-box w-full">
                    <div className="p-2">
                      <input
                        type="text"
                        placeholder="Search branches..."
                        className="input input-bordered input-sm w-full"
                        value={toBranchFilter}
                        onChange={(e) => setToBranchFilter(e.target.value)}
                      />
                    </div>
                    <ul className="menu menu-lg max-h-60 overflow-y-auto">
                      {isLoadingBranches ? (
                        <li><span className="loading loading-spinner loading-sm"></span> Loading...</li>
                      ) : filteredToBranches.length > 0 ? (
                        filteredToBranches.map((branch) => (
                          <li key={branch.name}>
                            <a onClick={() => onToBranchChange(branch.name)}>
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
              </div>
              <div className="label-text-alt text-sm text-gray-500 mt-1">Target branch to compare against (usually main/master)</div>
            </div>
          </div>
        </div>

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