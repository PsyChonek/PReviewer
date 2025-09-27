export interface RenderedMarkdown {
  html: string;
  isUsingLibrary: boolean;
}

export class MarkdownRenderer {
  private static instance: MarkdownRenderer;

  private constructor() {}

  static getInstance(): MarkdownRenderer {
    if (!MarkdownRenderer.instance) {
      MarkdownRenderer.instance = new MarkdownRenderer();
    }
    return MarkdownRenderer.instance;
  }

  render(markdown: string): RenderedMarkdown {
    if (!markdown || !markdown.trim()) {
      return {
        html: '',
        isUsingLibrary: false
      };
    }

    // Use marked library if available
    if (typeof window !== "undefined" && (window as any).marked) {
      try {
        const html = (window as any).marked.parse(markdown);
        return {
          html,
          isUsingLibrary: true
        };
      } catch (error) {
        console.warn('Failed to parse markdown with marked library:', error);
        // Fall back to basic rendering
      }
    }

    // Fallback: basic markdown-like formatting
    const html = this.renderBasicMarkdown(markdown);
    return {
      html,
      isUsingLibrary: false
    };
  }

  private renderBasicMarkdown(markdown: string): string {
    return markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/__(.*?)__/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/_(.*?)_/gim, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`(.*?)`/gim, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Unordered lists
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      // Line breaks
      .replace(/\n/gim, '<br>');
  }

  isMarkdownLibraryAvailable(): boolean {
    return typeof window !== "undefined" && !!(window as any).marked;
  }

  getLibraryInfo(): { name: string; version?: string } | null {
    if (!this.isMarkdownLibraryAvailable()) {
      return null;
    }

    const marked = (window as any).marked;
    return {
      name: 'marked',
      version: marked?.version || 'unknown'
    };
  }

  sanitizeForDisplay(content: string): string {
    // Basic HTML sanitization for security
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  extractPlainText(markdown: string): string {
    // Remove markdown formatting to get plain text
    return markdown
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`.*?`/g, '') // Remove inline code
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/__(.*?)__/g, '$1') // Remove bold
      .replace(/_(.*?)_/g, '$1') // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/^#{1,6}\s+/gm, '') // Remove headers
      .replace(/^\*\s+/gm, '') // Remove list markers
      .replace(/^-\s+/gm, '') // Remove list markers
      .replace(/\n+/g, ' ') // Replace line breaks with spaces
      .trim();
  }

  getWordCount(markdown: string): number {
    const plainText = this.extractPlainText(markdown);
    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  }

  getCharacterCount(markdown: string): number {
    return this.extractPlainText(markdown).length;
  }

  getEstimatedReadingTime(markdown: string): number {
    const wordCount = this.getWordCount(markdown);
    const wordsPerMinute = 200; // Average reading speed
    return Math.ceil(wordCount / wordsPerMinute);
  }
}

export const markdownRenderer = MarkdownRenderer.getInstance();