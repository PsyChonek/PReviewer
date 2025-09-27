import React, { useState, useEffect } from 'react';
import { BranchInfo } from '../types';
import { formatTokenCount } from '../utils/tokenEstimation';
import BranchSelector from './BranchSelector';

interface RepositorySectionProps {
  onRepoPathChange: (path: string | null) => void;
  onBranchChange: (fromBranch: string, toBranch: string) => void;
  onStartReview: () => void;
  onStopReview: () => void;
  reviewInProgress: boolean;
  onOpenConfig: () => void;
  estimatedInputTokens: number;
}

const RepositorySection: React.FC<RepositorySectionProps> = ({
  onRepoPathChange,
  onBranchChange,
  onStartReview,
  onStopReview,
  reviewInProgress,
  onOpenConfig,
  estimatedInputTokens
}) => {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [fromBranch, setFromBranch] = useState<string>('');
  const [toBranch, setToBranch] = useState<string>('');
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  useEffect(() => {
    if (repoPath) {
      loadBranches();
    } else {
      setBranches([]);
    }
  }, [repoPath]);


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

  const loadBranches = async () => {
    if (!repoPath) return;

    setIsLoadingBranches(true);
    try {
      const branchList = await window.electronAPI.getGitBranches(repoPath);
      // Convert string array to BranchInfo array
      const branchInfoList: BranchInfo[] = branchList.map(branchName => ({
        name: branchName,
        type: branchName.startsWith('remotes/') ? 'remote' : 'local'
      }));
      setBranches(branchInfoList);

      // Auto-select target branch (main/master if available)
      if (branchInfoList.length > 0 && !toBranch) {
        const preferredTargets = ['main', 'master'];
        const targetBranch = preferredTargets.find(target =>
          branchInfoList.some(branch => branch.name === target)
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


  const handleFromBranchSelect = (branchName: string) => {
    setFromBranch(branchName);
  };

  const handleToBranchSelect = (branchName: string) => {
    setToBranch(branchName);
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

        {/* Estimated Input Tokens Display */}
        {estimatedInputTokens > 0 && canStartReview && (
          <div className="alert alert-success mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <h3 className="font-bold text-lg text-success-content">Ready for Review</h3>
              <div className="text-sm text-success-content">Estimated input tokens: <span className="font-semibold">{formatTokenCount(estimatedInputTokens)}</span></div>
            </div>
          </div>
        )}

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