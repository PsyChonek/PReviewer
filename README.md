# PReviewer - Local AI-Powered Pull Request Reviewer

A desktop application that uses local AI models (via Ollama) to analyze Git repository changes and provide intelligent code review feedback. Available in two versions: a Python/Tkinter application and a modern Electron application with DaisyUI styling.

## 🚀 Features

- **Local AI Analysis**: Uses Ollama to run AI models locally for privacy and security
- **Git Integration**: Seamlessly works with any Git repository
- **Branch Comparison**: Compare changes between any two branches or commits
- **Modern UI**: Clean, GitHub-inspired interface with syntax highlighting
- **Export Options**: Save review results to text or markdown files
- **Progress Tracking**: Real-time status updates and progress indicators
- **Comprehensive Output**: Detailed analysis with formatted feedback
- **Two Application Versions**:
  - **Python/Tkinter**: Classic desktop application
  - **Electron**: Modern web-based UI with DaisyUI and Tailwind CSS

## 📋 Description

PReviewer is a desktop GUI application that automates code review processes by leveraging local AI models. It's available in two versions:

**Python/Tkinter Version**: A traditional desktop application built with Python and Tkinter.

**Electron Version**: A modern web-based application built with Electron, featuring DaisyUI components and Tailwind CSS for a sleek, responsive interface.

Both versions analyze Git diffs between branches and provide detailed feedback on:

- **Code Quality**: Identifies potential bugs, security vulnerabilities, and performance issues
- **Best Practices**: Suggests improvements based on coding standards
- **Architecture Review**: Evaluates code structure and design patterns
- **Security Analysis**: Highlights potential security risks in code changes

The application works entirely locally using Ollama, ensuring your code never leaves your machine while still providing powerful AI-driven insights.

## 🛠️ Setup Instructions

### Prerequisites

- **Python 3.8+** with Tkinter support (for Python version)
- **Node.js 18+** and **npm** (for Electron version)
- **Git** installed and accessible from command line
- **Ollama** for running local AI models

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

Choose between the Python/Tkinter version or the modern Electron version:

#### Option A: Python/Tkinter Version

##### Using pip (recommended)

```bash
# Clone the repository
git clone https://github.com/PsyChonek/PReviewer.git
cd PReviewer

# Install required packages
pip install requests

# Run the application
python3 pr_reviwer_app.py
```

##### Using virtual environment

```bash
# Create virtual environment
python3 -m venv prereviewer_env
source prereviewer_env/bin/activate  # On Windows: prereviewer_env\Scripts\activate

# Install dependencies
pip install requests

# Run the application
python3 pr_reviwer_app.py
```

#### Option B: Electron Version (Recommended)

```bash
# Clone the repository
git clone https://github.com/PsyChonek/PReviewer.git
cd PReviewer/electron-previewer

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or build and run in production mode
npm start
```

### 4. Fix Tkinter Issues (macOS with pyenv)

If you encounter `ModuleNotFoundError: No module named '_tkinter'` on macOS:

1. **Install Tcl/Tk using Homebrew:**

   ```sh
   brew install tcl-tk@8
   ```

2. **Set environment variables:**

   ```sh
   export LDFLAGS="-L$(brew --prefix tcl-tk)/lib"
   export CPPFLAGS="-I$(brew --prefix tcl-tk)/include"
   export PKG_CONFIG_PATH="$(brew --prefix tcl-tk)/lib/pkgconfig"
   export PATH="$(brew --prefix tcl-tk)/bin:$PATH"
   ```

3. **Reinstall Python with Tk support:**

   ```sh
   env PYTHON_CONFIGURE_OPTS="--with-tcltk-includes='-I$(brew --prefix tcl-tk)/include' --with-tcltk-libs='-L$(brew --prefix tcl-tk)/lib -ltcl8.6 -ltk8.6'" pyenv install 3.12.2
   ```

4. **Set the Python version:**

   ```sh
   pyenv global 3.12.2
   ```

## 🎯 How to Use

### Using the Python/Tkinter Application

1. **Start Ollama**: Ensure Ollama is running with `ollama serve`
2. **Launch PReviewer**: Run `python3 pr_reviwer_app.py`
3. **Configure Settings**:
   - Ollama URL (default: `http://localhost:11434/api/generate`)
   - AI Model (e.g., `codellama`, `mistral`, `phi3:mini`)
4. **Select Repository**: Browse and select your Git repository folder
5. **Choose Branches**:
   - **From Branch**: Branch containing new changes to review
   - **To Branch**: Target branch (usually `main` or `master`)
6. **Start Review**: Click "🚀 Start AI Review" to analyze the changes

### Using the Electron Application

1. **Start Ollama**: Ensure Ollama is running with `ollama serve`
2. **Launch PReviewer**: Run `npm run dev` or `npm start`
3. **Configure Settings**:
   - Ollama URL (default: `http://localhost:11434/api/generate`)
   - AI Model (choose from available models)
4. **Select Repository**: Click "Browse" to select your Git repository folder
5. **Choose Branches**: Select from and to branches using the dropdowns
6. **Start Review**: Click "Start AI Review" to analyze the changes

Both versions provide the same core functionality with different user interfaces.

## 🔧 Configuration

### Python/Tkinter Configuration

The application allows you to configure:

- **Ollama API URL**: Default is `http://localhost:11434/api/generate`
- **AI Model**: Choose from downloaded models (codellama, mistral, phi3:mini, etc.)
- **Repository Path**: Any local Git repository
- **Branch Selection**: Any local branches in the repository

### Electron Configuration

The Electron version includes additional configuration options and npm scripts:

**Available npm scripts:**

- `npm run dev`: Development mode with hot-reloading and Tailwind CSS watching
- `npm start`: Production mode with optimized CSS build
- `npm run build-css`: Build and watch Tailwind CSS in development
- `npm run build-css-prod`: Build optimized CSS for production
- `npm run build`: Create distributable packages (requires electron-builder setup)

**Dependencies:**

- **Runtime**: Axios for HTTP requests, Simple-git for Git operations
- **Development**: Tailwind CSS, DaisyUI, Electron, and development tools

## 🎨 Features Overview

### Python/Tkinter Application

- **Modern UI**: GitHub-inspired design with clean, intuitive interface
- **Syntax Highlighting**: Colored output for different types of feedback
- **Progress Indicators**: Real-time updates on analysis progress
- **Export Functionality**: Save results to text or markdown files
- **Clipboard Integration**: Copy results with one click
- **Context Menus**: Right-click for additional options
- **Error Handling**: Comprehensive error messages and troubleshooting tips

### Electron Application

- **Modern Web UI**: Built with DaisyUI and Tailwind CSS
- **Responsive Design**: Adapts to different window sizes
- **Real-time Updates**: Live progress tracking during analysis
- **Enhanced UX**: Smooth animations and modern components
- **Export Functionality**: Save results in multiple formats
- **Cross-platform**: Runs on Windows, macOS, and Linux

## 🚨 Troubleshooting

### Common Issues (Both Versions)

#### Ollama Connection Issues

- Ensure Ollama is running: `ollama serve`
- Verify the model is downloaded: `ollama list`
- Check the API URL in the configuration

#### Git Repository Issues

- Ensure the selected folder is a Git repository (contains `.git` folder)
- Verify branches exist locally using `git branch`

### Python/Tkinter Specific Issues

#### Python/Tkinter Issues

- Follow the macOS Tkinter setup instructions above
- Ensure Python 3.8+ is installed
- Install required packages: `pip install requests`

### Electron Specific Issues

#### Node.js and npm Issues

- Ensure Node.js 18+ is installed: `node --version`
- Clear npm cache if installation fails: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

#### Build Issues

- For CSS build issues, ensure Tailwind CSS is properly installed
- If development mode doesn't work, try running `npm run build-css-prod` first

## 📝 License

This project is open source. Feel free to contribute, fork, or modify as needed.
