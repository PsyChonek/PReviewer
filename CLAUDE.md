# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PReviewer is an Electron-based desktop application that provides AI-powered code review for Git repositories. It supports both local AI models via Ollama and cloud-based Azure OpenAI. The application is built with React 19, TypeScript, and uses DaisyUI/Tailwind CSS for styling.

## Development Commands

### Essential Commands

- `npm start` - Start development server (Vite dev server on port 3002 with hot reload)
- `npm run check` - Run linting, formatting, and TypeScript type checking (use before commits)
- `npm test` - Run all Jest unit tests
- `npm run test:watch` - Run tests in watch mode for active development
- `npm run test:unit` - Run only unit tests
- `npm run test:integration` - Run only integration tests
- `npm run test:e2e` - Run Playwright end-to-end tests

### Build Commands

- `npm run package` - Package the app for current platform (creates in `out/` directory)
- `npm run make` - Create distributable installers (Windows: Squirrel, macOS: DMG/ZIP, Linux: AppImage/DEB/RPM)

### Code Quality

- `npm run lint` - Check for ESLint errors
- `npm run lint:fix` - Auto-fix ESLint errors
- `npm run format` - Check Prettier formatting
- `npm run format:fix` - Auto-fix Prettier formatting

## Architecture

### Electron Process Structure

**Three-Process Architecture:**

1. **Main Process** (`src/main.ts`) - Node.js environment, handles:
   - Window management and app lifecycle
   - Git operations via `simple-git`
   - AI API communication (Ollama/Azure OpenAI)
   - File system operations
   - IPC handlers for renderer communication

2. **Preload Process** (`src/preload.ts`) - Secure bridge:
   - Exposes safe APIs to renderer via `contextBridge`
   - All renderer-to-main communication goes through here
   - Type-safe API definitions in `src/types.ts`

3. **Renderer Process** (`src/App.tsx` and components) - Browser environment:
   - React 19 application with TypeScript
   - Communicates with main process via `window.electronAPI`
   - No direct Node.js or Electron access

### State Management

**Zustand Stores** (persistent state in localStorage):

- `configStore.ts` - AI provider config, prompts, debug mode
- `tokenStore.ts` - Token usage tracking (current session + lifetime totals)
- `repositoryStore.ts` - Repository and branch selections
- `reviewStore.ts` - Review session state

**Local Component State:**

- Used for UI interactions, temporary data, and non-persistent state
- Main app state in `App.tsx` manages review progress and output

### Key Data Flows

**Review Process:**

1. User selects repository and branches in `RepositorySection`
2. `App.tsx` calls `window.electronAPI.getGitDiff()` → main process
3. Main process uses `simple-git` to generate diff
4. Main process sends diff to AI provider (Ollama or Azure OpenAI)
5. AI response streams back via IPC events (`ollama-progress`/`azure-ai-progress`)
6. `ProgressTracker` shows real-time updates (smooth 100ms intervals)
7. Final output rendered in `OutputSection` with markdown formatting

**Git Diff Logic:**

- Diff compares: `targetBranch` (main) → `baseBranch` (feature)
- Shows changes IN the feature branch relative to main
- Prefers local branches, falls back to remote if local doesn't exist
- Branch name normalization strips `remotes/origin/` prefixes

### Build System

**Vite Configuration:**

- `vite.main.config.js` - Main process bundling
- `vite.preload.config.js` - Preload script bundling
- `vite.renderer.config.js` - React renderer bundling with Tailwind CSS

**Electron Forge:**

- Handles packaging and distribution
- Entry points defined in `forge.config.js`
- Outputs to `out/` directory

## TypeScript

All Electron processes use TypeScript:

- Main process: ES6 modules with Node.js types
- Preload: ES6 modules with Electron types
- Renderer: React with JSX transform

Type definitions in `src/types.ts` define the contract between processes, especially the `window.electronAPI` interface.

## Styling

**DaisyUI + Tailwind CSS:**

- DaisyUI components for UI elements (buttons, cards, modals, progress bars)
- Tailwind CSS for custom styling and layouts
- Auto-compiled by Vite during development
- Main stylesheet: `src/index.css`

## IPC Communication

**Pattern:**

```typescript
// Renderer → Main (request/response)
const result = await window.electronAPI.methodName(args);

// Main → Renderer (events/streaming)
window.electronAPI.onEventName((event, data) => {
	// handle streaming data
});
```

**Key IPC Channels:**

- `select-directory` - Open folder picker
- `get-git-branches` - List repository branches
- `get-git-diff` - Calculate diff between branches
- `git-fetch` / `git-pull` - Git operations
- `call-ollama-api` - Send prompt to Ollama
- `call-azure-ai-api` - Send prompt to Azure OpenAI
- `ollama-progress` / `azure-ai-progress` - Streaming AI responses

## Important Conventions

### Branch Naming in UI

- **From Branch (Source)**: The feature branch with changes to review
- **To Branch (Target)**: The comparison branch (typically main/master)
- Diff shows: changes FROM target TO source (what's new in feature branch)

### ESLint Configuration

DOM types must be declared in `eslint.config.mjs` globals to avoid `no-undef` errors. Already includes: `HTMLDetailsElement`, `HTMLDivElement`, `MouseEvent`, `Node`.

### Progress Tracking

`ProgressTracker` component uses 100ms interval timer for smooth time/speed updates during reviews, not just on chunk arrival. Shows average speed when review completes.

### Token Estimation

- Estimated tokens calculated from diff size before review starts
- Actual tokens received from AI provider during/after review
- Both stored in Zustand `tokenStore` (session + lifetime)

## Testing

**Jest Configuration:**

- Config: `tests/jest.config.js`
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Uses `@testing-library/react` for component tests

**Playwright E2E:**

- Config: `tests/playwright.config.js`
- Tests full application workflows

## Git Workflow

When making commits, the repository uses:

- Prettier for code formatting (run via `npm run format:fix`)
- ESLint for code quality (run via `npm run lint:fix`)
- TypeScript for type checking (run via `npx tsc --noEmit`)

Always run `npm run check` before committing to ensure all checks pass.
