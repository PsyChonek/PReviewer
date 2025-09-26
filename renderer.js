// Debug mode - can be dynamically controlled via settings
window.DEBUG = false;

// Global state
let currentRepoPath = null;
let reviewInProgress = false;
let reviewStartTime = null;
let progressUpdateInterval = null;
let ollamaProgressHandler = null;
let azureProgressHandler = null;
let currentOutputMarkdown = '';

// AI Prompt Template - Default base prompt
const DEFAULT_BASE_PROMPT = `You are an expert code reviewer. Analyze the following code changes (diff format).
Identify potential bugs, security vulnerabilities, performance issues, and suggest improvements
based on best practices. Focus on the *newly added or modified lines*.
Provide concise, actionable feedback. If no issues, state 'No major issues found.'.

Consider the context of a C# and SQL development environment.

**IMPORTANT: Format your response using Markdown with the following structure:**
- Use ## for main sections (e.g., ## Summary, ## Issues Found, ## Recommendations)
- Use ### for subsections
- Use **bold** for important points
- Use \`code\` for inline code references
- Use \`\`\`language blocks for code examples
- Use bullet points (-) for lists
- Use > for important warnings or notes
- Include line numbers when referencing specific changes

Example format:
## Summary
Brief overview of the changes reviewed.

## Issues Found
### 🚨 Critical Issues
- **Security vulnerability on line 42**: Description
### ⚠️ Potential Issues
- **Performance concern on line 18**: Description

## Recommendations
- Suggestion 1
- Suggestion 2`;

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
    // Improved token estimation based on content analysis and tokenizer behavior

    const characterCount = text.length;
    const lines = text.split('\n');
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

    // Analyze content type to adjust estimation
    let codeRatio = 0;
    let diffRatio = 0;
    let naturalTextRatio = 0;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@@')) {
            diffRatio += line.length;
        } else if (/^[a-zA-Z\s.,!?'"]+$/.test(trimmed)) {
            naturalTextRatio += line.length;
        } else {
            codeRatio += line.length;
        }
    });

    const totalLength = characterCount || 1;
    codeRatio = codeRatio / totalLength;
    diffRatio = diffRatio / totalLength;
    naturalTextRatio = naturalTextRatio / totalLength;

    // Different estimation approaches based on content type
    let charsPerToken;

    if (diffRatio > 0.3) {
        // Diff-heavy content: more symbols and structure
        charsPerToken = 3.8;
    } else if (codeRatio > 0.5) {
        // Code-heavy content: operators, brackets, keywords
        charsPerToken = 4.2;
    } else if (naturalTextRatio > 0.6) {
        // Natural language: longer words, more efficient compression
        charsPerToken = 4.8;
    } else {
        // Mixed content
        charsPerToken = 4.3;
    }

    // Character-based estimate with content-aware adjustment
    const charBasedEstimate = Math.ceil(characterCount / charsPerToken);

    // Word-based estimate with different rates for different content
    let tokensPerWord;
    if (diffRatio > 0.3) {
        tokensPerWord = 0.85; // Diff symbols increase token density
    } else if (codeRatio > 0.5) {
        tokensPerWord = 0.75; // Code has more symbols per word
    } else {
        tokensPerWord = 0.65; // Natural text is more efficient
    }

    const wordBasedEstimate = Math.ceil(wordCount * tokensPerWord);

    // Use weighted average instead of minimum for better accuracy
    const charWeight = 0.7;
    const wordWeight = 0.3;
    let baseEstimate = Math.ceil(charBasedEstimate * charWeight + wordBasedEstimate * wordWeight);

    // Size-based adjustments for very large inputs
    if (characterCount > 100000) { // 100KB+
        // Large inputs tend to have more repetitive patterns
        baseEstimate = Math.ceil(baseEstimate * 0.92);
    }
    if (characterCount > 500000) { // 500KB+
        baseEstimate = Math.ceil(baseEstimate * 0.88);
    }
    if (characterCount > 1000000) { // 1MB+
        baseEstimate = Math.ceil(baseEstimate * 0.85);
    }

    // Apply minimum floor to avoid zero estimates
    const finalEstimate = Math.max(1, baseEstimate);

    // Debug logging (only if DEBUG is true)
    if (window.DEBUG) {
        console.log(`Enhanced Token Estimation Debug:
    - Characters: ${characterCount}
    - Words: ${wordCount}
    - Content Analysis:
      * Code ratio: ${(codeRatio * 100).toFixed(1)}%
      * Diff ratio: ${(diffRatio * 100).toFixed(1)}%
      * Natural text ratio: ${(naturalTextRatio * 100).toFixed(1)}%
    - Chars per token: ${charsPerToken}
    - Tokens per word: ${tokensPerWord}
    - Char-based estimate: ${charBasedEstimate}
    - Word-based estimate: ${wordBasedEstimate}
    - Weighted estimate: ${baseEstimate}
    - Final estimate: ${finalEstimate}`);
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

// Loading State Functions
function showBranchLoadingState(show) {
    const fromBranchDropdown = document.getElementById('from-branch-button')?.closest('.dropdown');
    const toBranchDropdown = document.getElementById('to-branch-button')?.closest('.dropdown');
    const fromSkeleton = document.getElementById('from-branch-skeleton');
    const toSkeleton = document.getElementById('to-branch-skeleton');

    if (show) {
        // Hide dropdowns, show skeletons
        if (fromBranchDropdown) fromBranchDropdown.classList.add('hidden');
        if (toBranchDropdown) toBranchDropdown.classList.add('hidden');
        if (fromSkeleton) fromSkeleton.classList.remove('hidden');
        if (toSkeleton) toSkeleton.classList.remove('hidden');
    } else {
        // Show dropdowns, hide skeletons
        if (fromBranchDropdown) fromBranchDropdown.classList.remove('hidden');
        if (toBranchDropdown) toBranchDropdown.classList.remove('hidden');
        if (fromSkeleton) fromSkeleton.classList.add('hidden');
        if (toSkeleton) toSkeleton.classList.add('hidden');
    }
}

function showLoadingToast(message, persistent = false) {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();

    const toastId = 'loading-toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'alert alert-info shadow-lg max-w-md';
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="stage-spinner"></div>
            <span>${message}</span>
        </div>
    `;

    toastContainer.appendChild(toast);

    // Add entrance animation
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    requestAnimationFrame(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    if (!persistent) {
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-20px)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    }

    return toastId;
}

function hideLoadingToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }
}

function createToastContainer() {
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast toast-top toast-center z-40';
    document.body.appendChild(toastContainer);
    return toastContainer;
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

function showDubiousOwnershipAlert(message, repoPath) {
    // Create or get the toast container
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast toast-top toast-center z-40';
        document.body.appendChild(toastContainer);
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-warning shadow-lg max-w-lg';
    alertDiv.innerHTML = `
        <div class="flex flex-col gap-2 w-full">
            <div class="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6 mt-1" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <div class="flex-1">
                    <div class="font-bold">Git Ownership Issue</div>
                    <div class="text-sm whitespace-pre-wrap">${message}</div>
                </div>
            </div>
            <div class="flex gap-2 mt-2">
                <button class="btn btn-sm btn-success" onclick="fixGitOwnership('${repoPath}')">
                    Fix Ownership
                </button>
                <button class="btn btn-sm btn-ghost" onclick="this.closest('.alert').remove()">
                    Dismiss
                </button>
            </div>
        </div>
    `;

    // Add to toast container
    toastContainer.appendChild(alertDiv);

    // Add entrance animation
    alertDiv.style.opacity = '0';
    alertDiv.style.transform = 'translateY(-20px)';
    requestAnimationFrame(() => {
        alertDiv.style.transition = 'all 0.3s ease';
        alertDiv.style.opacity = '1';
        alertDiv.style.transform = 'translateY(0)';
    });
}

async function fixGitOwnership(repoPath) {
    try {
        // Show loading state
        const fixBtn = document.querySelector('[onclick*="fixGitOwnership"]');
        if (fixBtn) {
            fixBtn.disabled = true;
            fixBtn.innerHTML = '<span class="loading loading-spinner loading-xs"></span> Fixing...';
        }

        const result = await window.electronAPI.fixGitOwnership(repoPath);

        if (result.success) {
            showAlert(result.message, 'success');
            // Remove the ownership alert
            const ownershipAlert = document.querySelector('.alert-warning');
            if (ownershipAlert) ownershipAlert.remove();

            // Try to reload branches automatically
            setTimeout(() => {
                loadBranches(repoPath);
            }, 1000);
        } else {
            showAlert(`Failed to fix ownership: ${result.error}`, 'error');
            if (fixBtn) {
                fixBtn.disabled = false;
                fixBtn.innerHTML = 'Fix Ownership';
            }
        }
    } catch (error) {
        console.error('Error fixing git ownership:', error);
        showAlert(`Error fixing ownership: ${error.message}`, 'error');
        const fixBtn = document.querySelector('[onclick*="fixGitOwnership"]');
        if (fixBtn) {
            fixBtn.disabled = false;
            fixBtn.innerHTML = 'Fix Ownership';
        }
    }
}

function updateStatus(message, showInProgress = false) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
        // Don't add spinner here since we have our own status-spinner element
        statusEl.textContent = message;
    }
}

function updateProgress(percentage, text = '', stage = null, substatus = null) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressSection = document.getElementById('progress-section');
    const elapsedTimeEl = document.getElementById('elapsed-time');
    const statusSpinner = document.getElementById('status-spinner');

    if (progressBar) {
        progressBar.value = percentage;

        // Add smooth animation
        progressBar.style.transition = 'value 0.3s ease';
    }

    if (progressText) {
        progressText.textContent = `${Math.round(percentage)}%`;
    }

    // Update elapsed time - always update if we have a start time
    if (reviewStartTime && elapsedTimeEl) {
        const elapsed = (Date.now() - reviewStartTime) / 1000;
        if (elapsed < 60) {
            elapsedTimeEl.textContent = `${elapsed.toFixed(1)}s`;
        } else {
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            elapsedTimeEl.textContent = `${minutes}m ${seconds.toFixed(0)}s`;
        }
    }

    // Show/hide status spinner
    if (percentage > 0 && percentage < 100) {
        statusSpinner.classList.remove('hidden');
    } else {
        statusSpinner.classList.add('hidden');
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

function toggleDebugPanel() {
    const debugSection = document.getElementById('debug-section');
    const toggleText = document.getElementById('debug-panel-toggle-text');

    if (debugSection.classList.contains('hidden')) {
        debugSection.classList.remove('hidden');
        toggleText.textContent = 'Hide';
    } else {
        debugSection.classList.add('hidden');
        toggleText.textContent = 'Debug';
    }
}


function updateStats(elapsed = null, tokens = null, model = null, stage = null, tokensPerSecond = null) {
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
    
    if (tokens !== null) {
        const tokensEl = document.getElementById('tokens-stat');
        if (tokens >= 1000) {
            tokensEl.textContent = `${(tokens / 1000).toFixed(1)}k`;
        } else {
            tokensEl.textContent = tokens.toString();
        }
    }

    // Update speed - prefer pre-calculated speed from backend, otherwise calculate
    let speedToUse = tokensPerSecond;
    if (speedToUse === null && tokens !== null && elapsed !== null && elapsed > 0) {
        speedToUse = tokens / elapsed;
    }

    if (speedToUse !== null) {
        const speedEl = document.getElementById('speed-stat');
        if (speedToUse >= 1) {
            speedEl.textContent = `${speedToUse.toFixed(1)} t/s`;
        } else {
            speedEl.textContent = `${speedToUse.toFixed(2)} t/s`;
        }

        // Update debug info
        document.getElementById('tokens-per-second').textContent = `${speedToUse.toFixed(2)} t/s`;
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
        const responseTimeSeconds = data.responseTime / 1000;
        if (responseTimeSeconds < 60) {
            responseEl.textContent = `${responseTimeSeconds.toFixed(1)}s`;
        } else {
            const minutes = Math.floor(responseTimeSeconds / 60);
            const seconds = responseTimeSeconds % 60;
            responseEl.textContent = `${minutes}m ${seconds.toFixed(1)}s`;
        }
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

    // Update token estimation info - prefer actual tokens over estimates
    if (data.actualInputTokens) {
        document.getElementById('estimated-input-tokens').textContent = formatTokenCount(data.actualInputTokens);
    } else if (data.estimatedInputTokens) {
        document.getElementById('estimated-input-tokens').textContent = formatTokenCount(data.estimatedInputTokens);
    }

    if (data.actualOutputTokens) {
        document.getElementById('estimated-output-tokens').textContent = formatTokenCount(data.actualOutputTokens);
    } else if (data.estimatedOutputTokens) {
        document.getElementById('estimated-output-tokens').textContent = formatTokenCount(data.estimatedOutputTokens);
    }
    
    if (data.actualTokens) {
        document.getElementById('actual-tokens').textContent = formatTokenCount(data.actualTokens);
    }

    // Update last update time
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();

    // Debug panel is now manually toggled, don't auto-show
}function resetStats() {
    ['time-stat', 'speed-stat', 'tokens-stat', 'model-stat', 'stage-stat'].forEach(id => {
        document.getElementById(id).textContent = '--';
    });

    ['request-size-stat', 'response-time-stat', 'transfer-stat', 'upload-progress',
     'processing-stage', 'last-update', 'tokens-per-second', 'estimated-input-tokens',
     'estimated-output-tokens', 'actual-tokens'].forEach(id => {
        document.getElementById(id).textContent = '--';
    });

    // Reset elapsed time display
    const elapsedTimeEl = document.getElementById('elapsed-time');
    if (elapsedTimeEl) {
        elapsedTimeEl.textContent = '0s';
    }

    // Hide preview section when resetting
    document.getElementById('token-preview').classList.add('hidden');

    hideStats();
    hideDebugInfo();
}

// Branch dropdown functionality
let fromBranchList = [];
let toBranchList = [];


function filterFromBranches(filterText) {
    const list = document.getElementById('from-branch-list');
    const filteredBranches = fromBranchList.filter(branch =>
        branch.toLowerCase().includes(filterText.toLowerCase())
    );

    list.innerHTML = '';
    filteredBranches.forEach(branch => {
        const li = document.createElement('li');
        li.innerHTML = `<a onclick="selectFromBranch('${branch}')">${branch}</a>`;
        list.appendChild(li);
    });
}

function filterToBranches(filterText) {
    const list = document.getElementById('to-branch-list');
    const filteredBranches = toBranchList.filter(branch =>
        branch.toLowerCase().includes(filterText.toLowerCase())
    );

    list.innerHTML = '';
    filteredBranches.forEach(branch => {
        const li = document.createElement('li');
        li.innerHTML = `<a onclick="selectToBranch('${branch}')">${branch}</a>`;
        list.appendChild(li);
    });
}

function selectFromBranch(branch) {
    document.getElementById('from-branch-display').textContent = branch;
    // Close DaisyUI dropdown by removing focus
    const button = document.getElementById('from-branch-button');
    button.blur();
    document.activeElement?.blur();

    // Additional method: remove tabindex temporarily to force close
    setTimeout(() => {
        button.setAttribute('tabindex', '-1');
        setTimeout(() => button.setAttribute('tabindex', '0'), 100);
    }, 10);

    // Trigger preview update
    previewTokenEstimate();
}

function selectToBranch(branch) {
    document.getElementById('to-branch-display').textContent = branch;
    // Close DaisyUI dropdown by removing focus
    const button = document.getElementById('to-branch-button');
    button.blur();
    document.activeElement?.blur();

    // Additional method: remove tabindex temporarily to force close
    setTimeout(() => {
        button.setAttribute('tabindex', '-1');
        setTimeout(() => button.setAttribute('tabindex', '0'), 100);
    }, 10);

    // Trigger preview update
    previewTokenEstimate();
}


// Repository Functions
async function selectRepository() {
    let loadingToastId = null;
    try {
        const repoPath = await window.electronAPI.selectDirectory();
        if (repoPath) {
            currentRepoPath = repoPath;
            document.getElementById('repo-path').value = repoPath;

            loadingToastId = showLoadingToast('Loading repository branches...', true);
            updateStatus('Loading repository branches...');
            await loadBranches(repoPath);

            if (loadingToastId) hideLoadingToast(loadingToastId);
            showAlert('Repository loaded successfully!', 'success');
        }
    } catch (error) {
        if (loadingToastId) hideLoadingToast(loadingToastId);
        console.error('Error selecting repository:', error);

        let userMessage = error.message;

        // Provide user-friendly interpretations of common errors
        if (error.message.includes('not a git repository')) {
            userMessage = 'Selected folder is not a Git repository.\n\n' +
                'Please select a folder that:\n' +
                '• Contains a .git directory\n' +
                '• Was initialized with "git init"\n' +
                '• Is the root of a Git project';
        } else if (error.message.includes('permission') || error.message.includes('access')) {
            userMessage = 'Permission denied accessing the selected folder.\n\n' +
                'Please check that:\n' +
                '• You have read access to the folder\n' +
                '• The folder is not locked by another application\n' +
                '• You have necessary file system permissions';
        } else if (error.message.includes('Failed to get branches')) {
            userMessage = 'Unable to load Git branches from this repository.\n\n' +
                'This could be because:\n' +
                '• Git is not installed or not in PATH\n' +
                '• The repository is corrupted\n' +
                '• No branches exist in the repository';
        }

        showAlert(userMessage, 'error');
    } finally {
        updateStatus('Ready');
    }
}

async function previewTokenEstimate() {
    const repoPath = document.getElementById('repo-path').value.trim();
    const fromBranch = document.getElementById('from-branch-display').textContent;
    const toBranch = document.getElementById('to-branch-display').textContent;
    
    // Clear previous preview
    const previewEl = document.getElementById('token-preview');
    previewEl.classList.add('hidden');
    
    if (!repoPath || !fromBranch || !toBranch ||
        fromBranch === 'Select repository first...' || toBranch === 'Select repository first...' ||
        fromBranch === toBranch) {
        // Disable start button when invalid selection
        document.getElementById('start-review-btn').disabled = true;
        return;
    }
    
    try {
        updateStatus('Analyzing changes...');
        
        // Generate diff for preview
        const diff = await window.electronAPI.getGitDiff(repoPath, toBranch, fromBranch);
        
        if (!diff || diff.trim() === '') {
            document.getElementById('preview-status').textContent = 'No changes detected between selected branches';
            document.getElementById('preview-details').classList.add('hidden');
            previewEl.classList.remove('hidden');
            updateStatus('Ready');
            // Disable start button when no changes detected
            document.getElementById('start-review-btn').disabled = true;
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
            costWarningEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Large prompt - may take longer and use more resources';
            costWarningEl.classList.remove('hidden');
        } else {
            costWarningEl.classList.add('hidden');
        }
        
        document.getElementById('preview-details').classList.remove('hidden');
        previewEl.classList.remove('hidden');

        // Enable start button when changes are detected
        document.getElementById('start-review-btn').disabled = false;
        
    } catch (error) {
        console.error('Error generating preview:', error);
        document.getElementById('preview-status').textContent = `Error analyzing changes: ${error.message}`;
        document.getElementById('preview-details').classList.add('hidden');
        previewEl.classList.remove('hidden');
        // Disable start button on error
        document.getElementById('start-review-btn').disabled = true;
    } finally {
        updateStatus('Ready');
    }
}

async function loadBranches(repoPath) {
    // Show skeleton loading states
    showBranchLoadingState(true);

    try {
        if (window.DEBUG) {
            console.log(`Loading branches for repository: ${repoPath}`);
        }

        const branches = await window.electronAPI.getGitBranches(repoPath);
        
        if (window.DEBUG) {
            console.log(`📋 Found ${branches.length} branches:`, branches);
        }
        
        // Store branches for filtering
        fromBranchList = [...branches];
        toBranchList = [...branches, 'HEAD']; // Add HEAD option to target branch

        // Populate dropdown lists
        filterFromBranches(''); // Show all branches initially
        filterToBranches(''); // Show all branches initially

        // Set default values
        if (branches.length > 0) {
            // Set first branch as default from branch
            selectFromBranch(branches[0]);

            // Try to set main/master as default target
            const mainBranches = ['main', 'master', 'develop'];
            let defaultToBranch = 'HEAD';
            for (const mainBranch of mainBranches) {
                if (branches.includes(mainBranch)) {
                    defaultToBranch = mainBranch;
                    break;
                }
            }
            selectToBranch(defaultToBranch);
        }
        
        // Enable controls
        const fromBranchButton = document.getElementById('from-branch-button');
        const toBranchButton = document.getElementById('to-branch-button');
        if (fromBranchButton) fromBranchButton.removeAttribute('disabled');
        if (toBranchButton) toBranchButton.removeAttribute('disabled');
        // Don't enable start button here - let previewTokenEstimate handle it
        
        // Trigger initial preview
        setTimeout(previewTokenEstimate, 100);
        
        updateStatus('Repository loaded successfully');

        // Hide skeleton loading states
        showBranchLoadingState(false);

    } catch (error) {
        // Hide skeleton loading states on error too
        showBranchLoadingState(false);
        console.error('Error loading branches:', error);

        let userMessage = `Error loading branches: ${error.message}`;

        // Parse and provide specific guidance based on error type
        if (error.message.includes('Git is installed')) {
            userMessage = 'Git is not installed or not accessible.\n\n' +
                'To fix this:\n' +
                '1. Install Git from https://git-scm.com/\n' +
                '2. Restart this application\n' +
                '3. Verify installation by running "git --version" in terminal';
        } else if (error.message.includes('not a git repository')) {
            userMessage = 'The selected folder is not a Git repository.\n\n' +
                'Solutions:\n' +
                '1. Navigate to a folder with a .git directory\n' +
                '2. Initialize Git in this folder: "git init"\n' +
                '3. Clone a repository: "git clone <url>"';
        } else if (error.message.includes('dubious ownership')) {
            userMessage = error.message; // Use the detailed message from main.js
            // Show a special alert with a fix button for dubious ownership
            showDubiousOwnershipAlert(userMessage, repoPath);
            return; // Don't show the regular alert
        } else if (error.message.includes('no branches') || error.message.includes('no refs found')) {
            userMessage = 'No branches found in this repository.\n\n' +
                'This repository might be:\n' +
                '1. Newly initialized - make your first commit\n' +
                '2. Empty - add files and commit them\n' +
                '3. Corrupted - try cloning fresh from remote';
        }

        showAlert(userMessage, 'error');
        
        // Reset branch dropdowns
        const fromBranchButton = document.getElementById('from-branch-button');
        const toBranchButton = document.getElementById('to-branch-button');
        const fromBranchDisplay = document.getElementById('from-branch-display');
        const toBranchDisplay = document.getElementById('to-branch-display');

        if (fromBranchDisplay) fromBranchDisplay.textContent = 'Error loading branches';
        if (toBranchDisplay) toBranchDisplay.textContent = 'Error loading branches';
        if (fromBranchButton) fromBranchButton.setAttribute('disabled', '');
        if (toBranchButton) toBranchButton.setAttribute('disabled', '');
        document.getElementById('start-review-btn').disabled = true;
    }
}

// Provider toggle functions
function toggleProviderSettings() {
    const provider = document.getElementById('ai-provider').value;
    const ollamaSettings = document.getElementById('ollama-settings');
    const azureSettings = document.getElementById('azure-ai-settings');

    if (provider === 'azure') {
        ollamaSettings.classList.add('hidden');
        azureSettings.classList.remove('hidden');
    } else {
        ollamaSettings.classList.remove('hidden');
        azureSettings.classList.add('hidden');
    }
}

// AI API Functions
async function testConnection() {
    const provider = document.getElementById('ai-provider').value;

    if (provider === 'azure') {
        await testAzureConnection();
    } else {
        await testOllamaConnection();
    }
}

async function testOllamaConnection() {
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
                        <span class="font-semibold">Ollama Connection Successful!</span>
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
                        <span class="font-semibold">Ollama Connection Failed</span>
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
        console.error('Ollama connection test error:', error);
        const errorMessage = `
            <div>
                <div class="flex items-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span class="font-semibold">Ollama Test Failed</span>
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

async function testAzureConnection() {
    const endpoint = document.getElementById('azure-endpoint').value.trim();
    const apiKey = document.getElementById('azure-api-key').value.trim();
    const deploymentName = document.getElementById('azure-deployment').value.trim();

    if (!endpoint || !apiKey || !deploymentName) {
        showConnectionTestResult('Please provide Azure AI Endpoint, API Key, and Deployment Name.', 'error');
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
        const result = await window.electronAPI.testAzureAIConnection({ endpoint, apiKey, deploymentName });

        if (result.success) {
            const successMessage = `
                <div>
                    <div class="flex items-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span class="font-semibold">Azure AI Connection Successful!</span>
                    </div>
                    <div class="text-sm space-y-1">
                        <div><strong>Endpoint:</strong> ${endpoint}</div>
                        <div><strong>Deployment:</strong> ${deploymentName}</div>
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
                        <span class="font-semibold">Azure AI Connection Failed</span>
                    </div>
                    <div class="text-sm">
                        <div><strong>Endpoint:</strong> ${endpoint}</div>
                        <div><strong>Deployment:</strong> ${deploymentName}</div>
                        <div><strong>Error:</strong> ${result.error}</div>
                    </div>
                </div>
            `;
            showConnectionTestResult(errorMessage, 'error');
        }

    } catch (error) {
        console.error('Azure AI connection test error:', error);
        const errorMessage = `
            <div>
                <div class="flex items-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span class="font-semibold">Azure AI Test Failed</span>
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

    const provider = document.getElementById('ai-provider').value;
    const repoPath = document.getElementById('repo-path').value.trim();
    const fromBranch = document.getElementById('from-branch-display').textContent;
    const toBranch = document.getElementById('to-branch-display').textContent;

    // Get provider-specific configuration
    let aiConfig;
    if (provider === 'azure') {
        const endpoint = document.getElementById('azure-endpoint').value.trim();
        const apiKey = document.getElementById('azure-api-key').value.trim();
        const deploymentName = document.getElementById('azure-deployment').value.trim();

        if (!endpoint || !apiKey || !deploymentName) {
            showAlert('Please provide Azure AI Endpoint, API Key, and Deployment Name.', 'error');
            return;
        }

        aiConfig = { provider: 'azure', endpoint, apiKey, deploymentName };
    } else {
        const ollamaUrl = document.getElementById('ollama-url').value.trim();
        const ollamaModel = document.getElementById('ollama-model').value.trim();

        if (!ollamaUrl || !ollamaModel) {
            showAlert('Please provide both Ollama URL and Model name.', 'error');
            return;
        }

        aiConfig = { provider: 'ollama', url: ollamaUrl, model: ollamaModel };
    }

    if (window.DEBUG) {
        console.log('Starting review with configuration:', {
            repoPath,
            fromBranch,
            toBranch,
            aiConfig,
            debugMode: window.DEBUG
        });
    }

    // Validation
    if (!repoPath) {
        showAlert('Please select a repository path.', 'error');
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

    const modelName = provider === 'azure' ? aiConfig.deploymentName : aiConfig.model;
    updateStats(0, 0, modelName, 'initializing');

    try {
        await runReview(repoPath, fromBranch, toBranch, aiConfig);
    } catch (error) {
        console.error('Review error:', error);

        let userMessage = `Review failed: ${error.message}`;

        // Provide specific guidance based on error patterns
        if (error.message.includes('Failed to generate diff')) {
            userMessage = 'Unable to generate code differences.\n\n' +
                'Possible causes:\n' +
                '• Selected branches do not exist or are identical\n' +
                '• Git repository is corrupted\n' +
                '• Insufficient permissions to read repository\n' +
                '• Network issues if branches are remote';
        } else if (error.message.includes('AI analysis failed')) {
            const providerName = provider === 'azure' ? 'Azure AI' : 'Ollama';
            userMessage = `${providerName} model failed to analyze the code.\n\n` +
                'Solutions to try:\n';

            if (provider === 'azure') {
                userMessage += '• Check your Azure AI service status\n' +
                    '• Verify API key and endpoint are correct\n' +
                    '• Ensure deployment is active and running\n' +
                    '• Check your Azure AI quota limits\n' +
                    '• Verify internet connectivity to Azure';
            } else {
                userMessage += '• Check if Ollama is running: "ollama serve"\n' +
                    '• Verify the model is installed: "ollama list"\n' +
                    '• Try a different model in settings\n' +
                    '• Reduce the code diff size\n' +
                    '• Check system resources (CPU, memory)';
            }
        } else if (error.message.includes('Network Error') || error.message.includes('Could not connect')) {
            const providerName = provider === 'azure' ? 'Azure AI service' : 'Ollama';
            userMessage = `Cannot connect to the ${providerName}.\n\n` +
                'Check these settings:\n';

            if (provider === 'azure') {
                userMessage += '• Internet connection is working\n' +
                    '• Azure AI endpoint URL is correct\n' +
                    '• Firewall allows connections to Azure\n' +
                    '• Azure AI service is operational';
            } else {
                userMessage += '• Ollama server is running: "ollama serve"\n' +
                    '• API URL is correct (usually http://localhost:11434/api/generate)\n' +
                    '• Firewall allows connections to port 11434\n' +
                    '• No other processes are blocking the port';
            }
        }

        appendOutput(`\n<i class="fas fa-bomb"></i> ${userMessage}\n`, 'error');
        showAlert(userMessage, 'error');
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

        if (azureProgressHandler) {
            azureProgressHandler();
            azureProgressHandler = null;
        }

        // Reset UI
        reviewInProgress = false;
        document.getElementById('start-review-btn').classList.remove('hidden');
        document.getElementById('stop-review-btn').classList.add('hidden');
        updateStatus('Review completed');
    }
}

async function runReview(repoPath, fromBranch, toBranch, aiConfig) {
    const { provider } = aiConfig;
    const modelName = provider === 'azure' ? aiConfig.deploymentName : aiConfig.model;
    // Setup progress listener based on provider
    if (provider === 'azure') {
        if (azureProgressHandler) {
            azureProgressHandler(); // Remove previous listener
        }
    } else {
        if (ollamaProgressHandler) {
            ollamaProgressHandler(); // Remove previous listener
        }
    }
    
    ollamaProgressHandler = window.electronAPI.onOllamaProgress((event, data) => {
        updateProgress(data.progress, data.message);
        updateStats(
            data.processingTime || (Date.now() - reviewStartTime) / 1000,
            data.tokens,
            ollamaModel,
            data.stage,
            data.tokensPerSecond
        );
        
        // Update debug info with actual token information when available
        const debugData = { ...data };
        if (data.tokens) {
            debugData.actualTokens = data.tokens;
        }
        updateDebugInfo(debugData);
        
        // Handle streaming content display
        if (data.streamingContent && data.isStreaming) {
            // Update the output with streaming content in real-time
            currentOutputMarkdown = data.streamingContent + '\n\n';
            renderOutput();
        }

        // Show real-time progress messages only in debug mode
        if (window.DEBUG) {
            if (data.stage === 'complete') {
                appendOutput(`Response received (${data.tokens} tokens)\n`, 'success');
            } else if (data.stage === 'error') {
                appendOutput(`Error: ${data.message}\n`, 'error');
            }
        }
    });

    // Azure progress handler
    if (provider === 'azure') {
        azureProgressHandler = window.electronAPI.onAzureAIProgress((event, data) => {
            updateProgress(data.progress, data.message);
            updateStats(
                data.processingTime || (Date.now() - reviewStartTime) / 1000,
                data.tokens,
                modelName,
                data.stage,
                data.tokensPerSecond
            );

            // Update debug info with actual token information when available
            const debugData = { ...data };
            if (data.tokens) {
                debugData.actualTokens = data.tokens;
            }
            updateDebugInfo(debugData);

            // Handle streaming content display
            if (data.streamingContent && data.isStreaming) {
                // Update the output with streaming content in real-time
                currentOutputMarkdown = data.streamingContent + '\n\n';
                renderOutput();
            }

            // Show real-time progress messages only in debug mode
            if (window.DEBUG) {
                if (data.stage === 'complete') {
                    appendOutput(`Response received (${data.tokens} tokens)\n`, 'success');
                } else if (data.stage === 'error') {
                    appendOutput(`Error: ${data.message}\n`, 'error');
                }
            }
        });
    }

    // Only show basic info if debug mode is enabled
    if (window.DEBUG) {
        appendOutput(`Analyzing changes: ${toBranch} → ${fromBranch}\n`, 'info');
        appendOutput(`Using ${provider === 'azure' ? 'Azure AI' : 'Ollama'}: ${modelName}\n\n`, 'info');
    }
    
    updateProgress(10, 'Initializing review process...');
    updateStats(0, 0, modelName, 'initializing');

    // Start real-time updates
    progressUpdateInterval = setInterval(() => {
        if (reviewInProgress) {
            const elapsed = (Date.now() - reviewStartTime) / 1000;
            updateStats(elapsed, null, modelName, null);
        }
    }, 100); // Update every 100ms for smooth real-time feel

    updateProgress(15, 'Generating diff...');
    
    const diffStartTime = Date.now();
    let diff;
    
    try {
        diff = await window.electronAPI.getGitDiff(repoPath, toBranch, fromBranch);
    } catch (error) {
        throw new Error(`Failed to generate diff: ${error.message}`);
    }
    
    const diffElapsed = (Date.now() - diffStartTime) / 1000;
    
    if (!diff || diff.trim() === '') {
        if (window.DEBUG) {
            appendOutput('No changes detected between branches.\n', 'warning');
        }
        updateProgress(100, 'No changes found');
        clearInterval(progressUpdateInterval);
        if (ollamaProgressHandler) ollamaProgressHandler();
        if (azureProgressHandler) azureProgressHandler();
        return;
    }

    if (window.DEBUG) {
        appendOutput(`Found ${diff.split('\n').length} lines of changes to analyze.\n`, 'info');
    }
    
    updateProgress(35, 'Preparing AI analysis...');
    updateStats((Date.now() - reviewStartTime) / 1000, null, modelName, 'preparing');
    
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
    
    // AI Analysis (only show details in debug mode)
    if (window.DEBUG) {
        appendOutput(`Prompt size: ${(prompt.length / 1024).toFixed(1)} KB, Estimated tokens: ${formatTokenCount(estimatedInputTokens)}\n`, 'info');
    }
    
    // Update debug info with token estimation and request size
    updateDebugInfo({
        estimatedInputTokens: estimatedInputTokens,
        estimatedOutputTokens: estimatedOutputTokens,
        modelSize: prompt.length,
        stage: 'token-estimation'
    });
    
    updateProgress(45, 'Starting AI analysis...');

    const aiStartTime = Date.now();
    let aiFeedback;

    try {
        if (provider === 'azure') {
            aiFeedback = await window.electronAPI.callAzureAI({
                endpoint: aiConfig.endpoint,
                apiKey: aiConfig.apiKey,
                deploymentName: aiConfig.deploymentName,
                prompt: prompt
            });
        } else {
            aiFeedback = await window.electronAPI.callOllamaAPI({
                url: aiConfig.url,
                model: aiConfig.model,
                prompt: prompt
            });
        }
    } catch (error) {
        clearInterval(progressUpdateInterval);
        if (ollamaProgressHandler) ollamaProgressHandler();
        throw new Error(`AI analysis failed: ${error.message}`);
    }
    
    const aiElapsed = (Date.now() - aiStartTime) / 1000;
    const totalElapsed = (Date.now() - reviewStartTime) / 1000;
    
    updateProgress(95, 'Formatting results...');
    updateStats(totalElapsed, null, modelName, 'formatting');

    clearInterval(progressUpdateInterval);
    if (ollamaProgressHandler) ollamaProgressHandler();
    if (azureProgressHandler) azureProgressHandler();
    
    // Display results - let the AI response speak for itself with proper Markdown

    if (aiFeedback) {
        // Only set the content if streaming hasn't already populated it
        if (!currentOutputMarkdown || currentOutputMarkdown.trim() === '') {
            currentOutputMarkdown = aiFeedback + '\n\n';
        } else {
            // Ensure the content is complete (streaming might have partial content)
            currentOutputMarkdown = aiFeedback + '\n\n';
        }

        // Update final stats with actual response tokens
        const actualResponseTokens = aiFeedback.split(' ').length;

        updateStats(totalElapsed, actualResponseTokens, modelName, 'complete');

        // Update debug info with final token comparison and response metrics
        updateDebugInfo({
            actualTokens: actualResponseTokens,
            responseTime: Math.round(aiElapsed * 1000),
            bytesReceived: aiFeedback.length,
            stage: 'complete'
        });

        // Render the final output
        renderOutput();

        // Only show detailed performance info in debug mode
        if (window.DEBUG) {
            appendOutput(`\nCompleted in ${totalElapsed.toFixed(1)}s using ${modelName}\n`, 'info');
        }
        
        // Calculate final elapsed time and update one more time
        const finalElapsed = (Date.now() - reviewStartTime) / 1000;
        updateProgress(100, 'Review completed successfully!');
        updateStats(finalElapsed, actualResponseTokens, modelName, 'complete');
        showAlert('Review completed successfully!', 'success');
    } else {
        appendOutput('<i class="fas fa-times"></i> AI review failed to generate feedback.\n', 'error');
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
    const welcomeMarkdown = `# Welcome to Local AI PR Reviewer! <i class="fas fa-rocket"></i>

## Getting Started:
1. Configure your AI provider (Ollama or Azure AI) in Settings
2. Browse and select your Git repository
3. Choose From and To branches for comparison
4. Click 'Start AI Review' to analyze differences

## Requirements:
- **For Ollama**: Local Ollama server must be running
- **For Azure AI**: Valid endpoint, API key, and deployment
- **Repository**: Must be a valid Git repository`;

    // Reset the markdown accumulator
    currentOutputMarkdown = '';

    if (typeof marked !== 'undefined') {
        outputContent.innerHTML = `<div class="text-center py-8">${marked.parse(welcomeMarkdown)}</div>`;
    } else {
        outputContent.innerHTML = `<div class="text-center py-8">${simpleMarkdownRender(welcomeMarkdown)}</div>`;
    }
    resetStats();
    updateProgress(0);
}

function appendOutput(text, style = '') {
    // Clear welcome message if this is the first output
    if (currentOutputMarkdown === '') {
        const outputContent = document.getElementById('output-content');
        const welcomeMsg = outputContent.querySelector('.text-center');
        if (welcomeMsg) {
            outputContent.innerHTML = '';
            currentOutputMarkdown = '';
        }
    }

    // Convert styled text to appropriate Markdown formatting
    const lines = text.split('\n');
    lines.forEach((line, index) => {
        if (line.trim()) {
            let markdownLine = line;

            switch (style) {
                case 'header':
                    markdownLine = `# ${line}`;
                    break;
                case 'subheader':
                    markdownLine = `## ${line}`;
                    break;
                case 'ai-title':
                    markdownLine = `# ${line}`;
                    break;
                case 'separator':
                    markdownLine = `---`;
                    break;
                case 'success':
                    // Only add emoji if the line doesn't already start with one
                    markdownLine = line.startsWith('✅') ? line : `✅ ${line}`;
                    break;
                case 'warning':
                    // Only add emoji if the line doesn't already start with one
                    markdownLine = line.startsWith('⚠️') ? line : `⚠️ ${line}`;
                    break;
                case 'error':
                    // Only add emoji if the line doesn't already start with one
                    markdownLine = line.startsWith('❌') ? line : `❌ ${line}`;
                    break;
                case 'code':
                    markdownLine = `\`${line}\``;
                    break;
                case 'info':
                default:
                    // Keep as-is, already has emojis from the original code
                    break;
            }

            currentOutputMarkdown += markdownLine + '\n';
        } else if (index < lines.length - 1) {
            currentOutputMarkdown += '\n';
        }
    });

    // Render the accumulated Markdown content
    renderOutput();
}

function renderOutput() {
    const outputContent = document.getElementById('output-content');
    if (currentOutputMarkdown.trim()) {
        if (typeof marked !== 'undefined') {
            // Configure marked options for better security and formatting
            marked.setOptions({
                breaks: true,
                gfm: true,
                sanitize: false, // We control the content, so it's safe
                headerIds: false,
                mangle: false
            });

            try {
                outputContent.innerHTML = marked.parse(currentOutputMarkdown);
            } catch (error) {
                console.error('Markdown parsing error:', error);
                // Fallback to simple renderer
                outputContent.innerHTML = simpleMarkdownRender(currentOutputMarkdown);
            }
        } else {
            // Fallback: simple markdown-like rendering
            outputContent.innerHTML = simpleMarkdownRender(currentOutputMarkdown);
        }
    }

    // Auto-scroll to bottom
    const outputContainer = document.getElementById('output-container');
    outputContainer.scrollTop = outputContainer.scrollHeight;
}

// Simple fallback markdown renderer
function simpleMarkdownRender(text) {
    return text
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')

        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')

        // Code blocks (must come before inline code)
        .replace(/```([^`]*?)```/gs, '<pre><code>$1</code></pre>')

        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')

        // YAML-like structure (key: value)
        .replace(/^(\s*)([\w\s]+):\s*(.*)$/gim, '$1<strong>$2:</strong> $3')

        // Lists
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

        // Horizontal rules
        .replace(/^---$/gm, '<hr>')

        // Line breaks (do this last)
        .replace(/\n/g, '<br>');
}

// formatAIFeedback function removed - now using direct Markdown rendering

function copyOutput() {
    // Copy the raw Markdown content instead of rendered HTML
    const textToCopy = currentOutputMarkdown || 'No content to copy';

    navigator.clipboard.writeText(textToCopy).then(() => {
        showAlert('Markdown content copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        showAlert('Failed to copy output', 'error');
    });
}

function exportOutput() {
    // Export the raw Markdown content
    const textToExport = currentOutputMarkdown || '';

    if (!textToExport.trim()) {
        showAlert('No content to export.', 'warning');
        return;
    }

    const blob = new Blob([textToExport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-review-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showAlert('Review exported as Markdown!', 'success');
}

// Configuration Modal Functions
function openConfigModal() {
    console.log('openConfigModal called');
    const modal = document.getElementById('config-modal');
    console.log('Modal element:', modal);
    if (modal) {
        console.log('Opening modal...');
        modal.showModal();
        console.log('Modal opened, classes:', modal.classList.toString());
        // Load current configuration
        loadConfiguration();
    } else {
        console.error('Modal element not found!');
    }
}

function saveConfiguration() {
    const provider = document.getElementById('ai-provider').value;
    const basePrompt = document.getElementById('base-prompt').value.trim();
    const userPrompt = document.getElementById('user-prompt').value.trim();
    const debugEnabled = document.getElementById('debug-enabled').checked;

    // Provider-specific validation and saving
    if (provider === 'azure') {
        const azureEndpoint = document.getElementById('azure-endpoint').value.trim();
        const azureApiKey = document.getElementById('azure-api-key').value.trim();
        const azureDeployment = document.getElementById('azure-deployment').value.trim();

        if (!azureEndpoint || !azureApiKey || !azureDeployment) {
            showAlert('Please fill in all required Azure AI configuration fields', 'error');
            return;
        }

        // Save Azure AI configuration to localStorage
        localStorage.setItem('azure-endpoint', azureEndpoint);
        localStorage.setItem('azure-api-key', azureApiKey);
        localStorage.setItem('azure-deployment', azureDeployment);
    } else {
        const ollamaUrl = document.getElementById('ollama-url').value.trim();
        const ollamaModel = document.getElementById('ollama-model').value.trim();

        if (!ollamaUrl || !ollamaModel) {
            showAlert('Please fill in all required Ollama configuration fields', 'error');
            return;
        }

        // Save Ollama configuration to localStorage
        localStorage.setItem('ollama-url', ollamaUrl);
        localStorage.setItem('ollama-model', ollamaModel);
    }

    // Save common configuration to localStorage
    localStorage.setItem('ai-provider', provider);
    localStorage.setItem('base-prompt', basePrompt);
    localStorage.setItem('user-prompt', userPrompt);
    localStorage.setItem('debug-enabled', debugEnabled.toString());
    
    // Update the global DEBUG constant
    window.DEBUG = debugEnabled;
    
    // Log debug mode change
    if (debugEnabled) {
        console.log('🐛 Debug mode enabled - detailed logging activated');
    } else {
        console.log('🔇 Debug mode disabled - detailed logging deactivated');
    }
    
    showAlert('Configuration saved successfully!', 'success');
    
    // Close the modal
    const modal = document.getElementById('config-modal');
    if (modal) {
        modal.close();
    }
}

function loadConfiguration() {
    // Load saved configuration from localStorage
    const savedProvider = localStorage.getItem('ai-provider') || 'ollama';
    const savedUrl = localStorage.getItem('ollama-url');
    const savedModel = localStorage.getItem('ollama-model');
    const savedAzureEndpoint = localStorage.getItem('azure-endpoint');
    const savedAzureApiKey = localStorage.getItem('azure-api-key');
    const savedAzureDeployment = localStorage.getItem('azure-deployment');
    const savedBasePrompt = localStorage.getItem('base-prompt');
    const savedUserPrompt = localStorage.getItem('user-prompt');
    const savedDebugEnabled = localStorage.getItem('debug-enabled');

    // Set provider
    document.getElementById('ai-provider').value = savedProvider;
    toggleProviderSettings(); // Show/hide appropriate settings

    // Load Ollama settings
    if (savedUrl) {
        document.getElementById('ollama-url').value = savedUrl;
    }
    if (savedModel) {
        document.getElementById('ollama-model').value = savedModel;
    }

    // Load Azure AI settings
    if (savedAzureEndpoint) {
        document.getElementById('azure-endpoint').value = savedAzureEndpoint;
    }
    if (savedAzureApiKey) {
        document.getElementById('azure-api-key').value = savedAzureApiKey;
    }
    if (savedAzureDeployment) {
        document.getElementById('azure-deployment').value = savedAzureDeployment;
    }

    // Load prompt settings
    if (savedBasePrompt) {
        document.getElementById('base-prompt').value = savedBasePrompt;
    } else {
        // Set default base prompt if none saved
        document.getElementById('base-prompt').value = DEFAULT_BASE_PROMPT;
    }
    if (savedUserPrompt) {
        document.getElementById('user-prompt').value = savedUserPrompt;
    }

    // Load debug setting
    const debugEnabled = savedDebugEnabled === 'true';
    document.getElementById('debug-enabled').checked = debugEnabled;
    // Update the global DEBUG constant
    window.DEBUG = debugEnabled;

    // Log debug status
    if (window.DEBUG) {
        console.log('🐛 Debug mode enabled - detailed logging active');
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
