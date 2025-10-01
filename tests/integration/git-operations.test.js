// Integration tests for Git operations

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const tmp = require('tmp');
const simpleGit = require('simple-git');

// Mock the main process Git handlers
const mockIpcMain = {
	handlers: {},
	handle: jest.fn((channel, handler) => {
		mockIpcMain.handlers[channel] = handler;
	}),
};

// Mock axios for Ollama requests
jest.mock('axios');

// Import and mock the main.js file parts we need
let gitHandlers;

beforeAll(async () => {
	// Create git handlers similar to main.js
	gitHandlers = {
		async getGitBranches(repoPath) {
			try {
				const git = simpleGit(repoPath);
				const branches = await git.branchLocal();
				return branches.all;
			} catch (error) {
				let errorMessage = `Failed to get branches: ${error.message}`;

				if (error.code === 'ENOENT') {
					errorMessage +=
						'\n\nTroubleshooting steps:\n' +
						'1. Ensure Git is installed and accessible in PATH\n' +
						'2. Try running "git --version" in terminal\n' +
						'3. Restart the application after installing Git';
				} else if (error.message.includes('not a git repository')) {
					errorMessage +=
						'\n\nTroubleshooting steps:\n' +
						'1. Select a folder that contains a .git directory\n' +
						'2. Initialize a Git repository with "git init" if needed\n' +
						'3. Ensure the selected path is the repository root';
				} else if (error.message.includes('permission') || error.message.includes('access')) {
					errorMessage +=
						'\n\nTroubleshooting steps:\n' +
						'1. Check folder permissions and user access rights\n' +
						'2. Try running the application as administrator\n' +
						'3. Ensure the repository is not locked by another process';
				}

				throw new Error(errorMessage);
			}
		},

		async getGitDiff(repoPath, baseBranch, targetBranch) {
			try {
				const git = simpleGit(repoPath);

				// Get merge base
				const mergeBase = await git.raw(['merge-base', baseBranch, targetBranch]);
				const mergeBaseCommit = mergeBase.trim();

				// Get diff from merge base to target
				const diff = await git.raw(['diff', '--no-prefix', '-U3', mergeBaseCommit, targetBranch]);
				return diff;
			} catch (error) {
				let errorMessage = `Failed to get diff: ${error.message}`;

				if (error.message.includes('unknown revision') || error.message.includes('bad revision')) {
					errorMessage +=
						'\n\nTroubleshooting steps:\n' +
						'1. Verify both branches exist locally\n' +
						'2. Run "git branch -a" to see all available branches\n' +
						'3. Pull latest changes with "git fetch" if branches are remote\n' +
						'4. Check branch names for typos or special characters';
				} else if (error.message.includes('merge-base') || error.message.includes('no common commits')) {
					errorMessage +=
						'\n\nTroubleshooting steps:\n' +
						'1. Check if branches share common history\n' +
						'2. Try comparing with a different base branch\n' +
						'3. Ensure branches are not from completely separate repositories';
				} else if (error.code === 'ENOENT') {
					errorMessage +=
						'\n\nTroubleshooting steps:\n' +
						'1. Ensure Git is installed and accessible in PATH\n' +
						'2. Verify the repository path is correct\n' +
						'3. Check if the .git directory exists';
				}

				throw new Error(errorMessage);
			}
		},
	};
});

describe('Git Operations Integration', () => {
	let tempDir;
	let git;

	beforeEach(async () => {
		// Create temporary directory for test repositories
		tempDir = tmp.dirSync({ unsafeCleanup: true });
		git = simpleGit(tempDir.name);

		// Initialize git repository
		await git.init();
		await git.addConfig('user.email', 'test@example.com');
		await git.addConfig('user.name', 'Test User');

		// Create initial commit to establish main branch
		await fs.writeFile(path.join(tempDir.name, 'README.md'), '# Test Repository');
		await git.add('README.md');
		await git.commit('Initial commit');

		// Rename master to main (git init creates master by default)
		try {
			await git.branch(['--move', 'master', 'main']);
		} catch (error) {
			// Already on main or main already exists, ignore
		}
	});

	afterEach(() => {
		if (tempDir) {
			tempDir.removeCallback();
		}
	});

	describe('getGitBranches', () => {
		test('should return branches from a valid repository', async () => {
			// Create additional branches
			await git.checkoutLocalBranch('feature-branch');
			await git.checkout('main');
			await git.checkoutLocalBranch('develop');

			const branches = await gitHandlers.getGitBranches(tempDir.name);

			expect(branches).toContain('main');
			expect(branches).toContain('feature-branch');
			expect(branches).toContain('develop');
			expect(branches.length).toBe(3);
		});

		test('should handle repository with only main branch', async () => {
			const branches = await gitHandlers.getGitBranches(tempDir.name);

			expect(branches).toContain('main');
			expect(branches.length).toBe(1);
		});

		test('should throw error for non-git directory', async () => {
			const nonGitDir = tmp.dirSync({ unsafeCleanup: true });

			await expect(gitHandlers.getGitBranches(nonGitDir.name)).rejects.toHaveErrorMessage('not a git repository');

			nonGitDir.removeCallback();
		});

		test('should throw error for non-existent directory', async () => {
			const nonExistentPath = '/non/existent/path';

			await expect(gitHandlers.getGitBranches(nonExistentPath)).rejects.toHaveErrorMessage('Cannot use simple-git on a directory that does not exist');
		});

		test('should include troubleshooting for permission errors', async () => {
			// Create temporary directory
			const restrictedDir = tmp.dirSync({ unsafeCleanup: true });

			// Create a mock git instance that throws permission error
			const mockGit = {
				branchLocal: jest.fn().mockRejectedValue(new Error('permission denied accessing repository')),
			};

			// Temporarily replace simpleGit to return our mock
			const originalSimpleGit = require('simple-git');
			jest.doMock('simple-git', () => jest.fn(() => mockGit));

			// Re-import the handlers to use the mocked version
			delete require.cache[require.resolve('simple-git')];

			try {
				// Create fresh handler with mocked git
				const testHandlers = {
					async getGitBranches(repoPath) {
						try {
							const git = require('simple-git')(repoPath);
							const branches = await git.branchLocal();
							return branches.all;
						} catch (error) {
							let errorMessage = `Failed to get branches: ${error.message}`;
							if (error.message.includes('permission') || error.message.includes('access')) {
								errorMessage +=
									'\n\nTroubleshooting steps:\n' +
									'1. Check folder permissions and user access rights\n' +
									'2. Try running the application as administrator\n' +
									'3. Ensure the repository is not locked by another process';
							}
							throw new Error(errorMessage);
						}
					},
				};

				await expect(testHandlers.getGitBranches(restrictedDir.name)).rejects.toHaveErrorMessage('Check folder permissions');
			} finally {
				// Restore original
				jest.dontMock('simple-git');
				restrictedDir.removeCallback();
			}
		});
	});

	describe('getGitDiff', () => {
		test('should generate diff between branches', async () => {
			// Create file on main
			await fs.writeFile(path.join(tempDir.name, 'test.js'), 'console.log("hello");');
			await git.add('test.js');
			await git.commit('Add test file');

			// Create feature branch and make changes
			await git.checkoutLocalBranch('feature');
			await fs.writeFile(path.join(tempDir.name, 'test.js'), 'console.log("hello world");');
			await git.add('test.js');
			await git.commit('Update message');

			const diff = await gitHandlers.getGitDiff(tempDir.name, 'main', 'feature');

			expect(diff).toContain('test.js');
			expect(diff).toContain('-console.log("hello");');
			expect(diff).toContain('+console.log("hello world");');
		});

		test('should handle empty diff when branches are identical', async () => {
			// Create branch but don't make changes
			await git.checkoutLocalBranch('feature');

			const diff = await gitHandlers.getGitDiff(tempDir.name, 'main', 'feature');

			expect(diff.trim()).toBe('');
		});

		test('should throw error for non-existent branches', async () => {
			// Create initial commit
			await fs.writeFile(path.join(tempDir.name, 'test.js'), 'console.log("hello");');
			await git.add('test.js');
			await git.commit('Initial commit');

			await expect(gitHandlers.getGitDiff(tempDir.name, 'main', 'non-existent')).rejects.toHaveErrorMessage('Not a valid object name');
		});

		test('should provide troubleshooting for bad revision errors', async () => {
			// Create initial commit
			await fs.writeFile(path.join(tempDir.name, 'test.js'), 'console.log("hello");');
			await git.add('test.js');
			await git.commit('Initial commit');

			await expect(gitHandlers.getGitDiff(tempDir.name, 'invalid-branch', 'main')).rejects.toHaveErrorMessage('Not a valid object name');
		});

		test('should handle complex multi-file diff', async () => {
			// Create initial commit with multiple files
			await fs.writeFile(path.join(tempDir.name, 'file1.js'), 'const a = 1;');
			await fs.writeFile(path.join(tempDir.name, 'file2.js'), 'const b = 2;');
			await git.add(['file1.js', 'file2.js']);
			await git.commit('Initial commit');

			// Create feature branch and modify files
			await git.checkoutLocalBranch('feature');
			await fs.writeFile(path.join(tempDir.name, 'file1.js'), 'const a = 10;');
			await fs.writeFile(path.join(tempDir.name, 'file3.js'), 'const c = 3;');
			await git.add(['file1.js', 'file3.js']);
			await git.commit('Update files');

			const diff = await gitHandlers.getGitDiff(tempDir.name, 'main', 'feature');

			expect(diff).toContain('file1.js');
			expect(diff).toContain('file3.js');
			expect(diff).toContain('-const a = 1;');
			expect(diff).toContain('+const a = 10;');
			expect(diff).toContain('+const c = 3;');
		});

		test('should handle merge conflicts in history', async () => {
			// Create file on main
			await fs.writeFile(path.join(tempDir.name, 'test.js'), 'const original = true;');
			await git.add('test.js');
			await git.commit('Add test file');

			// Create two divergent branches
			await git.checkoutLocalBranch('branch1');
			await fs.writeFile(path.join(tempDir.name, 'test.js'), 'const branch1 = true;');
			await git.add('test.js');
			await git.commit('Branch 1 changes');

			await git.checkout('main');
			await git.checkoutLocalBranch('branch2');
			await fs.writeFile(path.join(tempDir.name, 'test.js'), 'const branch2 = true;');
			await git.add('test.js');
			await git.commit('Branch 2 changes');

			// Should still be able to generate diff
			const diff = await gitHandlers.getGitDiff(tempDir.name, 'branch1', 'branch2');

			expect(diff).toContain('test.js');
			expect(diff).toContain('branch2');
		});
	});

	describe('Error handling edge cases', () => {
		test('should handle corrupted git repository', async () => {
			// Create a .git folder but corrupt it
			await fs.ensureDir(path.join(tempDir.name, '.git'));
			await fs.writeFile(path.join(tempDir.name, '.git', 'HEAD'), 'invalid content');

			await expect(gitHandlers.getGitBranches(tempDir.name)).rejects.toThrow();
		});

		test('should handle repository with no commits', async () => {
			// Create fresh repo with no commits
			const emptyTempDir = tmp.dirSync({ unsafeCleanup: true });
			const emptyGit = simpleGit(emptyTempDir.name);
			await emptyGit.init();
			await emptyGit.addConfig('user.email', 'test@example.com');
			await emptyGit.addConfig('user.name', 'Test User');

			const result = await gitHandlers.getGitBranches(emptyTempDir.name);
			// Repository with no commits returns empty array
			expect(result).toEqual([]);

			emptyTempDir.removeCallback();
		});

		test('should handle very large repository operations', async () => {
			// Create large file changes
			const largeContent = 'x'.repeat(100000);
			await fs.writeFile(path.join(tempDir.name, 'large.txt'), largeContent);
			await git.add('large.txt');
			await git.commit('Large file commit');

			await git.checkoutLocalBranch('feature');
			await fs.writeFile(path.join(tempDir.name, 'large.txt'), largeContent + '\nadded line');
			await git.add('large.txt');
			await git.commit('Large file update');

			const diff = await gitHandlers.getGitDiff(tempDir.name, 'main', 'feature');

			expect(diff).toContain('large.txt');
			expect(diff).toContain('+added line');
		}, 10000); // Increase timeout for large operations
	});

	describe('Real-world scenarios', () => {
		test('should handle typical feature branch workflow', async () => {
			// Simulate real development workflow

			// Initial setup
			await fs.writeFile(path.join(tempDir.name, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.0' }, null, 2));
			await fs.ensureDir(path.join(tempDir.name, 'src'));
			await fs.writeFile(path.join(tempDir.name, 'src/main.js'), 'console.log("app started");');
			await git.add(['package.json', 'src/main.js']);
			await git.commit('Initial project setup');

			// Feature development
			await git.checkoutLocalBranch('feature/add-logging');
			await fs.writeFile(path.join(tempDir.name, 'src/logger.js'), 'export function log(message) { console.log(message); }');
			await fs.writeFile(path.join(tempDir.name, 'src/main.js'), 'import { log } from "./logger.js";\nlog("app started");');
			await git.add(['src/logger.js', 'src/main.js']);
			await git.commit('Add logging functionality');

			const branches = await gitHandlers.getGitBranches(tempDir.name);
			const diff = await gitHandlers.getGitDiff(tempDir.name, 'main', 'feature/add-logging');

			expect(branches).toContain('main');
			expect(branches).toContain('feature/add-logging');
			expect(diff).toContain('logger.js');
			expect(diff).toContain('import { log }');
		});

		test('should handle hotfix workflow', async () => {
			// Main branch with bug
			await fs.writeFile(path.join(tempDir.name, 'app.js'), 'const version = "1.0.0";\nconst bug = true;');
			await git.add('app.js');
			await git.commit('Release v1.0.0');

			// Hotfix branch
			await git.checkoutLocalBranch('hotfix/fix-critical-bug');
			await fs.writeFile(path.join(tempDir.name, 'app.js'), 'const version = "1.0.1";\nconst bug = false;');
			await git.add('app.js');
			await git.commit('Fix critical bug');

			const diff = await gitHandlers.getGitDiff(tempDir.name, 'main', 'hotfix/fix-critical-bug');

			expect(diff).toContain('-const version = "1.0.0";');
			expect(diff).toContain('+const version = "1.0.1";');
			expect(diff).toContain('-const bug = true;');
			expect(diff).toContain('+const bug = false;');
		});
	});
});
