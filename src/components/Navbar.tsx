import React from 'react';
import { formatTokenCount } from '../utils/tokenEstimation';
import { useTokenStore } from '../store/tokenStore';

interface NavbarProps {}

const Navbar: React.FC<NavbarProps> = () => {
  const { getLiveInputTokens, getLiveOutputTokens } = useTokenStore();

  const liveInputTokens = getLiveInputTokens();
  const liveOutputTokens = getLiveOutputTokens();
  return (
    <nav className="navbar bg-primary text-primary-content shadow-lg" role="banner" aria-label="Main navigation">
      <div className="flex-1">
        <h1 className="text-xl font-bold">
          <i className="fas fa-search"></i> PReviewer
          <span className="badge badge-accent badge-sm ml-2">HMR ACTIVE</span>
        </h1>
      </div>

      {/* Token Usage Display */}
      <div className="flex-none mr-4">
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-1">
            <i className="fas fa-arrow-down text-xs"></i>
            <span className="font-medium">{formatTokenCount(liveInputTokens)}</span>
            <span className="opacity-75">in</span>
          </div>
          <div className="flex items-center gap-1">
            <i className="fas fa-arrow-up text-xs"></i>
            <span className="font-medium">{formatTokenCount(liveOutputTokens)}</span>
            <span className="opacity-75">out</span>
          </div>
        </div>
      </div>

    </nav>
  );
};

export default Navbar;