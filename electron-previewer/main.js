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
    throw new Error(`Failed to get branches: ${error.message}`);
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
    throw new Error(`Failed to get diff: ${error.message}`);
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
    
    // Send request started progress
    event.sender.send('ollama-progress', { 
      stage: 'sending', 
      progress: 50, 
      message: 'Sending request to AI model...',
      timestamp: Date.now(),
      modelSize: prompt.length
    });

    const response = await axios.post(streamUrl, {
      model: model,
      prompt: prompt,
      stream: true // Enable streaming
    }, {
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
      
      response.data.on('data', (chunk) => {
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
                    responsePreview: responseText.substring(0, 50) + '...'
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
                  tokensPerSecond: totalTokens / (responseTime / 1000)
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
    
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      throw new Error('Network Error: Could not connect to Ollama API');
    } else {
      throw new Error(`Request Error: ${error.message}`);
    }
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