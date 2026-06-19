import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div style={styles.container} className="zygote-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ className, children, ...props }) {
            const isInline = !className;
            if (isInline) {
              return <code style={styles.inlineCode} {...props}>{children}</code>;
            }
            return (
              <code className={className} style={styles.blockCode} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <pre style={styles.pre}>{children}</pre>;
          },
          h1({ children }) {
            return <h1 style={{ ...styles.heading, fontSize: '16px' }}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 style={{ ...styles.heading, fontSize: '14px' }}>{children}</h2>;
          },
          h3({ children }) {
            return <h3 style={{ ...styles.heading, fontSize: '13px' }}>{children}</h3>;
          },
          p({ children }) {
            return <p style={styles.paragraph}>{children}</p>;
          },
          ul({ children }) {
            return <ul style={styles.list}>{children}</ul>;
          },
          ol({ children }) {
            return <ol style={styles.list}>{children}</ol>;
          },
          li({ children }) {
            return <li style={styles.listItem}>{children}</li>;
          },
          blockquote({ children }) {
            return <blockquote style={styles.blockquote}>{children}</blockquote>;
          },
          table({ children }) {
            return (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th style={styles.th}>{children}</th>;
          },
          td({ children }) {
            return <td style={styles.td}>{children}</td>;
          },
          a({ href, children }) {
            return <a href={href} style={styles.link}>{children}</a>;
          },
          hr() {
            return <hr style={styles.hr} />;
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontSize: '12px',
    lineHeight: 1.6,
    color: 'var(--vscode-foreground, #ccc)',
    wordBreak: 'break-word',
  },
  inlineCode: {
    backgroundColor: 'var(--vscode-textCodeBlock-background, #2a2a2a)',
    padding: '1px 4px',
    borderRadius: '3px',
    fontSize: '11px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
  },
  blockCode: {
    fontSize: '11px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    lineHeight: 1.5,
  },
  pre: {
    backgroundColor: 'var(--vscode-textCodeBlock-background, #1a1a1a)',
    padding: '10px 12px',
    borderRadius: '4px',
    overflow: 'auto',
    margin: '8px 0',
    border: '1px solid var(--vscode-panel-border, #333)',
  },
  heading: {
    fontWeight: 600,
    margin: '12px 0 6px 0',
    color: 'var(--vscode-foreground, #ccc)',
  },
  paragraph: {
    margin: '6px 0',
  },
  list: {
    margin: '6px 0',
    paddingLeft: '20px',
  },
  listItem: {
    margin: '2px 0',
  },
  blockquote: {
    borderLeft: '3px solid var(--vscode-textBlockQuote-border, #555)',
    margin: '8px 0',
    padding: '4px 12px',
    opacity: 0.8,
  },
  tableWrapper: {
    overflow: 'auto',
    margin: '8px 0',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: '11px',
  },
  th: {
    borderBottom: '1px solid var(--vscode-panel-border, #555)',
    padding: '4px 8px',
    textAlign: 'left',
    fontWeight: 600,
  },
  td: {
    borderBottom: '1px solid var(--vscode-panel-border, #333)',
    padding: '4px 8px',
  },
  link: {
    color: 'var(--vscode-textLink-foreground, #3794ff)',
    textDecoration: 'none',
  },
  hr: {
    border: 'none',
    borderTop: '1px solid var(--vscode-panel-border, #333)',
    margin: '12px 0',
  },
};

export default MarkdownRenderer;
