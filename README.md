# PReviewer - Local AI-Powered Code Review Tool

A modern Electron desktop application that uses local AI models (via Ollama or Azure OpenAI) to analyze Git repository changes and provide intelligent code review feedback. Built with React 19, TypeScript, and DaisyUI for a sleek, responsive interface.

## 🚀 Features

- **Local AI Analysis**: Uses Ollama for privacy-focused local AI processing
- **Azure OpenAI Integration**: Optional cloud-based AI analysis support
- **Git Integration**: Seamlessly works with any Git repository
- **Branch Comparison**: Compare changes between any two branches or commits
- **Modern UI**: Clean interface built with React 19, TypeScript, and DaisyUI
- **Export Options**: Save review results to text or markdown files
- **Progress Tracking**: Real-time status updates and progress indicators
- **Comprehensive Output**: Detailed analysis with formatted feedback and syntax highlighting
- **Cross-Platform**: Runs on Windows, macOS, and Linux

## 📋 Description

PReviewer is a modern desktop application built with Electron that automates code review processes by leveraging local AI models. The application provides intelligent analysis of Git repository changes with detailed feedback on:

- **Code Quality**: Identifies potential bugs, security vulnerabilities, and performance issues
- **Best Practices**: Suggests improvements based on coding standards
- **Architecture Review**: Evaluates code structure and design patterns
- **Security Analysis**: Highlights potential security risks in code changes

The application prioritizes privacy by working locally with Ollama, ensuring your code never leaves your machine while still providing powerful AI-driven insights. Azure OpenAI integration is available for teams that prefer cloud-based analysis.

## 🛠️ Setup Instructions

### Prerequisites

- **Node.js 18+** and **npm**
- **Git** installed and accessible from command line
- **Ollama** for running local AI models (optional: Azure OpenAI for cloud-based analysis)

### 1. Install Ollama

#### macOS

```bash
# Install via Homebrew
brew install ollama

# Or download from https://ollama.ai/
```

#### Linux

```bash
# Install via curl
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Windows

Download and install from [https://ollama.ai/](https://ollama.ai/)

### 2. Download an AI Model

Start Ollama and download a code analysis model:

```bash
# Start Ollama service
ollama serve

# In a new terminal, download a model (choose one):
ollama pull codellama        # Recommended for code review
ollama pull mistral          # Alternative general-purpose model
ollama pull phi3:mini        # Lightweight option
```

### 3. Setup Application

```bash
# Clone the repository
git clone https://github.com/PsyChonek/PReviewer.git
cd PReviewer

# Install dependencies
npm install

# Start development with hot-reloading
npm start

# Or package for distribution
npm run package
```

### 4. Development Commands

- `npm start` - Start the Electron app in development mode with hot-reloading (CSS compilation automatic)
- `npm test` - Run all Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:e2e` - Run E2E tests with Playwright
- `npm run package` - Package the app for distribution
- `npm run make` - Create distributable packages

## 🎯 How to Use

1. **Start AI Service**:
   - For local analysis: Ensure Ollama is running with `ollama serve`
   - For cloud analysis: Configure Azure OpenAI credentials in settings
2. **Launch PReviewer**: Run `npm start`
3. **Configure Settings**:
   - Choose AI provider (Ollama or Azure OpenAI)
   - Select AI model from available options
   - Set API URLs and credentials as needed
4. **Select Repository**: Click "Browse" to select your Git repository folder
5. **Choose Branches**: Select from and to branches using the dropdowns
6. **Start Review**: Click "Start AI Review" to analyze the changes
7. **View Results**: Review the detailed analysis with syntax highlighting and export options

## 🔧 Configuration

### AI Provider Settings

**Ollama (Local)**:
- API URL: `http://localhost:11434/api/generate`
- Models: codellama, mistral, phi3:mini, and other installed models

**Azure OpenAI (Cloud)**:
- API URL: Your Azure OpenAI endpoint
- API Key: Your Azure OpenAI API key
- Models: GPT-4, GPT-3.5-turbo, and other deployed models

### Application Architecture

**Built with:**
- **Frontend**: React 19 with TypeScript and functional components
- **Styling**: DaisyUI 5 + Tailwind CSS 4
- **Desktop Framework**: Electron with secure IPC communication
- **Git Operations**: simple-git library
- **Build System**: Vite for bundling and Electron Forge for packaging

**Configuration Storage:**
- AI provider settings: localStorage
- Repository paths and preferences: Application state
- Debug mode and other settings: Persistent across sessions

## 🎨 Application Features

- **Modern React UI**: Built with React 19, TypeScript, and DaisyUI components
- **Responsive Design**: Adapts to different window sizes and screen resolutions
- **Real-time Progress**: Live updates and progress tracking during AI analysis
- **Syntax Highlighting**: Colored output for code reviews using the marked library
- **Multiple Export Formats**: Save results to text or markdown files
- **Secure IPC**: Safe communication between Electron processes
- **Cross-platform**: Runs natively on Windows, macOS, and Linux
- **Git Integration**: Full branch management and diff analysis
- **Error Handling**: Comprehensive error messages and user guidance
- **Settings Persistence**: Configuration saved across application sessions

## 🚨 Troubleshooting

### AI Connection Issues

**Ollama Connection:**
- Ensure Ollama is running: `ollama serve`
- Verify the model is downloaded: `ollama list`
- Check the API URL in settings (default: `http://localhost:11434/api/generate`)

**Azure OpenAI Connection:**
- Verify your API key and endpoint are correct
- Ensure your Azure OpenAI deployment is active
- Check network connectivity and firewall settings

### Git Repository Issues

- Ensure the selected folder is a Git repository (contains `.git` folder)
- Verify branches exist locally using `git branch`
- Check that Git is installed and accessible from command line

### Application Issues

**Installation Problems:**
- Ensure Node.js 18+ is installed: `node --version`
- Clear npm cache if installation fails: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

**Build/Development Issues:**
- CSS compilation is handled automatically by Vite with Tailwind CSS plugin
- For styling issues, check the `src/index.css` file and DaisyUI configuration
- Check console logs in the Electron DevTools for runtime errors
- If Vite build fails, ensure all dependencies are installed and Node.js 18+ is being used

**Testing Issues:**
- Ensure all dependencies are installed: `npm install`
- For test failures, run `npm test` to see detailed error messages
- Check Jest configuration in `package.json` and test files in `tests/` directory

## 📝 License

This project is open source. Feel free to contribute, fork, or modify as needed.
