const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  getGitBranches: (repoPath) => ipcRenderer.invoke('get-git-branches', repoPath),
  
  getGitDiff: (repoPath, baseBranch, targetBranch) => 
    ipcRenderer.invoke('get-git-diff', repoPath, baseBranch, targetBranch),
    
  callOllamaAPI: (config) => ipcRenderer.invoke('call-ollama-api', config),
  
  testOllamaConnection: (config) => ipcRenderer.invoke('test-ollama-connection', config),
  
  // Progress listeners
  onOllamaProgress: (callback) => {
    ipcRenderer.on('ollama-progress', callback);
    return () => ipcRenderer.removeListener('ollama-progress', callback);
  }
});
