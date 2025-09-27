import React from 'react';

interface ProgressTrackerProps {
  reviewStats: {
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    tokensPerSecond: number;
    processingTime: number;
    responseTime: number;
    stage: string;
    progress: number;
  } | null;
  estimatedInputTokens: number;
  reviewInProgress: boolean;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  reviewStats,
  estimatedInputTokens,
  reviewInProgress
}) => {
  if (!reviewInProgress && !reviewStats) {
    return null;
  }

  return (
    <div className="card bg-base-200 shadow-sm mb-4">
      <div className="card-body p-4">
        <h3 className="card-title text-sm flex items-center gap-2">
          <i className="fas fa-chart-line text-primary"></i>
          Review Progress
        </h3>

        {reviewInProgress && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm text-primary"></span>
              <span className="text-sm">{reviewStats?.stage || 'Processing...'}</span>
            </div>

            {reviewStats?.progress !== undefined && (
              <div className="w-full">
                <div className="flex justify-between text-xs mb-1">
                  <span>Progress</span>
                  <span>{Math.round(reviewStats.progress)}%</span>
                </div>
                <progress
                  className="progress progress-primary w-full"
                  value={reviewStats.progress}
                  max="100"
                ></progress>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-base-content/70">Input Tokens:</span>
                <div className="font-mono">{reviewStats?.inputTokens || estimatedInputTokens}</div>
              </div>
              <div>
                <span className="text-base-content/70">Output Tokens:</span>
                <div className="font-mono">{reviewStats?.outputTokens || 0}</div>
              </div>
              {reviewStats?.tokensPerSecond && (
                <>
                  <div>
                    <span className="text-base-content/70">Speed:</span>
                    <div className="font-mono">{reviewStats.tokensPerSecond.toFixed(1)} tok/s</div>
                  </div>
                  <div>
                    <span className="text-base-content/70">Processing:</span>
                    <div className="font-mono">{(reviewStats.processingTime / 1000).toFixed(1)}s</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!reviewInProgress && reviewStats && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-success">
              <i className="fas fa-check-circle"></i>
              <span className="text-sm font-medium">Review Completed</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-base-content/70">Input Tokens:</span>
                <div className="font-mono">{reviewStats.inputTokens}</div>
              </div>
              <div>
                <span className="text-base-content/70">Output Tokens:</span>
                <div className="font-mono">{reviewStats.outputTokens}</div>
              </div>
              <div>
                <span className="text-base-content/70">Speed:</span>
                <div className="font-mono">{reviewStats.tokensPerSecond.toFixed(1)} tok/s</div>
              </div>
              <div>
                <span className="text-base-content/70">Total Time:</span>
                <div className="font-mono">{(reviewStats.responseTime / 1000).toFixed(1)}s</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTracker;