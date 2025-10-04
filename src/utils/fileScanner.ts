import fs from 'fs/promises';
import path from 'path';
import { ScannedFile, ScanOptions } from '../types';

const DEFAULT_OPTIONS: Required<ScanOptions> = {
	includePatterns: ['.cs', '.sql', '.ts', '.tsx', '.js', '.jsx', '.json', '.md'],
	excludePatterns: ['**/node_modules/**', '**/bin/**', '**/obj/**', '**/.git/**', '**/dist/**', '**/out/**', '**/.vite/**'],
	maxFileSize: 1000000, // 1MB
	maxTotalFiles: 100,
};

/**
 * Check if a path matches any of the exclude patterns
 */
function matchesPattern(filePath: string, patterns: string[]): boolean {
	return patterns.some((pattern) => {
		// Convert glob pattern to regex (simple implementation)
		const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.'));
		return regex.test(filePath);
	});
}

/**
 * Check if file extension is in the include list
 */
function hasValidExtension(filePath: string, includePatterns: string[]): boolean {
	const ext = path.extname(filePath);
	return includePatterns.includes(ext);
}

/**
 * Recursively scan a directory and collect files
 */
async function scanDirectory(dirPath: string, baseDir: string, options: Required<ScanOptions>, scannedFiles: ScannedFile[]): Promise<void> {
	// Stop if we've reached the file limit
	if (scannedFiles.length >= options.maxTotalFiles) {
		return;
	}

	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);
			const relativePath = path.relative(baseDir, fullPath);

			// Check exclude patterns
			if (matchesPattern(relativePath, options.excludePatterns)) {
				continue;
			}

			if (entry.isDirectory()) {
				// Recursively scan subdirectories
				await scanDirectory(fullPath, baseDir, options, scannedFiles);
			} else if (entry.isFile()) {
				// Check if we've hit the file limit
				if (scannedFiles.length >= options.maxTotalFiles) {
					break;
				}

				// Check if file has valid extension
				if (!hasValidExtension(fullPath, options.includePatterns)) {
					continue;
				}

				try {
					const stats = await fs.stat(fullPath);

					// Skip files that are too large
					if (stats.size > options.maxFileSize) {
						console.log(`Skipping large file: ${relativePath} (${stats.size} bytes)`);
						continue;
					}

					// Read file content
					const content = await fs.readFile(fullPath, 'utf8');

					scannedFiles.push({
						path: fullPath,
						relativePath,
						content,
						size: stats.size,
						extension: path.extname(fullPath),
					});
				} catch (error) {
					console.error(`Error reading file ${relativePath}:`, error);
					// Continue with other files even if one fails
				}
			}
		}
	} catch (error) {
		console.error(`Error scanning directory ${dirPath}:`, error);
		throw error;
	}
}

/**
 * Scan a worktree directory and return all relevant source files
 */
export async function scanWorktree(worktreePath: string, options: Partial<ScanOptions> = {}): Promise<ScannedFile[]> {
	const mergedOptions: Required<ScanOptions> = {
		...DEFAULT_OPTIONS,
		...options,
	};

	const scannedFiles: ScannedFile[] = [];

	console.log('Scanning worktree:', worktreePath);
	console.log('Options:', mergedOptions);

	await scanDirectory(worktreePath, worktreePath, mergedOptions, scannedFiles);

	console.log(`Scanned ${scannedFiles.length} files from worktree`);

	return scannedFiles;
}

/**
 * Scan specific files in a worktree (used when we have a list of changed files from git diff)
 */
export async function scanSpecificFiles(worktreePath: string, filePaths: string[]): Promise<ScannedFile[]> {
	const scannedFiles: ScannedFile[] = [];

	console.log(`Scanning ${filePaths.length} specific files in worktree:`, worktreePath);

	for (const relativePath of filePaths) {
		try {
			const fullPath = path.join(worktreePath, relativePath);

			// Check if file exists
			try {
				await fs.access(fullPath);
			} catch {
				console.log(`File not found (may be deleted): ${relativePath}`);
				continue;
			}

			const stats = await fs.stat(fullPath);

			// Skip if it's a directory
			if (stats.isDirectory()) {
				continue;
			}

			// Skip very large files
			if (stats.size > 1000000) {
				console.log(`Skipping large file: ${relativePath} (${stats.size} bytes)`);
				continue;
			}

			// Read file content
			const content = await fs.readFile(fullPath, 'utf8');

			scannedFiles.push({
				path: fullPath,
				relativePath,
				content,
				size: stats.size,
				extension: path.extname(fullPath),
			});
		} catch (error) {
			console.error(`Error reading file ${relativePath}:`, error);
			// Continue with other files even if one fails
		}
	}

	console.log(`Successfully scanned ${scannedFiles.length} files`);

	return scannedFiles;
}

/**
 * Calculate total size of scanned files
 */
export function calculateTotalSize(files: ScannedFile[]): number {
	return files.reduce((total, file) => total + file.size, 0);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
