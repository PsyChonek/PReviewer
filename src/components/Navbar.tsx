import React from 'react';
import { useTokenStore } from '../store/tokenStore';
import { TokenUsageDisplay } from './TokenUsageDisplay';

const Navbar: React.FC = () => {
	const { getLiveInputTokens, getLiveOutputTokens } = useTokenStore();

	const liveInputTokens = getLiveInputTokens();
	const liveOutputTokens = getLiveOutputTokens();
	return (
		<nav
			className="navbar bg-primary text-primary-content shadow-lg"
			role="banner"
			aria-label="Main navigation"
		>
			<div className="flex-1">
				<h1 className="text-xl font-bold">
					<i className="fas fa-search"></i> PReviewer
				</h1>
			</div>

			{/* Token Usage Display */}
			<div className="flex-none mr-4">
				<TokenUsageDisplay
					inputTokens={liveInputTokens}
					outputTokens={liveOutputTokens}
				/>
			</div>
		</nav>
	);
};

export default Navbar;
