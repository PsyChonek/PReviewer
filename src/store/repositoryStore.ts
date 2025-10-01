import { create } from 'zustand';
import { BranchInfo } from '../types';

interface RepositoryState {
	// Repository path
	currentRepoPath: string | null;
	setCurrentRepoPath: (path: string | null) => void;

	// Branches
	fromBranch: string;
	toBranch: string;
	setFromBranch: (branch: string) => void;
	setToBranch: (branch: string) => void;
	setBranches: (fromBranch: string, toBranch: string) => void;

	// Branch data
	branches: BranchInfo[];
	setBranchList: (branches: BranchInfo[]) => void;
	isLoadingBranches: boolean;
	setLoadingBranches: (loading: boolean) => void;

	// Computed properties
	canStartReview: () => boolean;

	// Actions
	clearRepository: () => void;
}

export const useRepositoryStore = create<RepositoryState>((set, get) => ({
	// Initial state
	currentRepoPath: null,
	fromBranch: '',
	toBranch: '',
	branches: [],
	isLoadingBranches: false,

	// Repository path actions
	setCurrentRepoPath: (path) => set({ currentRepoPath: path }),

	// Branch selection actions
	setFromBranch: (branch) => set({ fromBranch: branch }),
	setToBranch: (branch) => set({ toBranch: branch }),
	setBranches: (fromBranch, toBranch) => set({ fromBranch, toBranch }),

	// Branch data actions
	setBranchList: (branches) => set({ branches }),
	setLoadingBranches: (loading) => set({ isLoadingBranches: loading }),

	// Computed properties
	canStartReview: () => {
		const state = get();
		return !!(state.currentRepoPath && state.fromBranch && state.toBranch && state.fromBranch !== state.toBranch);
	},

	// Clear all repository state
	clearRepository: () =>
		set({
			currentRepoPath: null,
			fromBranch: '',
			toBranch: '',
			branches: [],
			isLoadingBranches: false,
		}),
}));
