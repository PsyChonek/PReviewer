# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PReviewer is an Electron application that uses local AI models (via Ollama) to analyze Git repository changes and provide intelligent code review feedback. The project uses modern React with TypeScript, DaisyUI for styling, and Vite for building.

## Key Commands

### Development
- `npm start` - Start the Electron app in development mode with hot-reloading
- `npx @tailwindcss/cli@latest -i src/styles.css -o src/compiled-styles.css --watch` - Watch and compile Tailwind CSS

### Testing
- `npm test` - Run all Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run test:unit` - Run unit tests only (tests/unit/*)
- `npm run test:integration` - Run integration tests only (tests/integration/*)
- `npm run test:e2e` - Run E2E tests with Playwright

### Building & Packaging
- `npm run package` - Package the app for distribution
- `npm run make` - Create distributable packages
- `npm run publish` - Publish the app

## Architecture

### Electron Structure
- **Main Process** (`main.js`): Handles window creation, IPC communication, and system integrations
- **Renderer Process** (`src/`): React application with TypeScript
- **Preload Script** (`src/preload.js`): Secure bridge between main and renderer processes

### Build Configuration
- **Vite**: Used for both main and renderer processes with separate config files:
  - `vite.main.config.js` - Main process bundling
  - `vite.renderer.config.js` - Renderer process with React
  - `vite.preload.config.js` - Preload script bundling
- **Electron Forge**: Packaging and distribution via `forge.config.js`

### Frontend Architecture
- **React 19** with TypeScript and functional components
- **State Management**: Local state with React hooks, localStorage for persistence
- **Styling**: DaisyUI 5 + Tailwind CSS 4 (note: no tailwind.config.js in v4)
- **Components**: Modular structure in `src/components/`
  - `Navbar.tsx` - Top navigation and configuration
  - `RepositorySection.tsx` - Git repository selection and branch management
  - `OutputSection.tsx` - AI review results display

### Key Dependencies
- **AI Integration**: OpenAI client for Azure OpenAI, Axios for Ollama API
- **Git Operations**: simple-git for repository interactions
- **Markdown**: marked library for rendering review output
- **Icons**: Font Awesome for UI icons

### Testing Strategy
- **Jest Configuration**: Multi-project setup with different environments:
  - Unit tests: Node environment
  - Integration tests: Node environment
  - Renderer tests: JSDOM environment
- **E2E Testing**: Playwright for end-to-end testing
- **Test Structure**: Tests organized by type in `tests/` directory

### CSS/Styling Guidelines
- Uses DaisyUI 5 with Tailwind CSS 4
- CSS compiled from `src/styles.css` to `src/compiled-styles.css`
- Follow DaisyUI component patterns and semantic color names
- Responsive design with `sm:`, `lg:` prefixes
- No custom CSS needed - use DaisyUI classes and Tailwind utilities

## Important Notes

### IPC Communication
The app uses Electron IPC for secure communication between processes. Main functionality includes:
- Git repository operations
- AI API calls to Ollama/Azure OpenAI
- File system operations

### Development Dependencies
- Requires Ollama running locally for AI functionality
- Git must be available in PATH for repository operations
- Node.js 18+ required for development

### Configuration Storage
- AI provider settings stored in localStorage
- Repository paths and branch selections maintained in application state
- Debug mode and other preferences persist across sessions