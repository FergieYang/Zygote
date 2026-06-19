import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { ZygoteTree, ZygoteNode, NodeId, BranchId } from '../vscode-api';

interface TreeCanvasProps {
  tree: ZygoteTree;
  selectedNodeId: NodeId | null;
  onSelectNode: (nodeId: NodeId) => void;
}

const NODE_W = 200;
const NODE_H = 68;
const GAP_X = 28;
const GAP_Y = 72;
const PAD = 48;

interface Pos {
  x: number;
  y: number;
}

const BRANCH_PALETTE = [
  '#3794ff',
  '#89d185',
  '#cca700',
  '#f14c4c',
  '#c586c0',
  '#ce9178',
  '#4ec9b0',
  '#d7ba7d',
];

const statusColors: Record<string, string> = {
  draft: '#888',
  previewing: '#cca700',
  committed: '#89d185',
  error: '#f14c4c',
};

const statusLabels: Record<string, string> = {
  draft: 'draft',
  previewing: 'running...',
  committed: 'done',
  error: 'error',
};

function getBranchColor(
  branchId: BranchId,
  branchIndex: Map<BranchId, number>
): string {
  const idx = branchIndex.get(branchId) ?? 0;
  return BRANCH_PALETTE[idx % BRANCH_PALETTE.length];
}

function countDescendants(
  nodeId: NodeId,
  childrenOf: Map<NodeId, NodeId[]>
): number {
  const children = childrenOf.get(nodeId) || [];
  let count = children.length;
  for (const cid of children) {
    count += countDescendants(cid, childrenOf);
  }
  return count;
}

function getAncestors(
  nodeId: NodeId,
  nodes: Record<NodeId, ZygoteNode>
): Set<NodeId> {
  const ancestors = new Set<NodeId>();
  let cur: NodeId | null = nodes[nodeId]?.parentId ?? null;
  while (cur) {
    ancestors.add(cur);
    cur = nodes[cur]?.parentId ?? null;
  }
  return ancestors;
}

function computeLayout(
  tree: ZygoteTree,
  collapsedNodes: Set<NodeId>
): { positions: Map<NodeId, Pos>; childrenOf: Map<NodeId, NodeId[]> } {
  const positions = new Map<NodeId, Pos>();
  const nodes = tree.nodes;

  const childrenOf = new Map<NodeId, NodeId[]>();
  for (const node of Object.values(nodes)) {
    if (node.parentId && nodes[node.parentId]) {
      const list = childrenOf.get(node.parentId) || [];
      list.push(node.id);
      childrenOf.set(node.parentId, list);
    }
  }

  function subtreeWidth(nodeId: NodeId): number {
    if (collapsedNodes.has(nodeId)) return NODE_W;
    const children = childrenOf.get(nodeId) || [];
    if (children.length === 0) return NODE_W;
    let total = 0;
    for (const cid of children) {
      total += subtreeWidth(cid);
    }
    total += (children.length - 1) * GAP_X;
    return Math.max(NODE_W, total);
  }

  function place(nodeId: NodeId, left: number, top: number) {
    const w = subtreeWidth(nodeId);
    positions.set(nodeId, { x: left + w / 2 - NODE_W / 2, y: top });
    if (collapsedNodes.has(nodeId)) return;
    const children = childrenOf.get(nodeId) || [];
    let cx = left;
    for (const cid of children) {
      const cw = subtreeWidth(cid);
      place(cid, cx, top + NODE_H + GAP_Y);
      cx += cw + GAP_X;
    }
  }

  let rootLeft = PAD;
  for (const rid of tree.rootNodeIds) {
    if (!nodes[rid]) continue;
    const w = subtreeWidth(rid);
    place(rid, rootLeft, PAD);
    rootLeft += w + GAP_X;
  }

  return { positions, childrenOf };
}

const TreeCanvas: React.FC<TreeCanvasProps> = ({
  tree,
  selectedNodeId,
  onSelectNode,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<NodeId>>(new Set());

  const branchIndex = useMemo(() => {
    const idx = new Map<BranchId, number>();
    const sorted = Object.values(tree.branches).sort(
      (a, b) => a.createdAt - b.createdAt
    );
    sorted.forEach((b, i) => idx.set(b.id, i));
    return idx;
  }, [tree.branches]);

  // Auto-expand ancestors of selected node so it's always visible
  useEffect(() => {
    if (!selectedNodeId || collapsedNodes.size === 0) return;
    const ancestors = getAncestors(selectedNodeId, tree.nodes);
    let needsUpdate = false;
    for (const aid of ancestors) {
      if (collapsedNodes.has(aid)) {
        needsUpdate = true;
        break;
      }
    }
    if (needsUpdate) {
      setCollapsedNodes((prev) => {
        const next = new Set(prev);
        for (const aid of ancestors) {
          next.delete(aid);
        }
        return next;
      });
    }
  }, [selectedNodeId]);

  const { positions, childrenOf } = useMemo(
    () => computeLayout(tree, collapsedNodes),
    [tree, collapsedNodes]
  );

  const allNodes = useMemo(() => {
    return Object.values(tree.nodes).filter((n) => positions.has(n.id));
  }, [tree.nodes, positions]);

  const canvasW = useMemo(() => {
    let max = 400;
    for (const pos of positions.values()) {
      max = Math.max(max, pos.x + NODE_W + PAD);
    }
    return max;
  }, [positions]);

  const canvasH = useMemo(() => {
    let max = 300;
    for (const pos of positions.values()) {
      max = Math.max(max, pos.y + NODE_H + PAD);
    }
    return max;
  }, [positions]);

  useEffect(() => {
    if (!selectedNodeId || !scrollRef.current) return;
    const pos = positions.get(selectedNodeId);
    if (!pos) return;
    scrollRef.current.scrollTo({
      left: pos.x - scrollRef.current.clientWidth / 2 + NODE_W / 2,
      top: pos.y - scrollRef.current.clientHeight / 2 + NODE_H / 2,
      behavior: 'smooth',
    });
  }, [selectedNodeId, positions]);

  const toggleCollapse = useCallback((nodeId: NodeId, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const edges = useMemo(() => {
    const result: { from: Pos; to: Pos; key: string; branchId: BranchId }[] = [];
    for (const node of allNodes) {
      if (node.parentId && positions.has(node.parentId)) {
        const from = positions.get(node.parentId)!;
        const to = positions.get(node.id)!;
        result.push({
          from: { x: from.x + NODE_W / 2, y: from.y + NODE_H },
          to: { x: to.x + NODE_W / 2, y: to.y },
          key: `${node.parentId}-${node.id}`,
          branchId: node.branchId,
        });
      }
    }
    return result;
  }, [allNodes, positions]);

  if (allNodes.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>&#9675;</div>
        <div style={styles.emptyText}>
          Your tree will grow here.
          <br />
          Type below to plant the first seed.
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} style={styles.scroll}>
      <div
        style={{
          position: 'relative',
          width: canvasW,
          height: canvasH,
          minWidth: '100%',
          minHeight: '100%',
        }}
      >
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: canvasW,
            height: canvasH,
            pointerEvents: 'none',
          }}
        >
          {edges.map((e) => {
            const midY = (e.from.y + e.to.y) / 2;
            const edgeColor = getBranchColor(e.branchId, branchIndex);
            return (
              <path
                key={e.key}
                d={`M${e.from.x},${e.from.y} C${e.from.x},${midY} ${e.to.x},${midY} ${e.to.x},${e.to.y}`}
                fill="none"
                stroke={edgeColor}
                strokeWidth="2"
                strokeLinecap="round"
                opacity={0.5}
              />
            );
          })}
        </svg>

        {allNodes.map((node) => {
          const pos = positions.get(node.id)!;
          const isSelected = node.id === selectedNodeId;
          const statusColor = statusColors[node.status] || '#888';
          const branchColor = getBranchColor(node.branchId, branchIndex);
          const hasChildren = (childrenOf.get(node.id) || []).length > 0;
          const isCollapsed = collapsedNodes.has(node.id);
          const descendantCount = hasChildren
            ? countDescendants(node.id, childrenOf)
            : 0;

          return (
            <div
              key={node.id}
              onClick={() => onSelectNode(node.id)}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: NODE_W,
                height: NODE_H,
                borderRadius: '8px',
                border: isSelected
                  ? `2px solid ${statusColor}`
                  : `1px solid ${branchColor}55`,
                borderLeft: `3px solid ${branchColor}`,
                backgroundColor: isSelected
                  ? 'var(--vscode-list-activeSelectionBackground, #094771)'
                  : 'var(--vscode-editor-background, #1e1e1e)',
                boxShadow: isSelected
                  ? `0 0 12px ${statusColor}40`
                  : '0 2px 8px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                overflow: 'hidden',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                userSelect: 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    color: isSelected
                      ? 'var(--vscode-list-activeSelectionForeground, #fff)'
                      : 'var(--vscode-foreground, #ccc)',
                  }}
                >
                  {node.title}
                </div>
                {hasChildren && (
                  <span
                    onClick={(e) => toggleCollapse(node.id, e)}
                    style={{
                      fontSize: '9px',
                      opacity: 0.6,
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      flexShrink: 0,
                      backgroundColor: isCollapsed
                        ? `${branchColor}30`
                        : 'transparent',
                    }}
                  >
                    {isCollapsed ? `+${descendantCount}` : 'v'}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '10px',
                  opacity: 0.7,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: statusColor,
                    flexShrink: 0,
                  }}
                />
                <span>{statusLabels[node.status] || node.status}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    opacity: 0.5,
                    color: branchColor,
                  }}
                >
                  {tree.branches[node.branchId]?.name ?? ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  scroll: {
    flex: 1,
    overflow: 'auto',
    position: 'relative',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
    gap: '12px',
  },
  emptyIcon: {
    fontSize: '36px',
    opacity: 0.4,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: '13px',
    lineHeight: 1.6,
  },
};

export default TreeCanvas;
