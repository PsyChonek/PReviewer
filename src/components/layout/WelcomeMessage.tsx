import React from 'react';

const WelcomeMessage: React.FC = () => {
	return (
		<div className="text-center text-base-content/60 py-8">
			<h3 className="text-xl font-bold mb-4">
				Welcome to PReviewer! <i className="fas fa-rocket"></i>
			</h3>
			<div className="text-left max-w-2xl mx-auto space-y-2">
				<p>
					<strong>Getting Started:</strong>
				</p>
				<p>1. Configure your AI provider (Ollama or Azure AI) in Settings</p>
				<p>2. Browse and select your Git repository</p>
				<p>3. Choose From and To branches for comparison</p>
				<p>4. Click 'Start AI Review' to analyze differences</p>
				<br />
				<p>
					<strong>Requirements:</strong>
				</p>
				<p>• For Ollama: Local Ollama server must be running</p>
				<p>• For Azure AI: Valid endpoint, API key, and deployment</p>
				<p>• Repository must be a valid Git repository</p>
			</div>
		</div>
	);
};

export default WelcomeMessage;
