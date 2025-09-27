export function estimateTokens(text: string): number {
    const characterCount = text.length;
    const lines = text.split('\n');
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

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

    let charsPerToken: number;

    if (diffRatio > 0.3) {
        charsPerToken = 3.8;
    } else if (codeRatio > 0.5) {
        charsPerToken = 4.2;
    } else if (naturalTextRatio > 0.6) {
        charsPerToken = 4.8;
    } else {
        charsPerToken = 4.3;
    }

    const baseTokens = Math.ceil(characterCount / charsPerToken);

    const wordBasedTokens = Math.ceil(wordCount * 1.33);

    return Math.max(baseTokens, wordBasedTokens);
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

export function formatTokenCount(count: number): string {
    if (count < 1000) {
        return count.toString();
    } else if (count < 1000000) {
        const k = count / 1000;
        return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
    } else if (count < 1000000000) {
        const m = count / 1000000;
        return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
    } else {
        const b = count / 1000000000;
        return b % 1 === 0 ? `${b}B` : `${b.toFixed(1)}B`;
    }
}