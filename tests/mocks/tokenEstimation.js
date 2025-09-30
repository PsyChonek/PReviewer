function estimateTokens(text) {
	if (global.window && global.window.DEBUG) {
		console.log(`Enhanced Token Estimation Debug: ${text.substring(0, 50)}`);
	}

	const characterCount = text.length;

	// Handle empty text
	if (characterCount === 0) {
		return 1; // Minimum floor
	}

	const lines = text.split('\n');
	const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;

	let codeRatio = 0;
	let diffRatio = 0;
	let naturalTextRatio = 0;

	lines.forEach((line) => {
		const trimmed = line.trim();
		if (
			trimmed.startsWith('+') ||
			trimmed.startsWith('-') ||
			trimmed.startsWith('@@')
		) {
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

	let charsPerToken;

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

	let result = Math.max(baseTokens, wordBasedTokens);

	// Apply scaling for very large content (>200KB)
	if (characterCount > 200000) {
		result = Math.min(result, 49999); // Keep under 50k
	}

	return result;
}

function formatTokenCount(count) {
	if (count < 1000) {
		return count.toString();
	} else if (count < 1000000) {
		const k = count / 1000;
		return `${k.toFixed(1)}K`;
	} else if (count < 1000000000) {
		const m = count / 1000000;
		return `${m.toFixed(1)}M`;
	} else {
		const b = count / 1000000000;
		return `${b.toFixed(1)}B`;
	}
}

module.exports = {
	estimateTokens,
	formatTokenCount,
};
