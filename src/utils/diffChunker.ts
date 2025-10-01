import { countTokens } from './tokenEstimation';

/**
 * Represents a chunk of a git diff
 */
export interface DiffChunk {
	content: string;
	tokenCount: number;
	fileCount: number;
	chunkIndex: number;
	totalChunks: number;
	files: string[];
}

/**
 * Configuration for diff chunking
 */
export interface ChunkConfig {
	maxTokensPerChunk: number;
	encoding: 'cl100k_base' | 'o200k_base';
	systemPromptTokens?: number; // Reserve tokens for system prompt
}

/**
 * Represents a single file in a diff
 */
interface DiffFile {
	header: string;
	content: string;
	fileName: string;
	tokenCount: number;
}

/**
 * Default chunk configuration for Azure OpenAI
 * 100k tokens/min limit - using 80k per chunk for safety
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
	maxTokensPerChunk: 80000,
	encoding: 'cl100k_base',
	systemPromptTokens: 1000, // Reserve for system prompt and overhead
};

/**
 * Parse a git diff into individual file diffs
 */
function parseDiffIntoFiles(diff: string): DiffFile[] {
	const files: DiffFile[] = [];
	const lines = diff.split('\n');

	let currentFile: DiffFile | null = null;
	let currentContent: string[] = [];
	let currentFileName = '';

	for (const line of lines) {
		// Check for new file header (diff --git or diff command)
		if (line.startsWith('diff --git') || (line.startsWith('diff ') && line.includes(' '))) {
			// Save previous file if exists
			if (currentFile) {
				currentFile.content = currentContent.join('\n');
				files.push(currentFile);
			}

			// Extract filename from diff header
			const match = line.match(/diff --git a\/(.*?) b\//);
			currentFileName = match ? match[1] : line.split(' ')[1] || 'unknown';

			// Start new file
			currentFile = {
				header: line,
				content: '',
				fileName: currentFileName,
				tokenCount: 0,
			};
			currentContent = [line];
		} else {
			// Add line to current file content
			if (currentFile) {
				currentContent.push(line);
			}
		}
	}

	// Save last file
	if (currentFile) {
		currentFile.content = currentContent.join('\n');
		files.push(currentFile);
	}

	return files;
}

/**
 * Calculate token count for each file
 */
function calculateFileTokens(files: DiffFile[], encoding: 'cl100k_base' | 'o200k_base'): void {
	for (const file of files) {
		file.tokenCount = countTokens(file.content, encoding);
	}
}

/**
 * Group files into chunks based on token limits
 */
function groupFilesIntoChunks(files: DiffFile[], config: ChunkConfig): DiffChunk[] {
	const chunks: DiffChunk[] = [];
	const effectiveMaxTokens = config.maxTokensPerChunk - (config.systemPromptTokens || 0);

	let currentChunkFiles: DiffFile[] = [];
	let currentChunkTokens = 0;

	for (const file of files) {
		// If adding this file would exceed the limit, create a new chunk
		if (currentChunkFiles.length > 0 && currentChunkTokens + file.tokenCount > effectiveMaxTokens) {
			// Save current chunk
			chunks.push(createChunk(currentChunkFiles, currentChunkTokens, chunks.length, 0));

			// Start new chunk
			currentChunkFiles = [file];
			currentChunkTokens = file.tokenCount;
		} else if (file.tokenCount > effectiveMaxTokens) {
			// Single file exceeds limit - split it
			const fileChunks = splitLargeFile(file, effectiveMaxTokens, config.encoding);
			for (const fileChunk of fileChunks) {
				chunks.push(createChunk([fileChunk], fileChunk.tokenCount, chunks.length, 0));
			}
		} else {
			// Add file to current chunk
			currentChunkFiles.push(file);
			currentChunkTokens += file.tokenCount;
		}
	}

	// Save last chunk
	if (currentChunkFiles.length > 0) {
		chunks.push(createChunk(currentChunkFiles, currentChunkTokens, chunks.length, 0));
	}

	// Update total chunks count
	const totalChunks = chunks.length;
	for (let i = 0; i < chunks.length; i++) {
		chunks[i].totalChunks = totalChunks;
	}

	return chunks;
}

/**
 * Create a chunk from a group of files
 */
function createChunk(files: DiffFile[], tokenCount: number, chunkIndex: number, totalChunks: number): DiffChunk {
	const content = files.map(f => f.content).join('\n\n');
	const fileNames = files.map(f => f.fileName);

	return {
		content,
		tokenCount,
		fileCount: files.length,
		chunkIndex,
		totalChunks,
		files: fileNames,
	};
}

/**
 * Split a large file into smaller chunks by hunks
 */
function splitLargeFile(file: DiffFile, maxTokens: number, encoding: 'cl100k_base' | 'o200k_base'): DiffFile[] {
	const chunks: DiffFile[] = [];
	const lines = file.content.split('\n');

	let currentChunk: string[] = [file.header];
	let currentTokens = countTokens(file.header, encoding);

	for (const line of lines.slice(1)) {
		const lineTokens = countTokens(line, encoding);

		if (currentTokens + lineTokens > maxTokens && currentChunk.length > 1) {
			// Save current chunk
			chunks.push({
				header: file.header,
				content: currentChunk.join('\n'),
				fileName: file.fileName,
				tokenCount: currentTokens,
			});

			// Start new chunk with header
			currentChunk = [file.header, line];
			currentTokens = countTokens(file.header, encoding) + lineTokens;
		} else {
			currentChunk.push(line);
			currentTokens += lineTokens;
		}
	}

	// Save last chunk
	if (currentChunk.length > 1) {
		chunks.push({
			header: file.header,
			content: currentChunk.join('\n'),
			fileName: file.fileName,
			tokenCount: currentTokens,
		});
	}

	return chunks;
}

/**
 * Check if a diff needs to be chunked
 */
export function needsChunking(diff: string, config: ChunkConfig = DEFAULT_CHUNK_CONFIG): boolean {
	const totalTokens = countTokens(diff, config.encoding);
	const effectiveMaxTokens = config.maxTokensPerChunk - (config.systemPromptTokens || 0);
	return totalTokens > effectiveMaxTokens;
}

/**
 * Chunk a git diff into smaller pieces based on token limits
 * @param diff - The git diff to chunk
 * @param config - Chunking configuration
 * @returns Array of diff chunks
 */
export function chunkDiff(diff: string, config: ChunkConfig = DEFAULT_CHUNK_CONFIG): DiffChunk[] {
	// Parse diff into files
	const files = parseDiffIntoFiles(diff);

	if (files.length === 0) {
		return [{
			content: diff,
			tokenCount: countTokens(diff, config.encoding),
			fileCount: 0,
			chunkIndex: 0,
			totalChunks: 1,
			files: [],
		}];
	}

	// Calculate token count for each file
	calculateFileTokens(files, config.encoding);

	// Group files into chunks
	const chunks = groupFilesIntoChunks(files, config);

	return chunks;
}

/**
 * Get chunk metadata without creating full chunks (for preview)
 */
export function getChunkMetadata(diff: string, config: ChunkConfig = DEFAULT_CHUNK_CONFIG): {
	needsChunking: boolean;
	totalTokens: number;
	estimatedChunks: number;
	effectiveMaxTokens: number;
} {
	const totalTokens = countTokens(diff, config.encoding);
	const effectiveMaxTokens = config.maxTokensPerChunk - (config.systemPromptTokens || 0);
	const needsChunkingFlag = totalTokens > effectiveMaxTokens;
	const estimatedChunks = needsChunkingFlag ? Math.ceil(totalTokens / effectiveMaxTokens) : 1;

	return {
		needsChunking: needsChunkingFlag,
		totalTokens,
		estimatedChunks,
		effectiveMaxTokens,
	};
}
