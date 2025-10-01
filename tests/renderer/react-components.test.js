import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Import components to test
import App from '../../src/App';
import RepositorySection from '../../src/components/RepositorySection';
import BranchSelector from '../../src/components/BranchSelector';
import OutputSection from '../../src/components/OutputSection';
import ConfigModal from '../../src/components/ConfigModal';

// Setup mocks
require('../react-setup');

// Mock the store modules
jest.mock('../../src/store/tokenStore', () => ({
	useTokenStore: () => ({
		setEstimatedInputTokens: jest.fn(),
		setCurrentSessionInputTokens: jest.fn(),
		setCurrentSessionOutputTokens: jest.fn(),
		addToTotalInputTokens: jest.fn(),
		addToTotalOutputTokens: jest.fn(),
		resetCurrentSession: jest.fn(),
		estimatedInputTokens: 0,
		getLiveInputTokens: jest.fn(() => 0),
		getLiveOutputTokens: jest.fn(() => 0),
		currentSessionInputTokens: 0,
		currentSessionOutputTokens: 0,
		totalInputTokens: 0,
		totalOutputTokens: 0,
	}),
}));

jest.mock('../../src/store/configStore', () => ({
	useConfigStore: () => ({
		aiConfig: {
			provider: 'ollama',
			ollama: {
				url: 'http://localhost:11434',
				model: 'codellama',
			},
			azure: {
				endpoint: '',
				apiKey: '',
				deployment: '',
			},
		},
		basePrompt: 'Default base prompt',
		userPrompt: '',
		debugMode: false,
	}),
}));

describe('React Components', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('RepositorySection Component', () => {
		const defaultProps = {
			onRepoPathChange: jest.fn(),
			onBranchChange: jest.fn(),
			onStartReview: jest.fn(),
			onStopReview: jest.fn(),
			reviewInProgress: false,
			onOpenConfig: jest.fn(),
			estimatedInputTokens: 0,
		};

		test('should render repository selection controls', () => {
			render(<RepositorySection {...defaultProps} />);

			expect(screen.getByText('Repository Path')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
		});

		test('should call selectDirectory when browse button is clicked', async () => {
			const user = userEvent.setup();
			window.electronAPI.selectDirectory.mockResolvedValue('/test/repo/path');
			window.electronAPI.getGitBranches.mockResolvedValue(['main', 'feature']);

			render(<RepositorySection {...defaultProps} />);

			const browseButton = screen.getByRole('button', {
				name: /browse/i,
			});
			await user.click(browseButton);

			expect(window.electronAPI.selectDirectory).toHaveBeenCalled();
		});

		test('should handle repository selection and load branches', async () => {
			const user = userEvent.setup();
			const mockOnRepoPathChange = jest.fn();
			const branches = ['main', 'feature', 'develop'];

			window.electronAPI.selectDirectory.mockResolvedValue('/test/repo/path');
			window.electronAPI.getGitBranches.mockResolvedValue(branches);

			render(<RepositorySection {...defaultProps} onRepoPathChange={mockOnRepoPathChange} />);

			const browseButton = screen.getByRole('button', {
				name: /browse/i,
			});
			await user.click(browseButton);

			await waitFor(() => {
				expect(mockOnRepoPathChange).toHaveBeenCalledWith('/test/repo/path');
			});
		});

		test('should show start review button when valid selection exists', async () => {
			render(<RepositorySection {...defaultProps} />);

			// Initially disabled
			const startButton = screen.getByRole('button', {
				name: /start ai review/i,
			});
			expect(startButton).toBeDisabled();
		});

		test('should show stop review button when review is in progress', () => {
			render(<RepositorySection {...defaultProps} reviewInProgress={true} />);

			expect(
				screen.getByRole('button', {
					name: /stop the current review process/i,
				})
			).toBeInTheDocument();
		});
	});

	describe('BranchSelector Component', () => {
		const defaultProps = {
			id: 'test-branch-selector',
			label: 'Test Branch',
			helpText: 'Select a branch',
			disabled: false,
			selectedBranch: '',
			branches: [
				{ name: 'main', displayName: 'main' },
				{ name: 'feature', displayName: 'feature' },
				{ name: 'develop', displayName: 'develop' },
			],
			isLoading: false,
			onBranchSelect: jest.fn(),
			placeholder: 'Select branch',
			disabledText: 'No branches available',
		};

		test('should render branch selector with label', () => {
			render(<BranchSelector {...defaultProps} />);

			expect(screen.getByText('Test Branch')).toBeInTheDocument();
		});

		test('should show loading state when isLoading is true', () => {
			render(<BranchSelector {...defaultProps} isLoading={true} disabled={false} />);

			// The summary element acts as the dropdown button
			const dropdownButton = screen.getByText('Select branch').closest('summary');
			fireEvent.click(dropdownButton);

			expect(screen.getByText('Loading...')).toBeInTheDocument();
		});

		test('should show disabled state when disabled is true', () => {
			render(<BranchSelector {...defaultProps} disabled={true} />);

			expect(screen.getByText('No branches available')).toBeInTheDocument();
		});

		test('should call onBranchSelect when a branch is clicked', async () => {
			const user = userEvent.setup();
			const mockOnBranchSelect = jest.fn();

			render(<BranchSelector {...defaultProps} onBranchSelect={mockOnBranchSelect} disabled={false} />);

			// Open dropdown by clicking the summary element
			const dropdown = screen.getByText('Select branch').closest('summary');
			await user.click(dropdown);

			// Click on a branch
			const branchOption = screen.getByText('main');
			await user.click(branchOption);

			expect(mockOnBranchSelect).toHaveBeenCalledWith('main');
		});
	});

	describe('OutputSection Component', () => {
		const defaultProps = {
			outputContent: '',
			onClearOutput: jest.fn(),
			onCopyOutput: jest.fn(),
			onExportOutput: jest.fn(),
			reviewInProgress: false,
			reviewStats: null,
			estimatedInputTokens: 0,
		};

		test('should render output section controls', () => {
			render(<OutputSection {...defaultProps} />);

			expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
		});

		test('should call onClearOutput when clear button is clicked', async () => {
			const user = userEvent.setup();
			const mockOnClearOutput = jest.fn();

			render(<OutputSection {...defaultProps} onClearOutput={mockOnClearOutput} />);

			const clearButton = screen.getByRole('button', { name: /clear/i });
			await user.click(clearButton);

			expect(mockOnClearOutput).toHaveBeenCalled();
		});

		test('should call onCopyOutput when copy button is clicked', async () => {
			const user = userEvent.setup();
			const mockOnCopyOutput = jest.fn();

			render(<OutputSection {...defaultProps} onCopyOutput={mockOnCopyOutput} />);

			const copyButton = screen.getByRole('button', { name: /copy/i });
			await user.click(copyButton);

			expect(mockOnCopyOutput).toHaveBeenCalled();
		});

		test('should call onExportOutput when export button is clicked', async () => {
			const user = userEvent.setup();
			const mockOnExportOutput = jest.fn();

			render(<OutputSection {...defaultProps} onExportOutput={mockOnExportOutput} />);

			const exportButton = screen.getByRole('button', {
				name: /export/i,
			});
			await user.click(exportButton);

			expect(mockOnExportOutput).toHaveBeenCalled();
		});

		test('should display output content when provided', () => {
			const outputContent = '# Test Output\n\nThis is test content.';

			// Mock the marked library that's used for markdown rendering
			global.window.marked = {
				parse: jest.fn((content) => `<h1>Test Output</h1><p>This is test content.</p>`),
			};

			render(<OutputSection {...defaultProps} outputContent={outputContent} />);

			expect(screen.getByText('Test Output')).toBeInTheDocument();
		});
	});

	describe('ConfigModal Component', () => {
		const defaultProps = {
			isOpen: false,
			onClose: jest.fn(),
			onTestConnection: jest.fn(),
			testingConnection: false,
			connectionTestResult: null,
		};

		test('should not render when isOpen is false', () => {
			render(<ConfigModal {...defaultProps} />);

			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});

		test('should render when isOpen is true', () => {
			render(<ConfigModal {...defaultProps} isOpen={true} />);

			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		test('should call onClose when close button is clicked', async () => {
			const user = userEvent.setup();
			const mockOnClose = jest.fn();

			render(<ConfigModal {...defaultProps} isOpen={true} onClose={mockOnClose} />);

			const closeButton = screen.getByRole('button', { name: /close/i });
			await user.click(closeButton);

			expect(mockOnClose).toHaveBeenCalled();
		});

		test('should show testing state when testingConnection is true', () => {
			render(<ConfigModal {...defaultProps} isOpen={true} testingConnection={true} />);

			expect(screen.getByText(/testing/i)).toBeInTheDocument();
		});

		test('should show connection test result when provided', () => {
			const testResult = {
				success: true,
				message: 'Connection successful!',
				provider: 'Ollama',
			};

			render(<ConfigModal {...defaultProps} isOpen={true} connectionTestResult={testResult} />);

			expect(screen.getByText('Connection successful!')).toBeInTheDocument();
		});
	});

	describe('App Integration', () => {
		test('should render the main app components', () => {
			render(<App />);

			// Check for main sections
			expect(screen.getByText('Repository Path')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
		});

		test('should handle repository selection flow', async () => {
			const user = userEvent.setup();

			window.electronAPI.selectDirectory.mockResolvedValue('/test/repo');
			window.electronAPI.getGitBranches.mockResolvedValue(['main', 'feature']);

			render(<App />);

			const browseButton = screen.getByRole('button', {
				name: /browse/i,
			});
			await user.click(browseButton);

			await waitFor(() => {
				expect(window.electronAPI.selectDirectory).toHaveBeenCalled();
			});
		});

		test('should handle configuration modal', async () => {
			const user = userEvent.setup();

			render(<App />);

			// Open config modal
			const configButton = screen.getByRole('button', {
				name: /settings/i,
			});
			await user.click(configButton);

			// Should show modal
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});
	});

	describe('Error Handling', () => {
		test('should handle repository selection error gracefully', async () => {
			const user = userEvent.setup();
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

			window.electronAPI.selectDirectory.mockRejectedValue(new Error('Permission denied'));

			render(
				<RepositorySection
					{...{
						onRepoPathChange: jest.fn(),
						onBranchChange: jest.fn(),
						onStartReview: jest.fn(),
						onStopReview: jest.fn(),
						reviewInProgress: false,
						onOpenConfig: jest.fn(),
						estimatedInputTokens: 0,
					}}
				/>
			);

			const browseButton = screen.getByRole('button', {
				name: /browse/i,
			});
			await user.click(browseButton);

			// Just verify the error didn't crash the component
			expect(browseButton).toBeInTheDocument();

			consoleSpy.mockRestore();
		});

		test('should handle branch loading error gracefully', async () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

			window.electronAPI.selectDirectory.mockResolvedValue('/test/repo');
			window.electronAPI.getGitBranches.mockRejectedValue(new Error('Git error'));

			const onRepoPathChange = jest.fn();

			render(
				<RepositorySection
					{...{
						onRepoPathChange,
						onBranchChange: jest.fn(),
						onStartReview: jest.fn(),
						onStopReview: jest.fn(),
						reviewInProgress: false,
						onOpenConfig: jest.fn(),
						estimatedInputTokens: 0,
					}}
				/>
			);

			const browseButton = screen.getByRole('button', {
				name: /browse/i,
			});
			const user = userEvent.setup();
			await user.click(browseButton);

			// Component should still be functional after error
			expect(browseButton).toBeInTheDocument();

			consoleSpy.mockRestore();
		});
	});

	describe('Accessibility', () => {
		test('should have proper ARIA labels and roles', () => {
			render(<App />);

			// Check for main landmarks
			expect(screen.getByRole('main')).toBeInTheDocument();

			// Check for form controls
			expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
		});

		test('should have proper form labels', () => {
			render(
				<RepositorySection
					{...{
						onRepoPathChange: jest.fn(),
						onBranchChange: jest.fn(),
						onStartReview: jest.fn(),
						onStopReview: jest.fn(),
						reviewInProgress: false,
						onOpenConfig: jest.fn(),
						estimatedInputTokens: 0,
					}}
				/>
			);

			expect(screen.getByText('Repository Path')).toBeInTheDocument();
		});

		test('should support keyboard navigation', async () => {
			const user = userEvent.setup();

			render(<App />);

			// Tab navigation should work - first focusable element is the settings button
			await user.tab();
			expect(screen.getByRole('button', { name: /settings/i })).toHaveFocus();
		});
	});
});
