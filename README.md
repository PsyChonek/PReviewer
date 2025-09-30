# PReviewer

Get AI-powered code reviews for your Git branches. Works locally with Ollama or Azure OpenAI.

## What it does

Point PReviewer at your Git repo, select two branches, and get detailed feedback on your changes. The AI analyzes code quality, spots potential bugs, suggests improvements, and highlights security issues.

Built with Electron, React, and TypeScript. Runs on Windows, macOS, and Linux.

## Setup

You need Node.js 18+ and Git installed.

### AI Provider

**Option 1: Ollama (local, free)**
- Install from [ollama.com](https://ollama.com/)
- Run `ollama serve` and `ollama pull codellama`

**Option 2: Azure OpenAI (cloud)**
- Configure your endpoint and API key in Settings after launching the app

### Install PReviewer

Download the latest release from [Releases](https://github.com/PsyChonek/PReviewer/releases) page.

Or build from source:
```bash
git clone https://github.com/PsyChonek/PReviewer.git
cd PReviewer
npm install
npm start
```

### Commands

- `npm start` - Run the app
- `npm run package` - Build for your OS
- `npm run make` - Create installer
- `npm test` - Run tests
- `npm run check` - Lint, format, and type-check

## How to use

1. Make sure Ollama is running (`ollama serve`)
2. Launch PReviewer (`npm start`)
3. Browse to your Git repo
4. Pick your feature branch and main branch
5. Click "Start AI Review"
6. Wait for the analysis (watch the progress bar)
7. Read the feedback and export if you want

For Azure OpenAI instead of Ollama, open Settings and configure your endpoint and API key.

## Common issues

**"Can't connect to Ollama"**
- Run `ollama serve` in a terminal
- Check if the model is installed: `ollama list`
- Default URL is `http://localhost:11434/api/generate`

**"Not a Git repository"**
- Make sure the folder has a `.git` directory
- Check that Git is in your PATH: `git --version`

**App won't start**
- Update Node.js to 18 or newer
- Delete `node_modules` and run `npm install` again
- Try `npm cache clean --force`

## Tech stack

- Electron + React 19 + TypeScript
- DaisyUI + Tailwind CSS
- Zustand for state
- simple-git for Git operations
- Vite + Electron Forge for building

## License

MIT - do whatever you want with it.
