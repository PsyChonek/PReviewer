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

export function buildPrompt(diff: string, basePrompt: string | null = null, userPrompt: string | null = null): string {
	let prompt = basePrompt || DEFAULT_BASE_PROMPT;

	if (userPrompt && userPrompt.trim()) {
		prompt += '\n\nAdditional Instructions:\n' + userPrompt.trim();
	}

	prompt += '\n---\nDiff:\n{diff}\n---\nReview:\n';

	return prompt.replace('{diff}', diff);
}
