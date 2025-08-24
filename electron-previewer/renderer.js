// Global state
let currentRepoPath = null;
let reviewInProgress = false;
let reviewStartTime = null;
let progressUpdateInterval = null;
let ollamaProgressHandler = null;
let debugDetailsVisible = false;

// AI Prompt Template - Default base prompt
const DEFAULT_BASE_PROMPT = `You are an expert code reviewer. Analyze the following code changes (diff format).
Identify potential bugs, security vulnerabilities, performance issues, and suggest improvements
based on best practices. Focus on the *newly added or modified lines*.
Provide concise, actionable feedback. If no issues, state 'No major issues found.'.

Consider the context of a C# and SQL development environment.
The feedback should be formatted clearly, focusing on specific lines if possible.`;

// Function to build the complete prompt
function buildPrompt(diff, basePrompt = null, userPrompt = null) {
    let prompt = basePrompt || DEFAULT_BASE_PROMPT;
    
    if (userPrompt && userPrompt.trim()) {
        prompt += '\n\nAdditional Instructions:\n' + userPrompt.trim();
    }
    
    prompt += '\n---\nDiff:\n{diff}\n---\nReview:\n';
    
    return prompt.replace('{diff}', diff);
}

// Token Estimation Functions
function estimateTokens(text) {
    // Much more conservative token estimation based on real-world observations
    // Modern tokenizers for code average around 6-8 characters per token
    
    const characterCount = text.length;
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    
    // Very conservative approach: use 8-10 chars per token for large code diffs
    const charBasedEstimate = Math.ceil(characterCount / 9);
    
    // For word-based: code/technical content is typically 0.6-0.8 tokens per word
    const wordBasedEstimate = Math.ceil(wordCount * 0.7);
    
    // Take the smaller of the two estimates to be more conservative
    const baseEstimate = Math.min(charBasedEstimate, wordBasedEstimate);
    
    // For very large diffs, apply additional scaling down
    let finalEstimate = baseEstimate;
    if (characterCount > 500000) { // 500KB+
        finalEstimate = Math.ceil(baseEstimate * 0.85); // Scale down by 15%
    }
    if (characterCount > 1000000) { // 1MB+
        finalEstimate = Math.ceil(baseEstimate * 0.75); // Scale down by 25%
    }
    
    // Debug logging (only if DEBUG is true)
    if (DEBUG) {
        console.log(`Token Estimation Debug:
    - Characters: ${characterCount}
    - Words: ${wordCount}  
    - Char-based estimate (÷9): ${charBasedEstimate}
    - Word-based estimate (×0.7): ${wordBasedEstimate}
    - Base estimate (min): ${baseEstimate}
    - Final estimate (with scaling): ${finalEstimate}`);
    }
    
    return finalEstimate;
}

function formatTokenCount(tokenCount) {
    if (tokenCount >= 1000000) {
        return `${(tokenCount / 1000000).toFixed(1)}M`;
    } else if (tokenCount >= 1000) {
        return `${(tokenCount / 1000).toFixed(1)}K`;
    } else {
        return tokenCount.toString();
    }
}

// Utility Functions
function showAlert(message, type = 'info') {
    const alertClasses = {
        'success': 'alert-success',
        'error': 'alert-error',
        'warning': 'alert-warning',
        'info': 'alert-info'
    };
    
    // Create or get the toast container
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast toast-top toast-center z-40';
        document.body.appendChild(toastContainer);
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClasses[type]} shadow-lg max-w-md`;
    alertDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>${message}</span>
    `;
    
    // Add to toast container instead of body
    toastContainer.appendChild(alertDiv);
    
    // Add entrance animation
    alertDiv.style.opacity = '0';
    alertDiv.style.transform = 'translateY(-20px)';
    requestAnimationFrame(() => {
        alertDiv.style.transition = 'all 0.3s ease';
        alertDiv.style.opacity = '1';
        alertDiv.style.transform = 'translateY(0)';
    });
    
    setTimeout(() => {
        // Add exit animation
        alertDiv.style.opacity = '0';
        alertDiv.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 300);
    }, 5000);
}

function updateStatus(message, showInProgress = false) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
        statusEl.textContent = message;
        if (showInProgress) {
            statusEl.innerHTML = `<span class="loading loading-spinner loading-sm"></span> ${message}`;
        }
    }
}

function updateProgress(percentage, text = '') {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressSection = document.getElementById('progress-section');
    
    if (progressBar) {
        progressBar.value = percentage;
        
        // Add smooth animation
        progressBar.style.transition = 'value 0.3s ease';
    }
    
    if (progressText) {
        progressText.textContent = `${Math.round(percentage)}%`;
    }
    
    if (text) {
        updateStatus(text, percentage < 100);
    }
    
    if (percentage > 0) {
        progressSection.classList.remove('hidden');
    } else {
        progressSection.classList.add('hidden');
    }
}

function showStats() {
    document.getElementById('stats-section').classList.remove('hidden');
}

function hideStats() {
    document.getElementById('stats-section').classList.add('hidden');
}

function showDebugInfo() {
    document.getElementById('debug-section').classList.remove('hidden');
}

function hideDebugInfo() {
    document.getElementById('debug-section').classList.add('hidden');
}

function toggleDebugDetails() {
    const details = document.getElementById('debug-details');
    const toggleText = document.getElementById('debug-toggle-text');
    
    if (debugDetailsVisible) {
        details.classList.add('hidden');
        toggleText.textContent = 'Show Details';
        debugDetailsVisible = false;
    } else {
        details.classList.remove('hidden');
        toggleText.textContent = 'Hide Details';
        debugDetailsVisible = true;
    }
}

function updateStats(elapsed = null, tokens = null, model = null, stage = null) {
    if (elapsed !== null) {
        const timeEl = document.getElementById('time-stat');
        if (elapsed < 60) {
            timeEl.textContent = `${elapsed.toFixed(1)}s`;
        } else {
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            timeEl.textContent = `${minutes}m ${seconds.toFixed(0)}s`;
        }
    }
    
    if (tokens !== null && elapsed !== null && elapsed > 0) {
        const speedEl = document.getElementById('speed-stat');
        const tokensPerSec = tokens / elapsed;
        if (tokensPerSec >= 1) {
            speedEl.textContent = `${tokensPerSec.toFixed(1)} t/s`;
        } else {
            speedEl.textContent = `${tokensPerSec.toFixed(2)} t/s`;
        }
        
        const tokensEl = document.getElementById('tokens-stat');
        if (tokens >= 1000) {
            tokensEl.textContent = `${(tokens / 1000).toFixed(1)}k`;
        } else {
            tokensEl.textContent = tokens.toString();
        }
        
        // Update debug info
        document.getElementById('tokens-per-second').textContent = `${tokensPerSec.toFixed(2)} t/s`;
    }
    
    if (model !== null) {
        const modelEl = document.getElementById('model-stat');
        const displayName = model.length <= 12 ? model : model.substring(0, 12) + '...';
        modelEl.textContent = displayName;
    }
    
    if (stage !== null) {
        const stageEl = document.getElementById('stage-stat');
        stageEl.textContent = stage;
    }
    
    showStats();
}

function updateDebugInfo(data) {
    // Update request size
    if (data.modelSize) {
        const sizeEl = document.getElementById('request-size-stat');
        const kb = data.modelSize / 1024;
        sizeEl.textContent = kb > 1 ? `${kb.toFixed(1)} KB` : `${data.modelSize} B`;
    }
    
    // Update response time
    if (data.responseTime) {
        const responseEl = document.getElementById('response-time-stat');
        responseEl.textContent = `${data.responseTime}ms`;
    }
    
    // Update transfer stats
    if (data.bytesUploaded && data.totalBytes) {
        const transferEl = document.getElementById('transfer-stat');
        const percent = (data.bytesUploaded / data.totalBytes * 100).toFixed(0);
        transferEl.textContent = `${percent}% up`;
        
        document.getElementById('upload-progress').textContent = `${data.bytesUploaded}/${data.totalBytes} bytes (${percent}%)`;
    }

    if (data.bytesReceived) {
        const transferEl = document.getElementById('transfer-stat');
        const kb = data.bytesReceived / 1024;
        transferEl.textContent = kb > 1 ? `${kb.toFixed(1)} KB recv` : `${data.bytesReceived} B recv`;
    }

    // Update processing stage
    if (data.stage) {
        document.getElementById('processing-stage').textContent = data.stage;
    }

    // Update token estimation info
    if (data.estimatedInputTokens) {
        document.getElementById('estimated-input-tokens').textContent = formatTokenCount(data.estimatedInputTokens);
    }
    
    if (data.estimatedOutputTokens) {
        document.getElementById('estimated-output-tokens').textContent = formatTokenCount(data.estimatedOutputTokens);
    }
    
    if (data.actualTokens) {
        document.getElementById('actual-tokens').textContent = formatTokenCount(data.actualTokens);
    }

    // Update last update time
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();

    showDebugInfo();
}function resetStats() {
    ['time-stat', 'speed-stat', 'tokens-stat', 'model-stat', 'stage-stat'].forEach(id => {
        document.getElementById(id).textContent = '--';
    });
    
    ['request-size-stat', 'response-time-stat', 'transfer-stat', 'upload-progress', 
     'processing-stage', 'last-update', 'tokens-per-second', 'estimated-input-tokens', 
     'estimated-output-tokens', 'actual-tokens'].forEach(id => {
        document.getElementById(id).textContent = '--';
    });
    
    // Hide preview section when resetting
    document.getElementById('token-preview').classList.add('hidden');
    
    hideStats();
    hideDebugInfo();
    debugDetailsVisible = false;
    document.getElementById('debug-details').classList.add('hidden');
    document.getElementById('debug-toggle-text').textContent = 'Show Details';
}

// Repository Functions
async function selectRepository() {
    try {
        const repoPath = await window.electronAPI.selectDirectory();
        if (repoPath) {
            currentRepoPath = repoPath;
            document.getElementById('repo-path').value = repoPath;
            
            updateStatus('Loading repository branches...', true);
            await loadBranches(repoPath);
            showAlert('Repository loaded successfully!', 'success');
        }
    } catch (error) {
        console.error('Error selecting repository:', error);
        showAlert(`Error selecting repository: ${error.message}`, 'error');
    } finally {
        updateStatus('Ready');
    }
}

async function previewTokenEstimate() {
    const repoPath = document.getElementById('repo-path').value.trim();
    const fromBranch = document.getElementById('from-branch').value;
    const toBranch = document.getElementById('to-branch').value;
    
    // Clear previous preview
    const previewEl = document.getElementById('token-preview');
    previewEl.classList.add('hidden');
    
    if (!repoPath || !fromBranch || !toBranch || 
        fromBranch === 'Select repository first...' || toBranch === 'Select repository first...' ||
        fromBranch === toBranch) {
        return;
    }
    
    try {
        updateStatus('Analyzing changes...', true);
        
        // Generate diff for preview
        const diff = await window.electronAPI.getGitDiff(repoPath, toBranch, fromBranch);
        
        if (!diff || diff.trim() === '') {
            document.getElementById('preview-status').textContent = 'No changes detected between selected branches';
            document.getElementById('preview-details').classList.add('hidden');
            previewEl.classList.remove('hidden');
            updateStatus('Ready');
            return;
        }
        
        // Calculate token estimates
        const basePrompt = localStorage.getItem('base-prompt') || DEFAULT_BASE_PROMPT;
        const userPrompt = localStorage.getItem('user-prompt') || '';
        const prompt = buildPrompt(diff, basePrompt, userPrompt);
        const estimatedInputTokens = estimateTokens(prompt);
        const diffLines = diff.split('\n').length;
        const diffSizeKB = (diff.length / 1024);
        
        // AI code reviews are typically 100-500 tokens regardless of input size
        // Base estimate on complexity rather than input size
        const diffComplexity = Math.min(diffLines / 100, 5); // Scale 0-5 based on lines
        const baseResponseTokens = 150; // Typical review is ~150 tokens
        const estimatedOutputTokens = Math.ceil(baseResponseTokens + (diffComplexity * 50)); // +50 per complexity level
        
        // Update preview display
        document.getElementById('preview-status').textContent = `Ready to review ${diffLines} lines of changes`;
        document.getElementById('preview-diff-size').textContent = `${diffSizeKB.toFixed(1)} KB`;
        document.getElementById('preview-input-tokens').textContent = formatTokenCount(estimatedInputTokens);
        document.getElementById('preview-output-tokens').textContent = formatTokenCount(estimatedOutputTokens);
        document.getElementById('preview-total-estimate').textContent = formatTokenCount(estimatedInputTokens + estimatedOutputTokens);
        
        // Show cost estimation if tokens are high
        const costWarningEl = document.getElementById('preview-cost-warning');
        if (estimatedInputTokens > 50000) {
            costWarningEl.textContent = '⚠️ Large prompt - may take longer and use more resources';
            costWarningEl.classList.remove('hidden');
        } else {
            costWarningEl.classList.add('hidden');
        }
        
        document.getElementById('preview-details').classList.remove('hidden');
        previewEl.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error generating preview:', error);
        document.getElementById('preview-status').textContent = `Error analyzing changes: ${error.message}`;
        document.getElementById('preview-details').classList.add('hidden');
        previewEl.classList.remove('hidden');
    } finally {
        updateStatus('Ready');
    }
}

async function loadBranches(repoPath) {
    try {
        const branches = await window.electronAPI.getGitBranches(repoPath);
        
        const fromBranchSelect = document.getElementById('from-branch');
        const toBranchSelect = document.getElementById('to-branch');
        
        // Clear existing options
        fromBranchSelect.innerHTML = '';
        toBranchSelect.innerHTML = '';
        
        // Add branch options
        branches.forEach(branch => {
            const fromOption = new Option(branch, branch);
            const toOption = new Option(branch, branch);
            fromBranchSelect.add(fromOption);
            toBranchSelect.add(toOption);
        });
        
        // Add HEAD option to target branch
        toBranchSelect.add(new Option('HEAD', 'HEAD'));
        
        // Set default values
        if (branches.length > 0) {
            fromBranchSelect.value = branches[0];
            
            // Try to set main/master as default target
            const mainBranches = ['main', 'master', 'develop'];
            for (const mainBranch of mainBranches) {
                if (branches.includes(mainBranch)) {
                    toBranchSelect.value = mainBranch;
                    break;
                }
            }
            if (!toBranchSelect.value) {
                toBranchSelect.value = 'HEAD';
            }
        }
        
        // Enable controls
        fromBranchSelect.disabled = false;
        toBranchSelect.disabled = false;
        document.getElementById('start-review-btn').disabled = false;
        
        // Add event listeners for automatic preview
        fromBranchSelect.addEventListener('change', previewTokenEstimate);
        toBranchSelect.addEventListener('change', previewTokenEstimate);
        
        // Trigger initial preview
        setTimeout(previewTokenEstimate, 100);
        
        updateStatus('Repository loaded successfully');
        
    } catch (error) {
        console.error('Error loading branches:', error);
        showAlert(`Error loading branches: ${error.message}`, 'error');
        
        // Reset branch selects
        const fromBranchSelect = document.getElementById('from-branch');
        const toBranchSelect = document.getElementById('to-branch');
        fromBranchSelect.innerHTML = '<option>Error loading branches</option>';
        toBranchSelect.innerHTML = '<option>Error loading branches</option>';
        fromBranchSelect.disabled = true;
        toBranchSelect.disabled = true;
        document.getElementById('start-review-btn').disabled = true;
    }
}

// Ollama API Functions
async function testConnection() {
    const url = document.getElementById('ollama-url').value.trim();
    const model = document.getElementById('ollama-model').value.trim();
    
    if (!url || !model) {
        showConnectionTestResult('Please provide both Ollama URL and Model name.', 'error');
        return;
    }
    
    // Update button state
    const testBtn = document.getElementById('test-connection-btn');
    const testBtnText = document.getElementById('test-btn-text');
    const originalText = testBtnText.textContent;
    
    testBtn.disabled = true;
    testBtn.classList.add('loading');
    testBtnText.textContent = 'Testing...';
    
    // Hide previous results
    hideConnectionTestResult();
    
    try {
        const result = await window.electronAPI.testOllamaConnection({ url, model });
        
        if (result.success) {
            const successMessage = `
                <div>
                    <div class="flex items-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span class="font-semibold">Connection Successful!</span>
                    </div>
                    <div class="text-sm space-y-1">
                        <div><strong>URL:</strong> ${url}</div>
                        <div><strong>Model:</strong> ${model}</div>
                        <div><strong>Version:</strong> ${result.version}</div>
                        <div><strong>Test Response:</strong> ${result.modelResponse.length > 150 ? 
                            result.modelResponse.substring(0, 150) + '...' : 
                            result.modelResponse}</div>
                    </div>
                </div>
            `;
            showConnectionTestResult(successMessage, 'success');
        } else {
            const errorMessage = `
                <div>
                    <div class="flex items-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span class="font-semibold">Connection Failed</span>
                    </div>
                    <div class="text-sm">
                        <div><strong>URL:</strong> ${url}</div>
                        <div><strong>Model:</strong> ${model}</div>
                        <div><strong>Error:</strong> ${result.error}</div>
                    </div>
                </div>
            `;
            showConnectionTestResult(errorMessage, 'error');
        }
        
    } catch (error) {
        console.error('Connection test error:', error);
        const errorMessage = `
            <div>
                <div class="flex items-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span class="font-semibold">Test Failed</span>
                </div>
                <div class="text-sm">
                    <div><strong>Error:</strong> ${error.message}</div>
                </div>
            </div>
        `;
        showConnectionTestResult(errorMessage, 'error');
    } finally {
        // Restore button state
        testBtn.disabled = false;
        testBtn.classList.remove('loading');
        testBtnText.textContent = originalText;
    }
}

function showConnectionTestResult(message, type) {
    const resultDiv = document.getElementById('connection-test-result');
    const alertDiv = document.getElementById('test-result-alert');
    const contentDiv = document.getElementById('test-result-content');
    
    // Remove previous alert classes
    alertDiv.classList.remove('alert-success', 'alert-error', 'alert-info');
    
    // Add appropriate class based on type
    if (type === 'success') {
        alertDiv.classList.add('alert-success');
    } else if (type === 'error') {
        alertDiv.classList.add('alert-error');
    } else {
        alertDiv.classList.add('alert-info');
    }
    
    contentDiv.innerHTML = message;
    resultDiv.classList.remove('hidden');
}

function hideConnectionTestResult() {
    const resultDiv = document.getElementById('connection-test-result');
    resultDiv.classList.add('hidden');
}

// Review Functions
async function startReview() {
    if (reviewInProgress) {
        showAlert('Review already in progress!', 'warning');
        return;
    }
    
    const repoPath = document.getElementById('repo-path').value.trim();
    const fromBranch = document.getElementById('from-branch').value;
    const toBranch = document.getElementById('to-branch').value;
    const ollamaUrl = document.getElementById('ollama-url').value.trim();
    const ollamaModel = document.getElementById('ollama-model').value.trim();
    
    // Validation
    if (!repoPath) {
        showAlert('Please select a repository path.', 'error');
        return;
    }
    
    if (!ollamaUrl || !ollamaModel) {
        showAlert('Please provide both Ollama URL and Model name.', 'error');
        return;
    }
    
    if (!fromBranch || !toBranch || fromBranch === 'Select repository first...' || toBranch === 'Select repository first...') {
        showAlert('Please select valid branches for comparison.', 'error');
        return;
    }
    
    // Start review process
    reviewInProgress = true;
    reviewStartTime = Date.now();
    
    // Update UI
    document.getElementById('start-review-btn').classList.add('hidden');
    document.getElementById('stop-review-btn').classList.remove('hidden');
    
    clearOutput();
    resetStats();
    updateProgress(0);
    updateStats(0, 0, ollamaModel, 'initializing');
    
    try {
        await runReview(repoPath, fromBranch, toBranch, ollamaUrl, ollamaModel);
    } catch (error) {
        console.error('Review error:', error);
        appendOutput(`\n💥 Review failed: ${error.message}\n`, 'error');
        showAlert(`Review failed: ${error.message}`, 'error');
    } finally {
        // Clean up intervals and listeners
        if (progressUpdateInterval) {
            clearInterval(progressUpdateInterval);
            progressUpdateInterval = null;
        }
        
        if (ollamaProgressHandler) {
            ollamaProgressHandler();
            ollamaProgressHandler = null;
        }
        
        // Reset UI
        reviewInProgress = false;
        document.getElementById('start-review-btn').classList.remove('hidden');
        document.getElementById('stop-review-btn').classList.add('hidden');
        updateStatus('Review completed');
    }
}

async function runReview(repoPath, fromBranch, toBranch, ollamaUrl, ollamaModel) {
    // Setup progress listener
    if (ollamaProgressHandler) {
        ollamaProgressHandler(); // Remove previous listener
    }
    
    ollamaProgressHandler = window.electronAPI.onOllamaProgress((event, data) => {
        updateProgress(data.progress, data.message);
        updateStats(
            data.processingTime || (Date.now() - reviewStartTime) / 1000,
            data.tokens,
            ollamaModel,
            data.stage
        );
        
        // Update debug info with actual token information when available
        const debugData = { ...data };
        if (data.tokens) {
            debugData.actualTokens = data.tokens;
        }
        updateDebugInfo(debugData);
        
        // Add real-time progress messages to output
        if (data.stage === 'connecting') {
            appendOutput(`🔗 ${data.message}\n`, 'info');
        } else if (data.stage === 'sending') {
            appendOutput(`� ${data.message}\n`, 'info');
        } else if (data.stage === 'uploading') {
            appendOutput(`⬆️ ${data.message}\n`, 'info');
        } else if (data.stage === 'processing') {
            appendOutput(`🔄 ${data.message}\n`, 'info');
        } else if (data.stage === 'complete') {
            appendOutput(`✅ Response received! (${data.tokens} tokens)\n`, 'success');
        } else if (data.stage === 'error') {
            appendOutput(`❌ ${data.message}\n`, 'error');
        }
    });

    // Header
    appendOutput('�🔍 AI Code Review Analysis\n', 'header');
    appendOutput('━'.repeat(60) + '\n\n', 'separator');
    
    // Configuration
    appendOutput('📊 Review Configuration\n', 'subheader');
    appendOutput(`• Repository: ${repoPath.split(/[\/\\]/).pop()}\n`, 'info');
    appendOutput(`• Path: ${repoPath}\n`, 'info');
    appendOutput(`• Comparing: ${toBranch} → ${fromBranch}\n`, 'info');
    appendOutput(`• AI Model: ${ollamaModel}\n`, 'info');
    appendOutput(`• Endpoint: ${ollamaUrl}\n\n`, 'info');
    
    updateProgress(10, 'Initializing review process...');
    updateStats(0, 0, ollamaModel, 'initializing');
    
    // Start real-time updates
    progressUpdateInterval = setInterval(() => {
        if (reviewInProgress) {
            const elapsed = (Date.now() - reviewStartTime) / 1000;
            updateStats(elapsed, null, ollamaModel, null);
        }
    }, 100); // Update every 100ms for smooth real-time feel
    
    updateProgress(15, 'Generating diff...');
    
    // Generate diff
    appendOutput('🔄 Generating Code Diff...\n', 'subheader');
    appendOutput(`• Source branch: ${fromBranch}\n`, 'info');
    appendOutput(`• Target branch: ${toBranch}\n`, 'info');
    appendOutput('• Finding differences...\n', 'info');
    
    const diffStartTime = Date.now();
    let diff;
    
    try {
        diff = await window.electronAPI.getGitDiff(repoPath, toBranch, fromBranch);
    } catch (error) {
        throw new Error(`Failed to generate diff: ${error.message}`);
    }
    
    const diffElapsed = (Date.now() - diffStartTime) / 1000;
    
    if (!diff || diff.trim() === '') {
        appendOutput('❌ No diff generated or found.\n', 'warning');
        appendOutput('The branches may be identical or have no common history.\n', 'info');
        updateProgress(100, 'No changes found');
        clearInterval(progressUpdateInterval);
        if (ollamaProgressHandler) ollamaProgressHandler();
        return;
    }
    
    appendOutput('✅ Diff generated successfully.\n', 'success');
    appendOutput(`📈 Found ${diff.split('\n').length} lines of changes to analyze.\n\n`, 'info');
    
    updateProgress(35, 'Preparing AI analysis...');
    updateStats((Date.now() - reviewStartTime) / 1000, null, ollamaModel, 'preparing');
    
    // Calculate estimated tokens for the prompt
    const basePrompt = localStorage.getItem('base-prompt') || DEFAULT_BASE_PROMPT;
    const userPrompt = localStorage.getItem('user-prompt') || '';
    const prompt = buildPrompt(diff, basePrompt, userPrompt);
    const estimatedInputTokens = estimateTokens(prompt);
    
    // AI code reviews are typically 100-500 tokens regardless of input size
    // Base estimate on diff complexity rather than input size
    const diffLines = diff.split('\n').length;
    const diffComplexity = Math.min(diffLines / 100, 5); // Scale 0-5 based on lines
    const baseResponseTokens = 150; // Typical review is ~150 tokens
    const estimatedOutputTokens = Math.ceil(baseResponseTokens + (diffComplexity * 50)); // +50 per complexity level
    
    // AI Analysis
    appendOutput('🤖 AI Analysis in Progress...\n', 'subheader');
    appendOutput(`📤 Preparing prompt for AI model (${ollamaModel})...\n`, 'info');
    appendOutput(`📊 Prompt size: ${(prompt.length / 1024).toFixed(1)} KB\n`, 'info');
    appendOutput(`🧮 Estimated input tokens: ${formatTokenCount(estimatedInputTokens)}\n`, 'info');
    appendOutput(`🧮 Estimated response tokens: ${formatTokenCount(estimatedOutputTokens)}\n`, 'info');
    
    // Update debug info with token estimation
    updateDebugInfo({
        estimatedInputTokens: estimatedInputTokens,
        estimatedOutputTokens: estimatedOutputTokens,
        stage: 'token-estimation'
    });
    
    const aiStartTime = Date.now();
    let aiFeedback;
    
    try {
        aiFeedback = await window.electronAPI.callOllamaAPI({
            url: ollamaUrl,
            model: ollamaModel,
            prompt: prompt
        });
    } catch (error) {
        clearInterval(progressUpdateInterval);
        if (ollamaProgressHandler) ollamaProgressHandler();
        throw new Error(`AI analysis failed: ${error.message}`);
    }
    
    const aiElapsed = (Date.now() - aiStartTime) / 1000;
    const totalElapsed = (Date.now() - reviewStartTime) / 1000;
    
    clearInterval(progressUpdateInterval);
    if (ollamaProgressHandler) ollamaProgressHandler();
    
    updateProgress(95, 'Formatting results...');
    updateStats(totalElapsed, null, ollamaModel, 'formatting');
    
    // Display results
    appendOutput('\n' + '═'.repeat(60) + '\n', 'separator');
    appendOutput('🎯 AI REVIEW RESULTS\n', 'ai-title');
    appendOutput('═'.repeat(60) + '\n\n', 'separator');
    
    if (aiFeedback) {
        formatAIFeedback(aiFeedback);
        
        // Performance summary
        appendOutput('\n⏱️ Performance Summary:\n', 'subheader');
        appendOutput(`• Total Time: ${totalElapsed.toFixed(1)}s\n`, 'info');
        appendOutput(`• Diff Generation: ${diffElapsed.toFixed(1)}s\n`, 'info');
        appendOutput(`• AI Analysis: ${aiElapsed.toFixed(1)}s\n`, 'info');
        appendOutput(`• Model: ${ollamaModel}\n`, 'info');
        appendOutput(`• Prompt Size: ${(prompt.length / 1024).toFixed(1)} KB\n`, 'info');
        appendOutput(`• Estimated Input Tokens: ${formatTokenCount(estimatedInputTokens)}\n`, 'info');
        appendOutput(`• Estimated Response Tokens: ${formatTokenCount(estimatedOutputTokens)}\n`, 'info');
        
        // Update final stats with actual response tokens
        const actualResponseTokens = aiFeedback.split(' ').length;
        updateStats(totalElapsed, actualResponseTokens, ollamaModel, 'complete');
        
        // Update debug info with final token comparison
        updateDebugInfo({
            actualTokens: actualResponseTokens,
            stage: 'complete'
        });
        
        appendOutput(`• Actual Response Tokens: ${formatTokenCount(actualResponseTokens)}\n`, 'info');
        
        // Calculate accuracy of estimation
        const estimationDiff = estimatedOutputTokens - actualResponseTokens;
        const estimationAccuracy = estimatedOutputTokens > 0 ? 
            (estimationDiff / estimatedOutputTokens * 100).toFixed(1) : 0;
        
        if (Math.abs(estimationDiff) <= 50) {
            appendOutput(`• Response Estimation: Very close (±${Math.abs(estimationDiff)} tokens)\n`, 'success');
        } else if (Math.abs(estimationDiff) <= 150) {
            appendOutput(`• Response Estimation: Good (${estimationDiff > 0 ? '+' : ''}${estimationDiff} tokens, ${estimationAccuracy}%)\n`, 'info');
        } else {
            appendOutput(`• Response Estimation: Off by ${Math.abs(estimationDiff)} tokens (${estimationAccuracy}%)\n`, 'warning');
        }
        
        updateProgress(100, 'Review completed successfully!');
        showAlert('Review completed successfully!', 'success');
    } else {
        appendOutput('❌ AI review failed to generate feedback.\n', 'error');
        updateProgress(0, 'Review failed');
        throw new Error('AI failed to generate feedback');
    }
}

function stopReview() {
    if (reviewInProgress) {
        reviewInProgress = false;
        
        // Clean up intervals and listeners
        if (progressUpdateInterval) {
            clearInterval(progressUpdateInterval);
            progressUpdateInterval = null;
        }
        
        if (ollamaProgressHandler) {
            ollamaProgressHandler();
            ollamaProgressHandler = null;
        }
        
        appendOutput('\n🛑 Review stopped by user\n', 'warning');
        appendOutput('━'.repeat(50) + '\n', 'separator');
        
        // Reset UI
        document.getElementById('start-review-btn').classList.remove('hidden');
        document.getElementById('stop-review-btn').classList.add('hidden');
        updateStatus('Review stopped');
        updateProgress(0);
        
        showAlert('Review stopped', 'warning');
    }
}

// Output Functions
function clearOutput() {
    const outputContent = document.getElementById('output-content');
    outputContent.innerHTML = `
        <div class="text-center text-base-content/60 py-8">
            <h3 class="text-xl font-bold mb-4">Welcome to Local AI PR Reviewer! 🚀</h3>
            <div class="text-left max-w-2xl mx-auto space-y-2">
                <p><strong>Getting Started:</strong></p>
                <p>1. Configure Ollama URL and Model above</p>
                <p>2. Browse and select your Git repository</p>
                <p>3. Choose From and To branches for comparison</p>
                <p>4. Click 'Start AI Review' to analyze differences</p>
                <br>
                <p><strong>Requirements:</strong></p>
                <p>• Ollama must be running locally</p>
                <p>• The specified model must be downloaded</p>
                <p>• Repository must be a valid Git repository</p>
            </div>
        </div>
    `;
    resetStats();
    updateProgress(0);
}

function appendOutput(text, style = '') {
    const outputContent = document.getElementById('output-content');
    
    // Clear welcome message if it exists
    const welcomeMsg = outputContent.querySelector('.text-center');
    if (welcomeMsg) {
        outputContent.innerHTML = '';
    }
    
    const styleClasses = {
        'header': 'text-2xl font-bold text-primary mb-2',
        'subheader': 'text-lg font-bold text-secondary mb-1',
        'ai-title': 'text-xl font-bold text-accent mb-2',
        'separator': 'text-base-content/30',
        'info': 'text-info',
        'success': 'text-success font-medium',
        'warning': 'text-warning font-medium',
        'error': 'text-error font-medium',
        'code': 'font-mono bg-base-300 px-1 rounded'
    };
    
    // Handle line breaks properly - split by actual newlines, not escaped ones
    const lines = text.split('\n');
    lines.forEach((line, index) => {
        if (index > 0) {
            outputContent.appendChild(document.createElement('br'));
        }
        if (line.trim()) {
            const lineSpan = document.createElement('span');
            lineSpan.className = styleClasses[style] || 'text-base-content';
            lineSpan.textContent = line;
            outputContent.appendChild(lineSpan);
        }
    });
    
    // Auto-scroll to bottom
    const outputContainer = document.getElementById('output-container');
    outputContainer.scrollTop = outputContainer.scrollHeight;
}

function formatAIFeedback(feedback) {
    const lines = feedback.split('\n');
    
    lines.forEach(line => {
        line = line.trim();
        if (!line) {
            appendOutput('\n');
            return;
        }
        
        // Detect different types of content
        if (line.startsWith('##') || line.startsWith('**') || (line.isupper && line.length > 10)) {
            // Section headers
            const cleanLine = line.replace(/#/g, '').replace(/\*/g, '').trim();
            appendOutput(`📋 ${cleanLine}\n`, 'subheader');
        } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
            // List items
            appendOutput(`${line}\n`, 'info');
        } else if (line.toLowerCase().includes('bug') || line.toLowerCase().includes('error') || line.toLowerCase().includes('issue')) {
            // Potential issues
            appendOutput(`🐛 ${line}\n`, 'error');
        } else if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest') || line.toLowerCase().includes('improve')) {
            // Recommendations
            appendOutput(`💡 ${line}\n`, 'warning');
        } else if (line.toLowerCase().includes('good') || line.toLowerCase().includes('well') || line.toLowerCase().includes('no issues')) {
            // Positive feedback
            appendOutput(`✅ ${line}\n`, 'success');
        } else if (line.startsWith('```') || line.startsWith('    ')) {
            // Code blocks
            appendOutput(`${line}\n`, 'code');
        } else {
            // Regular text
            appendOutput(`${line}\n`, 'info');
        }
    });
    
    appendOutput('\n' + '━'.repeat(60) + '\n', 'separator');
    appendOutput('✨ Review completed successfully!\n', 'success');
}

function copyOutput() {
    const outputContent = document.getElementById('output-content');
    const text = outputContent.textContent || outputContent.innerText;
    
    navigator.clipboard.writeText(text).then(() => {
        showAlert('Output copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        showAlert('Failed to copy output', 'error');
    });
}

function exportOutput() {
    const outputContent = document.getElementById('output-content');
    const text = outputContent.textContent || outputContent.innerText;
    
    if (!text.trim()) {
        showAlert('No content to export.', 'warning');
        return;
    }
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pr-review-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('Output exported successfully!', 'success');
}

// Configuration Modal Functions
function openConfigModal() {
    const modal = document.getElementById('config-modal');
    if (modal) {
        modal.showModal();
        // Load current configuration
        loadConfiguration();
    }
}

function saveConfiguration() {
    const ollamaUrl = document.getElementById('ollama-url').value.trim();
    const ollamaModel = document.getElementById('ollama-model').value.trim();
    const basePrompt = document.getElementById('base-prompt').value.trim();
    const userPrompt = document.getElementById('user-prompt').value.trim();
    
    if (!ollamaUrl || !ollamaModel) {
        showAlert('Please fill in all required configuration fields', 'error');
        return;
    }
    
    // Save configuration to localStorage
    localStorage.setItem('ollama-url', ollamaUrl);
    localStorage.setItem('ollama-model', ollamaModel);
    localStorage.setItem('base-prompt', basePrompt);
    localStorage.setItem('user-prompt', userPrompt);
    
    showAlert('Configuration saved successfully!', 'success');
    
    // Close the modal
    const modal = document.getElementById('config-modal');
    if (modal) {
        modal.close();
    }
}

function loadConfiguration() {
    // Load saved configuration from localStorage
    const savedUrl = localStorage.getItem('ollama-url');
    const savedModel = localStorage.getItem('ollama-model');
    const savedBasePrompt = localStorage.getItem('base-prompt');
    const savedUserPrompt = localStorage.getItem('user-prompt');
    
    if (savedUrl) {
        document.getElementById('ollama-url').value = savedUrl;
    }
    
    if (savedModel) {
        document.getElementById('ollama-model').value = savedModel;
    }
    
    if (savedBasePrompt) {
        document.getElementById('base-prompt').value = savedBasePrompt;
    } else {
        // Set default base prompt if none saved
        document.getElementById('base-prompt').value = DEFAULT_BASE_PROMPT;
    }
    
    if (savedUserPrompt) {
        document.getElementById('user-prompt').value = savedUserPrompt;
    }
}

function resetToDefaultPrompts() {
    document.getElementById('base-prompt').value = DEFAULT_BASE_PROMPT;
    document.getElementById('user-prompt').value = '';
    showAlert('Prompts reset to default values', 'info');
    updatePromptPreview();
}

function updatePromptPreview() {
    const basePrompt = document.getElementById('base-prompt').value.trim() || DEFAULT_BASE_PROMPT;
    const userPrompt = document.getElementById('user-prompt').value.trim();
    
    const previewPrompt = buildPrompt('[Your code diff will appear here]', basePrompt, userPrompt);
    document.getElementById('prompt-preview').value = previewPrompt;
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    updateStatus('Ready to review your code changes!');
    loadConfiguration(); // Load saved settings
    console.log('PR Reviewer Electron App initialized');
});
