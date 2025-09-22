const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const simpleGit = require('simple-git');
const axios = require('axios');

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Optional icon
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('index.html');
  
  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// IPC handlers for file operations
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Git Repository'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// IPC handlers for Git operations
ipcMain.handle('get-git-branches', async (event, repoPath) => {
  try {
    const git = simpleGit(repoPath);
    const branches = await git.branchLocal();
    return branches.all;
  } catch (error) {
    let errorMessage = `Failed to get branches: ${error.message}`;

    if (error.code === 'ENOENT') {
      errorMessage += '\n\nTroubleshooting steps:\n' +
        '1. Ensure Git is installed and accessible in PATH\n' +
        '2. Try running "git --version" in terminal\n' +
        '3. Restart the application after installing Git';
    } else if (error.message.includes('not a git repository')) {
      errorMessage += '\n\nTroubleshooting steps:\n' +
        '1. Select a folder that contains a .git directory\n' +
        '2. Initialize a Git repository with "git init" if needed\n' +
        '3. Ensure the selected path is the repository root';
    } else if (error.message.includes('permission') || error.message.includes('access')) {
      errorMessage += '\n\nTroubleshooting steps:\n' +
        '1. Check folder permissions and user access rights\n' +
        '2. Try running the application as administrator\n' +
        '3. Ensure the repository is not locked by another process';
    }

    throw new Error(errorMessage);
  }
});

ipcMain.handle('get-git-diff', async (event, repoPath, baseBranch, targetBranch) => {
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
      errorMessage += '\n\nTroubleshooting steps:\n' +
        '1. Verify both branches exist locally\n' +
        '2. Run "git branch -a" to see all available branches\n' +
        '3. Pull latest changes with "git fetch" if branches are remote\n' +
        '4. Check branch names for typos or special characters';
    } else if (error.message.includes('merge-base') || error.message.includes('no common commits')) {
      errorMessage += '\n\nTroubleshooting steps:\n' +
        '1. Check if branches share common history\n' +
        '2. Try comparing with a different base branch\n' +
        '3. Ensure branches are not from completely separate repositories';
    } else if (error.code === 'ENOENT') {
      errorMessage += '\n\nTroubleshooting steps:\n' +
        '1. Ensure Git is installed and accessible in PATH\n' +
        '2. Verify the repository path is correct\n' +
        '3. Check if the .git directory exists';
    }

    throw new Error(errorMessage);
  }
});

// IPC handlers for Ollama API
ipcMain.handle('call-ollama-api', async (event, { url, model, prompt }) => {
  try {
    // Send initial progress
    event.sender.send('ollama-progress', { 
      stage: 'connecting', 
      progress: 45, 
      message: 'Connecting to Ollama API...',
      timestamp: Date.now()
    });

    const startTime = Date.now();
    let totalTokens = 0;
    let responseText = '';
    
    // Use streaming endpoint for real-time progress
    const streamUrl = url.replace('/api/generate', '/api/generate');
    
    // Calculate request size for data transfer tracking
    const requestData = { model: model, prompt: prompt, stream: true };
    const requestSize = JSON.stringify(requestData).length;
    
    // Send request started progress
    event.sender.send('ollama-progress', { 
      stage: 'sending', 
      progress: 50, 
      message: 'Sending request to AI model...',
      timestamp: Date.now(),
      modelSize: prompt.length,
      bytesUploaded: requestSize,
      totalBytes: requestSize
    });

    const response = await axios.post(streamUrl, requestData, {
      timeout: 120000, // 2 minutes timeout
      responseType: 'stream'
    });
    
    event.sender.send('ollama-progress', { 
      stage: 'processing', 
      progress: 60, 
      message: 'AI model is processing...',
      timestamp: Date.now()
    });

    return new Promise((resolve, reject) => {
      let buffer = '';
      let lastProgressUpdate = Date.now();
      let bytesReceived = 0;
      
      response.data.on('data', (chunk) => {
        const chunkSize = chunk.length;
        bytesReceived += chunkSize;
        
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        lines.forEach(line => {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              
              if (data.response) {
                responseText += data.response;
                totalTokens++;
                
                // Update progress every 100ms or every 10 tokens
                const now = Date.now();
                if (now - lastProgressUpdate > 100 || totalTokens % 10 === 0) {
                  const elapsed = (now - startTime) / 1000;
                  const tokensPerSecond = totalTokens / elapsed;
                  
                  // Dynamic progress calculation based on response length
                  const estimatedTotalTokens = Math.max(100, prompt.length / 4); // Rough estimate
                  const tokenProgress = Math.min(25, (totalTokens / estimatedTotalTokens) * 25);
                  const progress = Math.min(95, 60 + tokenProgress);
                  
                  event.sender.send('ollama-progress', { 
                    stage: 'streaming', 
                    progress: progress,
                    message: `Receiving AI response... (${totalTokens} tokens, ${tokensPerSecond.toFixed(1)} t/s)`,
                    timestamp: now,
                    tokens: totalTokens,
                    tokensPerSecond: tokensPerSecond,
                    processingTime: elapsed,
                    responsePreview: responseText.substring(0, 50) + '...',
                    bytesReceived: bytesReceived
                  });
                  
                  lastProgressUpdate = now;
                }
              }
              
              if (data.done) {
                const responseTime = Date.now() - startTime;
                
                event.sender.send('ollama-progress', { 
                  stage: 'complete', 
                  progress: 90, 
                  message: 'Processing AI response...',
                  timestamp: Date.now(),
                  responseTime,
                  tokens: totalTokens,
                  tokensPerSecond: totalTokens / (responseTime / 1000),
                  bytesReceived: bytesReceived
                });
                
                resolve(responseText);
              }
            } catch (parseError) {
              // Ignore JSON parse errors for partial chunks
            }
          }
        });
      });
      
      response.data.on('error', (error) => {
        event.sender.send('ollama-progress', { 
          stage: 'error', 
          progress: 0, 
          message: `Stream error: ${error.message}`,
          timestamp: Date.now(),
          error: error.message
        });
        reject(error);
      });
      
      response.data.on('end', () => {
        if (!responseText) {
          reject(new Error('No response received from AI model'));
        }
      });
    });
    
  } catch (error) {
    event.sender.send('ollama-progress', { 
      stage: 'error', 
      progress: 0, 
      message: `Error: ${error.message}`,
      timestamp: Date.now(),
      error: error.message
    });
    
    let errorMessage = '';
    if (error.response) {
      errorMessage = `API Error: ${error.response.status} - ${error.response.statusText}`;

      if (error.response.status === 404) {
        errorMessage += '\n\nTroubleshooting steps:\n' +
          `1. Install the model: ollama pull ${model}\n` +
          '2. Check available models: ollama list\n' +
          '3. Verify the model name is spelled correctly\n' +
          '4. Ensure Ollama server is running: ollama serve';
      } else if (error.response.status === 500) {
        errorMessage += '\n\nTroubleshooting steps:\n' +
          '1. Check Ollama server logs for detailed error\n' +
          '2. Restart Ollama service\n' +
          '3. Try a different model if this one is corrupted\n' +
          '4. Check available system memory and disk space';
      } else if (error.response.status === 503) {
        errorMessage += '\n\nTroubleshooting steps:\n' +
          '1. Ollama server may be overloaded, wait and retry\n' +
          '2. Check system resources (CPU, memory)\n' +
          '3. Restart Ollama service\n' +
          '4. Try with a smaller prompt or different model';
      }
    } else if (error.request) {
      errorMessage = 'Network Error: Could not connect to Ollama API\n\n' +
        'Troubleshooting steps:\n' +
        '1. Ensure Ollama is running: ollama serve\n' +
        '2. Check the API URL (default: http://localhost:11434/api/generate)\n' +
        '3. Verify firewall settings allow connections to port 11434\n' +
        '4. Try accessing the API directly: curl http://localhost:11434/api/version\n' +
        '5. Check if another process is using port 11434';
    } else {
      errorMessage = `Request Error: ${error.message}\n\n` +
        'Troubleshooting steps:\n' +
        '1. Check network connectivity\n' +
        '2. Verify Ollama server is accessible\n' +
        '3. Review configuration settings\n' +
        '4. Restart the application';
    }

    throw new Error(errorMessage);
  }
});

ipcMain.handle('test-ollama-connection', async (event, { url, model }) => {
  try {
    // Test server connection
    const versionUrl = url.replace('/api/generate', '/api/version');
    const versionResponse = await axios.get(versionUrl, { timeout: 5000 });
    
    // Test model availability with a simple coding question
    const testResponse = await axios.post(url, {
      model: model,
      prompt: 'What is a function in programming? Please respond with one sentence.',
      stream: false
    }, { timeout: 15000 });
    
    return {
      success: true,
      version: versionResponse.data.version || 'Unknown',
      modelResponse: testResponse.data.response || 'OK'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

app.whenReady().then(() => {
  // Remove the application menu
  Menu.setApplicationMenu(null);
  
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});