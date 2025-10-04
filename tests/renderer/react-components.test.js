import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Import components to test
import App from '../../src/App';
import RepositorySection from '../../src/components/repository/RepositorySection';
import BranchSelector from '../../src/components/repository/BranchSelector';
import OutputSection from '../../src/components/review/OutputSection';
import ConfigModal from '../../src/components/config/ConfigModal';

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

		test('should call onClose when cancel button is clicked', async () => {
			const user = userEvent.setup();
			const mockOnClose = jest.fn();

			render(<ConfigModal {...defaultProps} isOpen={true} onClose={mockOnClose} />);

			const cancelButton = screen.getByRole('button', { name: /cancel/i });
			await user.click(cancelButton);

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



});
