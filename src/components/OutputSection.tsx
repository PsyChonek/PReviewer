import React from 'react';

interface OutputSectionProps {
  outputContent: string;
  onClearOutput: () => void;
  onCopyOutput: () => void;
  onExportOutput: () => void;
}

const OutputSection: React.FC<OutputSectionProps> = ({
  outputContent,
  onClearOutput,
  onCopyOutput,
  onExportOutput
}) => {
  const renderMarkdown = (markdown: string) => {
    if (!markdown.trim()) {
      return (
        <div className="text-center text-base-content/60 py-8">
          <h3 className="text-xl font-bold mb-4">Welcome to PReviewer! <i className="fas fa-rocket"></i></h3>
          <div className="text-left max-w-2xl mx-auto space-y-2">
            <p><strong>Getting Started:</strong></p>
            <p>1. Configure your AI provider (Ollama or Azure AI) in Settings</p>
            <p>2. Browse and select your Git repository</p>
            <p>3. Choose From and To branches for comparison</p>
            <p>4. Click 'Start AI Review' to analyze differences</p>
            <br />
            <p><strong>Requirements:</strong></p>
            <p>• For Ollama: Local Ollama server must be running</p>
            <p>• For Azure AI: Valid endpoint, API key, and deployment</p>
            <p>• Repository must be a valid Git repository</p>
          </div>
        </div>
      );
    }

    // Use marked library if available, otherwise just display as text
    if (typeof window !== 'undefined' && (window as any).marked) {
      return (
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: (window as any).marked.parse(markdown) }}
        />
      );
    }

    // Fallback: basic markdown-like formatting
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <pre className="whitespace-pre-wrap font-sans">{markdown}</pre>
      </div>
    );
  };

  return (
    <section className="card bg-base-100 shadow-xl" aria-label="AI review output" role="region">
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title text-2xl">
            <i className="fas fa-bullseye"></i> AI Review Output
          </h2>
          <div className="flex gap-2" role="group" aria-label="Output actions">
            <button
              className="btn btn-sm btn-outline"
              onClick={onClearOutput}
              aria-label="Clear output text"
            >
              <i className="fas fa-trash"></i> Clear
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={onCopyOutput}
              aria-label="Copy output to clipboard"
            >
              <i className="fas fa-copy"></i> Copy
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={onExportOutput}
              aria-label="Export output to file"
            >
              <i className="fas fa-download"></i> Export
            </button>
          </div>
        </div>

        <div
          className="bg-base-200 border border-base-300 rounded-lg output-text overflow-auto"
          role="log"
          aria-live="polite"
          aria-label="Review output display"
        >
          <div className="px-6 py-4">
            {renderMarkdown(outputContent)}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OutputSection;