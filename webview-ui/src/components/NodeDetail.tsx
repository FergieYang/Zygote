import React from 'react';
import { postMessage, type ZygoteNode, type ZygoteTree } from '../vscode-api';
import NodeChat from './NodeChat';
import MarkdownRenderer from './MarkdownRenderer';
import ThinkingBlock from './ThinkingBlock';

interface NodeDetailProps {
  node: ZygoteNode;
  tree: ZygoteTree;
  streamingText?: string;
  streamingThinking?: string;
}

const NodeDetail: React.FC<NodeDetailProps> = ({
  node,
  tree,
  streamingText,
  streamingThinking,
}) => {
  const handleRetry = () => {
    postMessage({ type: 'previewNode', nodeId: node.id });
  };

  const handleUndo = () => {
    postMessage({ type: 'rejectPreview', nodeId: node.id });
  };

  const handleDelete = () => {
    postMessage({ type: 'deleteNode', nodeId: node.id });
  };

  const handleDeleteBranch = () => {
    postMessage({ type: 'deleteBranch', branchId: node.branchId });
  };

  const branchName = tree.branches[node.branchId]?.name ?? '';
  const isMainBranch = !tree.branches[node.branchId]?.parentBranchId;

  return (
    <div style={styles.container}>
      {/* Status + meta */}
      <div style={styles.meta}>
        <span style={statusBadgeStyle(node.status)}>{node.status}</span>
        <span style={styles.branchTag}>{branchName}</span>
        {node.tokens && (
          <span style={styles.tokens}>
            {node.tokens.input + node.tokens.output} tokens
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={styles.actions}>
        {(node.status === 'error' || node.status === 'previewing') && (
          <button style={styles.primaryBtn} onClick={handleRetry}>
            Retry
          </button>
        )}
        {node.status === 'committed' && (
          <button style={styles.dangerBtn} onClick={handleUndo}>
            Undo changes
          </button>
        )}
        {(node.status === 'draft' || node.status === 'error') && (
          <button style={styles.dangerBtn} onClick={handleDelete}>
            Delete
          </button>
        )}
        {!isMainBranch && (
          <button style={styles.dangerBtn} onClick={handleDeleteBranch}>
            Delete branch
          </button>
        )}
      </div>

      {/* Error */}
      {node.error && (
        <div style={styles.errorBox}>Error: {node.error}</div>
      )}

      {/* Tool calls */}
      {node.toolCalls && node.toolCalls.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Tool calls</div>
          {node.toolCalls.map((tc, i) => (
            <div key={i} style={styles.toolCall}>
              <span style={styles.toolName}>
                {tc.tool}({tc.input.path})
              </span>
              <span
                style={{
                  color: tc.result.ok ? '#89d185' : '#f14c4c',
                  fontSize: '10px',
                }}
              >
                {tc.result.ok ? 'OK' : tc.result.error}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Thinking (streaming) */}
      {streamingThinking && (
        <ThinkingBlock content={streamingThinking} isStreaming />
      )}

      {/* Thinking (persisted) */}
      {!streamingThinking && node.thinkingContent && (
        <ThinkingBlock content={node.thinkingContent} />
      )}

      {/* Streaming output */}
      {streamingText && (
        <div style={styles.streamBox}>
          <div style={styles.sectionLabel}>Streaming...</div>
          <MarkdownRenderer content={streamingText} />
        </div>
      )}

      {/* Agent response */}
      {node.agentResponse && !streamingText && (
        <div style={styles.responseBox}>
          <div style={styles.sectionLabel}>Response</div>
          <MarkdownRenderer content={node.agentResponse} />
        </div>
      )}

      {/* Chat */}
      <NodeChat node={node} />
    </div>
  );
};

const statusColorMap: Record<string, string> = {
  draft: '#888',
  previewing: '#cca700',
  committed: '#89d185',
  error: '#f14c4c',
};

function statusBadgeStyle(status: string): React.CSSProperties {
  const color = statusColorMap[status] ?? '#888';
  return {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    border: `1px solid ${color}`,
    color,
  };
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  meta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
    fontSize: '11px',
  },
  branchTag: {
    opacity: 0.5,
    fontSize: '10px',
  },
  tokens: {
    opacity: 0.4,
    fontSize: '10px',
    marginLeft: 'auto',
  },
  actions: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    padding: '4px 12px',
    backgroundColor: 'var(--vscode-button-background, #0e639c)',
    color: 'var(--vscode-button-foreground, #fff)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  secondaryBtn: {
    padding: '4px 12px',
    backgroundColor: 'var(--vscode-button-secondaryBackground, #3a3d41)',
    color: 'var(--vscode-button-secondaryForeground, #fff)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  dangerBtn: {
    padding: '4px 12px',
    backgroundColor: '#f14c4c',
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  errorBox: {
    padding: '6px 10px',
    backgroundColor: '#5a1d1d',
    border: '1px solid #be1100',
    borderRadius: '3px',
    fontSize: '11px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: 0.5,
    marginBottom: '2px',
  },
  toolCall: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 6px',
    backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground, #2a2a2a)',
    borderRadius: '3px',
    fontSize: '10px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
  },
  toolName: {
    opacity: 0.7,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  streamBox: {
    padding: '8px 10px',
    backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground, #2a2a2a)',
    borderRadius: '3px',
    borderLeft: '3px solid #cca700',
  },
  responseBox: {
    padding: '8px 10px',
    backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground, #2a2a2a)',
    borderRadius: '3px',
    borderLeft: '3px solid #3794ff',
  },
};

export default NodeDetail;
