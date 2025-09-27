const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  getGitBranches: (repoPath) => ipcRenderer.invoke('get-git-branches', repoPath),

  getGitDiff: (repoPath, baseBranch, targetBranch) =>
    ipcRenderer.invoke('get-git-diff', repoPath, baseBranch, targetBranch),

  fixGitOwnership: (repoPath) => ipcRenderer.invoke('fix-git-ownership', repoPath),

  callOllamaAPI: (config) => ipcRenderer.invoke('call-ollama-api', config),

  testOllamaConnection: (config) => ipcRenderer.invoke('test-ollama-connection', config),

  // Azure AI APIs
  callAzureAI: (config) => ipcRenderer.invoke('call-azure-ai-api', config),

  testAzureAIConnection: (config) => ipcRenderer.invoke('test-azure-ai-connection', config),

  // Config management
  loadConfig: () => ipcRenderer.invoke('load-config'),
  
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // Progress listeners
  onOllamaProgress: (callback) => {
    ipcRenderer.on('ollama-progress', callback);
    return () => ipcRenderer.removeListener('ollama-progress', callback);
  },

  onAzureAIProgress: (callback) => {
    ipcRenderer.on('azure-ai-progress', callback);
    return () => ipcRenderer.removeListener('azure-ai-progress', callback);
  }
});
