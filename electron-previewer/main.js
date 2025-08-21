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
    const response = await axios.post(url, {
      model: model,
      prompt: prompt,
      stream: false
    }, {
      timeout: 120000 // 2 minutes timeout
    });
    
    return response.data.response;
  } catch (error) {
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
    
    // Test model availability
    const testResponse = await axios.post(url, {
      model: model,
      prompt: 'Test',
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