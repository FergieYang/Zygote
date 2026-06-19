import React, { useState, useMemo } from 'react';
import { getVisibleNodeIds, type ZygoteTree, type ZygoteNode, type NodeId } from '../vscode-api';

interface TreeProps {
  tree: ZygoteTree;
  selectedNodeId: NodeId | null;
  onSelectNode: (nodeId: NodeId) => void;
  onCreateNode: (parentId: NodeId | null, prompt: string) => void;
}

const Tree: React.FC<TreeProps> = ({
  tree,
  selectedNodeId,
  onSelectNode,
  onCreateNode,
}) => {
  const [newNodePrompt, setNewNodePrompt] = useState('');
  const visibleNodeIds = useMemo(() => getVisibleNodeIds(tree), [tree]);

  const rootNodes = tree.rootNodeIds
    .map((id) => tree.nodes[id])
    .filter((n): n is ZygoteNode => !!n && visibleNodeIds.has(n.id));

  const getChildren = (nodeId: NodeId): ZygoteNode[] =>
    Object.values(tree.nodes).filter((n) => n.parentId === nodeId && visibleNodeIds.has(n.id));

  const handleCreateRoot = () => {
    if (newNodePrompt.trim()) {
      onCreateNode(null, newNodePrompt.trim());
      setNewNodePrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateRoot();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>Nodes</span>
      </div>

      {/* New node input */}
      <div style={styles.newNodeRow}>
        <input
          style={styles.input}
          type="text"
          placeholder="New node prompt..."
          value={newNodePrompt}
          onChange={(e) => setNewNodePrompt(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button style={styles.addBtn} onClick={handleCreateRoot}>
          +
        </button>
      </div>

      {/* Tree nodes */}
      <div style={styles.nodeList}>
        {rootNodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onCreateNode={onCreateNode}
            getChildren={getChildren}
          />
        ))}
        {rootNodes.length === 0 && (
          <p style={styles.emptyText}>No nodes yet. Create one above.</p>
        )}
      </div>
    </div>
  );
};

interface TreeNodeProps {
  node: ZygoteNode;
  depth: number;
  selectedNodeId: NodeId | null;
  onSelectNode: (nodeId: NodeId) => void;
  onCreateNode: (parentId: NodeId | null, prompt: string) => void;
  getChildren: (nodeId: NodeId) => ZygoteNode[];
}

const statusIndicators: Record<string, string> = {
  draft: 'o',
  previewing: '...',
  'preview-complete': '*',
  committed: '+',
  error: '!',
};

const statusColors: Record<string, string> = {
  draft: 'var(--vscode-foreground, #ccc)',
  previewing: 'var(--vscode-charts-yellow, #cca700)',
  'preview-complete': 'var(--vscode-charts-blue, #3794ff)',
  committed: 'var(--vscode-charts-green, #89d185)',
  error: 'var(--vscode-charts-red, #f14c4c)',
};

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  selectedNodeId,
  onSelectNode,
  onCreateNode,
  getChildren,
}) => {
  const children = getChildren(node.id);
  const isSelected = selectedNodeId === node.id;

  return (
    <div>
      <div
        style={{
          ...styles.nodeRow,
          paddingLeft: `${8 + depth * 16}px`,
          backgroundColor: isSelected
            ? 'var(--vscode-list-activeSelectionBackground, #094771)'
            : 'transparent',
          color: isSelected
            ? 'var(--vscode-list-activeSelectionForeground, #fff)'
            : undefined,
        }}
        onClick={() => onSelectNode(node.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onSelectNode(node.id);
          }
        }}
      >
        <span
          style={{
            ...styles.statusDot,
            color: statusColors[node.status] ?? '#ccc',
          }}
        >
          {statusIndicators[node.status] ?? '?'}
        </span>
        <span style={styles.nodeTitle}>{node.title}</span>
      </div>
      {children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onCreateNode={onCreateNode}
          getChildren={getChildren}
        />
      ))}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  headerLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: 0.7,
  },
  newNodeRow: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px',
  },
  input: {
    flex: 1,
    padding: '4px 8px',
    backgroundColor: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, #555)',
    borderRadius: '3px',
    fontSize: '12px',
    outline: 'none',
  },
  addBtn: {
    padding: '4px 8px',
    backgroundColor: 'var(--vscode-button-background, #0e639c)',
    color: 'var(--vscode-button-foreground, #fff)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  nodeList: {
    flex: 1,
    overflowY: 'auto',
  },
  nodeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    cursor: 'pointer',
    borderRadius: '3px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '12px',
    userSelect: 'none',
  },
  statusDot: {
    fontWeight: 'bold',
    fontSize: '10px',
    width: '16px',
    textAlign: 'center',
    flexShrink: 0,
  },
  nodeTitle: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  emptyText: {
    opacity: 0.5,
    fontSize: '12px',
    textAlign: 'center',
    marginTop: '20px',
  },
};

export default Tree;
