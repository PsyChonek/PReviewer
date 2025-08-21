// Global state
let currentRepoPath = null;
let reviewInProgress = false;
let reviewStartTime = null;

// AI Prompt Template
const AI_PROMPT_TEMPLATE = `
You are an expert code reviewer. Analyze the following code changes (diff format).
Identify potential bugs, security vulnerabilities, performance issues, and suggest improvements
based on best practices. Focus on the *newly added or modified lines*.
Provide concise, actionable feedback. If no issues, state 'No major issues found.'.

Consider the context of a C# and SQL development environment.
The feedback should be formatted clearly, focusing on specific lines if possible.
---
Diff:
{diff}
---
Review:
`;

// Utility Functions
function showAlert(message, type = 'info') {
    const alertClasses = {
        'success': 'alert-success',
        'error': 'alert-error',
        'warning': 'alert-warning',
        'info': 'alert-info'
    };
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClasses[type]} mb-4`;
    alertDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>${message}</span>
    `;
    
    document.body.insertBefore(alertDiv, document.body.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
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

function updateStats(elapsed = null, tokens = null, model = null) {
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
    }
    
    if (model !== null) {
        const modelEl = document.getElementById('model-stat');
        const displayName = model.length <= 12 ? model : model.substring(0, 12) + '...';
        modelEl.textContent = displayName;
    }
    
    showStats();
}

function resetStats() {
    ['time-stat', 'speed-stat', 'tokens-stat', 'model-stat'].forEach(id => {
        document.getElementById(id).textContent = '--';
    });
    hideStats();
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
        showAlert('Please provide both Ollama URL and Model name.', 'error');
        return;
    }
    
    clearOutput();
    appendOutput('🔍 Ollama Connection Test\\n', 'header');
    appendOutput('━'.repeat(50) + '\\n\\n', 'separator');
    
    updateStatus('Testing connection...', true);
    
    try {
        appendOutput(`Testing connection to: ${url}\\n`, 'info');
        appendOutput(`Using model: ${model}\\n\\n`, 'info');
        
        const result = await window.electronAPI.testOllamaConnection({ url, model });
        
        if (result.success) {
            appendOutput('✅ Connection test successful!\\n', 'success');
            appendOutput(`Version: ${result.version}\\n`, 'info');
            appendOutput(`Model response: "${result.modelResponse.substring(0, 50)}..."\\n`, 'info');
            appendOutput('\\n━'.repeat(50) + '\\n', 'separator');
            appendOutput('✅ You can now run a code review!\\n', 'success');
            showAlert('Connection test successful!', 'success');
        } else {
            appendOutput('❌ Connection test failed\\n', 'error');
            appendOutput(`Error: ${result.error}\\n`, 'error');
            showAlert(`Connection test failed: ${result.error}`, 'error');
        }
        
        updateStatus('Connection test completed');
        
    } catch (error) {
        console.error('Connection test error:', error);
        appendOutput(`❌ Test failed: ${error.message}\\n`, 'error');
        showAlert(`Connection test failed: ${error.message}`, 'error');
        updateStatus('Test failed');
    }
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
    updateStats(0, 0, ollamaModel);
    
    try {
        await runReview(repoPath, fromBranch, toBranch, ollamaUrl, ollamaModel);
    } catch (error) {
        console.error('Review error:', error);
        appendOutput(`\\n💥 Review failed: ${error.message}\\n`, 'error');
        showAlert(`Review failed: ${error.message}`, 'error');
    } finally {
        // Reset UI
        reviewInProgress = false;
        document.getElementById('start-review-btn').classList.remove('hidden');
        document.getElementById('stop-review-btn').classList.add('hidden');
        updateStatus('Review completed');
    }
}

async function runReview(repoPath, fromBranch, toBranch, ollamaUrl, ollamaModel) {
    // Header
    appendOutput('🔍 AI Code Review Analysis\\n', 'header');
    appendOutput('━'.repeat(60) + '\\n\\n', 'separator');
    
    // Configuration
    appendOutput('📊 Review Configuration\\n', 'subheader');
    appendOutput(`• Repository: ${repoPath.split(/[\\/]/).pop()}\\n`, 'info');
    appendOutput(`• Path: ${repoPath}\\n`, 'info');
    appendOutput(`• Comparing: ${toBranch} → ${fromBranch}\\n`, 'info');
    appendOutput(`• AI Model: ${ollamaModel}\\n`, 'info');
    appendOutput(`• Endpoint: ${ollamaUrl}\\n\\n`, 'info');
    
    updateProgress(15, 'Generating diff...');
    
    // Generate diff
    appendOutput('🔄 Generating Code Diff...\\n', 'subheader');
    appendOutput(`• Source branch: ${fromBranch}\\n`, 'info');
    appendOutput(`• Target branch: ${toBranch}\\n`, 'info');
    appendOutput('• Finding differences...\\n', 'info');
    
    const diffStartTime = Date.now();
    let diff;
    
    try {
        diff = await window.electronAPI.getGitDiff(repoPath, toBranch, fromBranch);
    } catch (error) {
        throw new Error(`Failed to generate diff: ${error.message}`);
    }
    
    const diffElapsed = (Date.now() - diffStartTime) / 1000;
    
    if (!diff || diff.trim() === '') {
        appendOutput('❌ No diff generated or found.\\n', 'warning');
        appendOutput('The branches may be identical or have no common history.\\n', 'info');
        updateProgress(100, 'No changes found');
        return;
    }
    
    appendOutput('✅ Diff generated successfully.\\n', 'success');
    appendOutput('📈 Found changes to analyze.\\n\\n', 'info');
    
    updateProgress(45, 'Calling AI model...');
    
    // AI Analysis
    appendOutput('🤖 AI Analysis in Progress...\\n', 'subheader');
    appendOutput(`📤 Preparing prompt for AI model (${ollamaModel})...\\n`, 'info');
    
    const prompt = AI_PROMPT_TEMPLATE.replace('{diff}', diff);
    
    const aiStartTime = Date.now();
    let aiFeedback;
    
    try {
        aiFeedback = await window.electronAPI.callOllamaAPI({
            url: ollamaUrl,
            model: ollamaModel,
            prompt: prompt
        });
    } catch (error) {
        throw new Error(`AI analysis failed: ${error.message}`);
    }
    
    const aiElapsed = (Date.now() - aiStartTime) / 1000;
    const totalElapsed = (Date.now() - reviewStartTime) / 1000;
    
    updateProgress(90, 'Formatting results...');
    
    // Display results
    appendOutput('\\n' + '═'.repeat(60) + '\\n', 'separator');
    appendOutput('🎯 AI REVIEW RESULTS\\n', 'ai-title');
    appendOutput('═'.repeat(60) + '\\n\\n', 'separator');
    
    if (aiFeedback) {
        formatAIFeedback(aiFeedback);
        
        // Performance summary
        appendOutput('\\n⏱️ Performance Summary:\\n', 'subheader');
        appendOutput(`• Total Time: ${totalElapsed.toFixed(1)}s\\n`, 'info');
        appendOutput(`• Diff Generation: ${diffElapsed.toFixed(1)}s\\n`, 'info');
        appendOutput(`• AI Analysis: ${aiElapsed.toFixed(1)}s\\n`, 'info');
        appendOutput(`• Model: ${ollamaModel}\\n`, 'info');
        
        // Update final stats
        const estimatedTokens = aiFeedback.split(' ').length;
        updateStats(totalElapsed, estimatedTokens, ollamaModel);
        
        updateProgress(100, 'Review completed successfully!');
        showAlert('Review completed successfully!', 'success');
    } else {
        appendOutput('❌ AI review failed to generate feedback.\\n', 'error');
        updateProgress(0, 'Review failed');
        throw new Error('AI failed to generate feedback');
    }
}

function stopReview() {
    if (reviewInProgress) {
        reviewInProgress = false;
        appendOutput('\\n🛑 Review stopped by user\\n', 'warning');
        appendOutput('━'.repeat(50) + '\\n', 'separator');
        
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
    
    const span = document.createElement('span');
    span.className = styleClasses[style] || 'text-base-content';
    span.textContent = text.replace(/\\n/g, '\\n');
    
    // Handle line breaks
    const lines = text.split('\\n');
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
    const lines = feedback.split('\\n');
    
    lines.forEach(line => {
        line = line.trim();
        if (!line) {
            appendOutput('\\n');
            return;
        }
        
        // Detect different types of content
        if (line.startsWith('##') || line.startsWith('**') || (line.isupper && line.length > 10)) {
            // Section headers
            const cleanLine = line.replace(/#/g, '').replace(/\\*/g, '').trim();
            appendOutput(`📋 ${cleanLine}\\n`, 'subheader');
        } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
            // List items
            appendOutput(`${line}\\n`, 'info');
        } else if (line.toLowerCase().includes('bug') || line.toLowerCase().includes('error') || line.toLowerCase().includes('issue')) {
            // Potential issues
            appendOutput(`🐛 ${line}\\n`, 'error');
        } else if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest') || line.toLowerCase().includes('improve')) {
            // Recommendations
            appendOutput(`💡 ${line}\\n`, 'warning');
        } else if (line.toLowerCase().includes('good') || line.toLowerCase().includes('well') || line.toLowerCase().includes('no issues')) {
            // Positive feedback
            appendOutput(`✅ ${line}\\n`, 'success');
        } else if (line.startsWith('```') || line.startsWith('    ')) {
            // Code blocks
            appendOutput(`${line}\\n`, 'code');
        } else {
            // Regular text
            appendOutput(`${line}\\n`, 'info');
        }
    });
    
    appendOutput('\\n' + '━'.repeat(60) + '\\n', 'separator');
    appendOutput('✨ Review completed successfully!\\n', 'success');
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

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    updateStatus('Ready to review your code changes!');
    console.log('PR Reviewer Electron App initialized');
});
