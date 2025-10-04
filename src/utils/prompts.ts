export const DEFAULT_BASE_PROMPT = `You are an expert code reviewer. Analyze the following code changes (diff format).
Identify potential bugs, security vulnerabilities, performance issues, and suggest improvements
based on best practices. Focus on the *newly added or modified lines*.
Provide concise, actionable feedback. If no issues, state 'No major issues found.'.

Consider the context of a C# and SQL development environment.

**IMPORTANT: Format your response using Markdown with the following structure:**
- Use ## for main sections (e.g., ## Summary, ## Issues Found, ## Recommendations)
- Use ### for subsections
- Use **bold** for important points
- Use \`code\` for inline code references
- Use \`\`\`language blocks for code examples
- Use bullet points (-) for lists
- Use > for important warnings or notes
- Include line numbers when referencing specific changes

Example format:
## Summary
Brief overview of the changes reviewed.

## Issues Found
### 🚨 Critical Issues
- **Security vulnerability on line 42**: Description
### ⚠️ Potential Issues
- **Performance concern on line 18**: Description

## Recommendations
- Suggestion 1
- Suggestion 2`;

export const DEFAULT_WORKTREE_PROMPT = `You are an expert code reviewer. Analyze the following source files from a feature branch.

Review the code for:
- Potential bugs and logic errors
- Security vulnerabilities (SQL injection, XSS, auth issues, etc.)
- Performance issues and inefficiencies
- Code quality and adherence to best practices
- Architecture and design patterns
- Error handling and edge cases

Consider the context of a C# and SQL development environment.

**IMPORTANT: Format your response using Markdown with the following structure:**
- Use ## for main sections (e.g., ## Summary, ## Issues Found, ## Recommendations)
- Use ### for file-specific sections (use the file path as heading)
- Use **bold** for important points
- Use \`code\` for inline code references
- Use \`\`\`language blocks for code examples
- Use bullet points (-) for lists
- Use > for important warnings or notes
- Reference specific file paths and line numbers when identifying issues

Example format:
## Summary
Brief overview of the codebase reviewed.

## Issues Found
### 🚨 Critical Issues
- **[src/UserService.cs:42]** Security vulnerability: SQL injection risk
### ⚠️ Potential Issues
- **[src/ProductController.cs:18]** Performance concern: N+1 query pattern

## Recommendations
- Suggestion 1
- Suggestion 2`;

export function buildPrompt(diff: string, basePrompt: string | null = null, userPrompt: string | null = null): string {
	let prompt = basePrompt || DEFAULT_BASE_PROMPT;

	if (userPrompt && userPrompt.trim()) {
		prompt += '\n\nAdditional Instructions:\n' + userPrompt.trim();
	}

	prompt += '\n---\nDiff:\n{diff}\n---\nReview:\n';

	return prompt.replace('{diff}', diff);
}

export function buildWorktreePrompt(
	files: { path: string; relativePath: string; content: string; extension: string }[],
	basePrompt: string | null = null,
	userPrompt: string | null = null
): string {
	let prompt = basePrompt || DEFAULT_WORKTREE_PROMPT;

	if (userPrompt && userPrompt.trim()) {
		prompt += '\n\nAdditional Instructions:\n' + userPrompt.trim();
	}

	prompt += '\n---\nSource Files:\n\n';

	for (const file of files) {
		// Determine language for syntax highlighting
		let language = file.extension.replace('.', '');
		if (language === 'tsx' || language === 'jsx') language = 'typescript';
		if (language === 'cs') language = 'csharp';

		prompt += `### File: ${file.relativePath}\n\`\`\`${language}\n${file.content}\n\`\`\`\n\n`;
	}

	prompt += '---\nReview:\n';

	return prompt;
}
