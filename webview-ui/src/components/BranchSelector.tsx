import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { ZygoteTree, ZygoteBranch, BranchId } from '../vscode-api';

interface BranchSelectorProps {
  tree: ZygoteTree;
  onSwitchBranch: (branchId: BranchId) => void;
  onDeleteBranch: (branchId: BranchId) => void;
}

interface BranchTreeNode {
  branch: ZygoteBranch;
  children: BranchTreeNode[];
  nodeCount: number;
}

function buildBranchTree(tree: ZygoteTree): BranchTreeNode[] {
  const branches = Object.values(tree.branches);
  const childMap = new Map<string, ZygoteBranch[]>();

  for (const branch of branches) {
    const key = branch.parentBranchId ?? '__root__';
    const list = childMap.get(key) || [];
    list.push(branch);
    childMap.set(key, list);
  }

  function buildNode(branch: ZygoteBranch): BranchTreeNode {
    const children = (childMap.get(branch.id) || [])
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(buildNode);
    const nodeCount = Object.values(tree.nodes).filter(
      (n) => n.branchId === branch.id
    ).length;
    return { branch, children, nodeCount };
  }

  const roots = (childMap.get('__root__') || []).sort(
    (a, b) => a.createdAt - b.createdAt
  );
  return roots.map(buildNode);
}

const BranchSelector: React.FC<BranchSelectorProps> = ({
  tree,
  onSwitchBranch,
  onDeleteBranch,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<BranchId>>(new Set());
  const [hoveredBranch, setHoveredBranch] = useState<BranchId | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const branchTree = useMemo(() => buildBranchTree(tree), [tree]);
  const activeBranch = tree.branches[tree.activeBranchId];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const toggleCollapse = useCallback((branchId: BranchId, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (branchId: BranchId) => {
      onSwitchBranch(branchId);
      setIsOpen(false);
    },
    [onSwitchBranch]
  );

  const handleDelete = useCallback(
    (branchId: BranchId, e: React.MouseEvent) => {
      e.stopPropagation();
      onDeleteBranch(branchId);
    },
    [onDeleteBranch]
  );

  const renderBranchItem = (node: BranchTreeNode, depth: number): React.ReactNode => {
    const { branch, children, nodeCount } = node;
    const isActive = branch.id === tree.activeBranchId;
    const isCollapsed = collapsed.has(branch.id);
    const hasChildren = children.length > 0;
    const isMain = !branch.parentBranchId;

    const isHovered = hoveredBranch === branch.id;

    return (
      <React.Fragment key={branch.id}>
        <div
          style={{
            ...styles.branchItem,
            paddingLeft: `${8 + depth * 16}px`,
            backgroundColor: isActive
              ? 'var(--vscode-list-activeSelectionBackground, #094771)'
              : isHovered
                ? 'var(--vscode-list-hoverBackground, #2a2d2e)'
                : undefined,
            color: isActive
              ? 'var(--vscode-list-activeSelectionForeground, #fff)'
              : undefined,
          }}
          onClick={() => handleSelect(branch.id)}
          onMouseEnter={() => setHoveredBranch(branch.id)}
          onMouseLeave={() => setHoveredBranch(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleSelect(branch.id);
          }}
        >
          {hasChildren ? (
            <span
              style={{
                ...styles.chevron,
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              }}
              onClick={(e) => toggleCollapse(branch.id, e)}
            >
              v
            </span>
          ) : (
            <span style={styles.chevronSpacer} />
          )}
          {isActive && <span style={styles.activeDot} />}
          <span style={styles.branchName}>{branch.name}</span>
          <span style={styles.nodeCountBadge}>{nodeCount}</span>
          {!isMain && (
            <span
              style={{
                ...styles.deleteBtn,
                opacity: isHovered ? 1 : 0,
              }}
              onClick={(e) => handleDelete(branch.id, e)}
              role="button"
              tabIndex={0}
              title="Delete branch"
            >
              x
            </span>
          )}
        </div>
        {hasChildren && !isCollapsed && children.map((child) => renderBranchItem(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div ref={containerRef} style={styles.container}>
      <button
        style={styles.toggleBtn}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span style={styles.branchIcon}>&#9095;</span>
        {activeBranch?.name ?? 'main'}
        <span style={styles.dropdownArrow}>{isOpen ? '▴' : '▾'}</span>
      </button>

      {isOpen && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>Branches</div>
          <div style={styles.panelList}>
            {branchTree.map((node) => renderBranchItem(node, 0))}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 10px',
    backgroundColor: 'var(--vscode-dropdown-background, #3c3c3c)',
    color: 'var(--vscode-dropdown-foreground, #ccc)',
    border: '1px solid var(--vscode-dropdown-border, #555)',
    borderRadius: '3px',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
    whiteSpace: 'nowrap',
  },
  branchIcon: {
    fontSize: '11px',
    opacity: 0.6,
  },
  dropdownArrow: {
    fontSize: '9px',
    opacity: 0.6,
    marginLeft: '2px',
  },
  panel: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    minWidth: '220px',
    maxHeight: '320px',
    backgroundColor: 'var(--vscode-dropdown-background, #3c3c3c)',
    border: '1px solid var(--vscode-dropdown-border, #555)',
    borderRadius: '4px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '6px 10px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: 0.5,
    borderBottom: '1px solid var(--vscode-panel-border, #444)',
    flexShrink: 0,
  },
  panelList: {
    overflowY: 'auto',
    padding: '4px 0',
  },
  branchItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  chevron: {
    fontSize: '9px',
    width: '12px',
    textAlign: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    opacity: 0.6,
    transition: 'transform 0.15s',
  },
  chevronSpacer: {
    width: '12px',
    flexShrink: 0,
  },
  activeDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#89d185',
    flexShrink: 0,
  },
  branchName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nodeCountBadge: {
    fontSize: '10px',
    opacity: 0.4,
    flexShrink: 0,
  },
  deleteBtn: {
    fontSize: '10px',
    opacity: 0,
    cursor: 'pointer',
    padding: '0 3px',
    color: '#f14c4c',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
};

export default BranchSelector;
