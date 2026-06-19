import React, { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content, isStreaming = false }) => {
  const [expanded, setExpanded] = useState(isStreaming);

  if (!content) return null;

  return (
    <div style={styles.container}>
      <button
        style={styles.header}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={styles.chevron}>{expanded ? '▼' : '▶'}</span>
        <span style={styles.label}>
          {isStreaming ? 'Thinking...' : 'Thinking'}
        </span>
        {!expanded && (
          <span style={styles.preview}>
            {content.slice(0, 80)}{content.length > 80 ? '...' : ''}
          </span>
        )}
      </button>
      {expanded && (
        <div style={styles.body}>
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: '4px',
    border: '1px solid var(--vscode-panel-border, #333)',
    backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground, #2a2a2a)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '6px 10px',
    border: 'none',
    background: 'none',
    color: 'var(--vscode-foreground, #999)',
    opacity: 0.7,
    cursor: 'pointer',
    fontSize: '11px',
    textAlign: 'left',
  },
  chevron: {
    fontSize: '8px',
    flexShrink: 0,
  },
  label: {
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontSize: '10px',
    flexShrink: 0,
  },
  preview: {
    opacity: 0.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontSize: '10px',
  },
  body: {
    padding: '4px 10px 10px',
    borderTop: '1px solid var(--vscode-panel-border, #333)',
    opacity: 0.75,
    fontSize: '11px',
  },
};

export default ThinkingBlock;
