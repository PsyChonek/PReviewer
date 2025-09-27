const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const simpleGit = require('simple-git');
const axios = require('axios');
const OpenAI = require('openai');

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
      sandbox: false, // Disable sandbox for development
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Optional icon
    titleBarStyle: 'default',
    show: false
  });

  // Load the app - Check for development vs production
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In development, load from Vite dev server
    const devServerUrl = 'http://localhost:3002';
    console.log('Loading development URL:', devServerUrl);
    mainWindow.loadURL(devServerUrl);
  } else {
    // In production, load the built files
    console.log('Loading production file');
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Development tools and shortcuts
  if (isDev) {
    mainWindow.webContents.openDevTools();

    try {
      const { globalShortcut } = require('electron');

      // Add keyboard shortcuts for development
      globalShortcut.register('F5', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reloadIgnoringCache();
        }
      });
      globalShortcut.register('CommandOrControl+R', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reloadIgnoringCache();
        }
      });
    } catch (error) {
      console.log('Dev tools not available:', error.message);
    }
  }
  
  // Add error and success handlers for both dev and prod
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Page failed to load:', errorCode, errorDescription, validatedURL);
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading successfully');
  });
  
  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
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
    } else if (error.message.includes('dubious ownership')) {
      errorMessage += '\n\nDubious ownership detected (common with mounted drives):\n' +
        '1. This repository is on a mounted drive or network share\n' +
        '2. Git blocks access for security reasons\n' +
        '3. Run this command to fix it:\n' +
        `   git config --global --add safe.directory "${repoPath}"\n` +
        '4. Or use the "Fix Ownership" button below to run it automatically';
    } else if (error.message.includes('permission') || error.message.includes('access')) {
      errorMessage += '\n\nTroubleshooting steps:\n' +
        '1. Check folder permissions and user access rights\n' +
        '2. Try running the application as administrator\n' +
        '3. Ensure the repository is not locked by another process';
    }

    throw new Error(errorMessage);
  }
});

// IPC handler to fix git dubious ownership
ipcMain.handle('fix-git-ownership', async (event, repoPath) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const command = `git config --global --add safe.directory "${repoPath}"`;
    await execAsync(command);

    return { success: true, message: 'Git ownership fixed successfully!' };
  } catch (error) {
    return { success: false, error: error.message };
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
                    streamingContent: responseText,
                    isStreaming: true,
                    bytesReceived: bytesReceived
                  });
                  
                  lastProgressUpdate = now;
                }
              }
              
              if (data.done) {
                const responseTime = Date.now() - startTime;

                // Ollama provides actual token counts in the final response
                const actualInputTokens = data.prompt_eval_count;
                const actualOutputTokens = data.eval_count;

                event.sender.send('ollama-progress', {
                  stage: 'complete',
                  progress: 100,
                  message: 'AI response complete',
                  timestamp: Date.now(),
                  responseTime,
                  tokens: actualOutputTokens || totalTokens,
                  tokensPerSecond: (actualOutputTokens || totalTokens) / (responseTime / 1000),
                  bytesReceived: bytesReceived,
                  streamingContent: responseText,
                  isStreaming: false,
                  actualInputTokens: actualInputTokens,
                  actualOutputTokens: actualOutputTokens,
                  totalActualTokens: (actualInputTokens || 0) + (actualOutputTokens || 0)
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

// IPC handlers for Azure AI API
ipcMain.handle('call-azure-ai-api', async (event, { endpoint, apiKey, deploymentName, prompt }) => {
  try {
    // Send initial progress
    event.sender.send('azure-ai-progress', {
      stage: 'connecting',
      progress: 45,
      message: 'Connecting to Azure AI service...',
      timestamp: Date.now()
    });

    const startTime = Date.now();
    let totalTokens = 0;

    // Send request started progress
    event.sender.send('azure-ai-progress', {
      stage: 'sending',
      progress: 50,
      message: 'Sending request to Azure AI model...',
      timestamp: Date.now(),
      modelSize: prompt.length
    });

    // Create Azure OpenAI client using the stable OpenAI SDK
    // Extract base URL from the full endpoint if it contains the full path
    let baseURL = endpoint;
    if (endpoint.includes('/openai/deployments/')) {
      // Extract just the base URL (e.g., https://resource.cognitiveservices.azure.com)
      baseURL = endpoint.split('/openai/deployments/')[0];
    }

    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: `${baseURL}/openai/deployments/${deploymentName}`,
      defaultQuery: { 'api-version': '2025-01-01-preview' },
      defaultHeaders: {
        'api-key': apiKey,
      },
    });

    event.sender.send('azure-ai-progress', {
      stage: 'processing',
      progress: 60,
      message: 'Azure AI model is processing...',
      timestamp: Date.now()
    });

    // Make the streaming request to Azure OpenAI
    const stream = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert code reviewer."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      stream: true
    });

    let responseText = '';
    let chunkCount = 0;
    let usage = null;

    // Process the stream
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        responseText += delta;
        chunkCount++;

        // Send streaming progress every few chunks
        if (chunkCount % 3 === 0) {
          const currentTime = Date.now();
          const elapsed = (currentTime - startTime) / 1000;
          const estimatedTokens = responseText.split(' ').length;
          const tokensPerSecond = elapsed > 0 ? estimatedTokens / elapsed : 0;

          event.sender.send('azure-ai-progress', {
            stage: 'streaming',
            progress: Math.min(60 + (responseText.length / 50), 90),
            message: `Receiving AI response... (${estimatedTokens} tokens, ${tokensPerSecond.toFixed(1)} t/s)`,
            timestamp: currentTime,
            streamingContent: responseText,
            isStreaming: true,
            tokens: estimatedTokens,
            tokensPerSecond: tokensPerSecond,
            processingTime: elapsed
          });
        }
      }

      // Capture usage information when available
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    const responseTime = Date.now() - startTime;
    totalTokens = usage?.completion_tokens || responseText.split(' ').length;

    event.sender.send('azure-ai-progress', {
      stage: 'complete',
      progress: 100,
      message: 'AI response complete',
      timestamp: Date.now(),
      responseTime,
      tokens: totalTokens,
      actualInputTokens: usage?.prompt_tokens,
      actualOutputTokens: usage?.completion_tokens,
      totalActualTokens: usage?.total_tokens,
      streamingContent: responseText,
      isStreaming: false
    });

    return responseText;

  } catch (error) {
    event.sender.send('azure-ai-progress', {
      stage: 'error',
      progress: 0,
      message: `Error: ${error.message}`,
      timestamp: Date.now(),
      error: error.message
    });

    let errorMessage = '';
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'Network Error: Could not connect to Azure AI service\n\n' +
        'Troubleshooting steps:\n' +
        '1. Check your internet connection\n' +
        '2. Verify the Azure AI endpoint URL is correct\n' +
        '3. Ensure firewall allows connections to Azure\n' +
        '4. Check if Azure AI service is operational';
    } else if (error.status === 401) {
      errorMessage = 'Authentication Error: Invalid API key\n\n' +
        'Troubleshooting steps:\n' +
        '1. Verify your Azure AI API key is correct\n' +
        '2. Check if the API key has expired\n' +
        '3. Ensure the key has proper permissions\n' +
        '4. Regenerate the API key if necessary';
    } else if (error.status === 404) {
      errorMessage = 'Model Error: Deployment not found\n\n' +
        'Troubleshooting steps:\n' +
        '1. Verify the deployment name is correct\n' +
        '2. Check if the model deployment exists in Azure\n' +
        '3. Ensure the deployment is active and running\n' +
        '4. Check the endpoint URL matches your resource';
    } else if (error.status === 429) {
      errorMessage = 'Rate Limit Error: Too many requests\n\n' +
        'Troubleshooting steps:\n' +
        '1. Wait a moment and try again\n' +
        '2. Check your Azure AI quota limits\n' +
        '3. Consider upgrading your Azure AI tier\n' +
        '4. Implement request throttling';
    } else {
      errorMessage = `Azure AI Error: ${error.message}\n\n` +
        'Troubleshooting steps:\n' +
        '1. Check network connectivity to Azure\n' +
        '2. Verify all configuration settings\n' +
        '3. Review Azure AI service status\n' +
        '4. Contact Azure support if issue persists';
    }

    throw new Error(errorMessage);
  }
});

ipcMain.handle('test-azure-ai-connection', async (event, { endpoint, apiKey, deploymentName }) => {
  try {
    // Create Azure OpenAI client using the stable OpenAI SDK
    // Extract base URL from the full endpoint if it contains the full path
    let baseURL = endpoint;
    if (endpoint.includes('/openai/deployments/')) {
      // Extract just the base URL (e.g., https://resource.cognitiveservices.azure.com)
      baseURL = endpoint.split('/openai/deployments/')[0];
    }

    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: `${baseURL}/openai/deployments/${deploymentName}`,
      defaultQuery: { 'api-version': '2025-01-01-preview' },
      defaultHeaders: {
        'api-key': apiKey,
      },
    });

    // Test with a simple request
    const testResponse = await client.chat.completions.create({
      messages: [
        {
          role: "user",
          content: "What is a function in programming? Please respond with one sentence."
        }
      ],
      max_tokens: 100,
      temperature: 0.1
    });

    return {
      success: true,
      deploymentName: deploymentName,
      modelResponse: testResponse.choices[0]?.message?.content || 'OK'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
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