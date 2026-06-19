import React, { useState, useEffect, useCallback } from 'react';
import {
  onMessage,
  postMessage,
  type ZygoteTree,
  type ZygoteNode,
  type NodeId,
  type ExtToWebviewMessage,
} from './vscode-api';
import TreeCanvas from './components/TreeCanvas';
import NodeDetail from './components/NodeDetail';
import FloatingChat from './components/FloatingChat';

const App: React.FC = () => {
  const [tree, setTree] = useState<ZygoteTree | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [streamingText, setStreamingText] = useState<Record<NodeId, string>>(
    {}
  );
  const [thinkingText, setThinkingText] = useState<Record<NodeId, string>>({});
  const [showFloatingChat, setShowFloatingChat] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [workspaceLock, setWorkspaceLock] = useState<{
    nodeId: NodeId;
    title: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = onMessage((message: ExtToWebviewMessage) => {
      switch (message.type) {
        case 'treeUpdated':
          setTree(message.tree);
          break;
        case 'nodeStatusChanged':
          break;
        case 'nodeOutputStream':
          setStreamingText((prev) => ({
            ...prev,
            [message.nodeId]: (prev[message.nodeId] ?? '') + message.delta,
          }));
          break;
        case 'nodeThinkingStream':
          setThinkingText((prev) => ({
            ...prev,
            [message.nodeId]: (prev[message.nodeId] ?? '') + message.delta,
          }));
          break;
        case 'workspaceLocked':
          setWorkspaceLock({
            nodeId: message.lockedToNodeId,
            title: message.lockedToTitle,
          });
          break;
        case 'workspaceUnlocked':
          setWorkspaceLock(null);
          break;
        case 'error':
          setErrorMessage(message.message);
          setTimeout(() => setErrorMessage(null), 5000);
          break;
        case 'quickAskResponse':
          break;
      }
    });
    // Tell the extension we're ready to receive data
    postMessage({ type: 'webviewReady' });
    return unsubscribe;
  }, []);

  const handleSelectNode = useCallback(
    (nodeId: NodeId) => {
      const fromNodeId = selectedNodeId;
      setSelectedNodeId(nodeId);
      setEditingTitle(false);
      setStreamingText((prev) => {
        const { [nodeId]: _, ...rest } = prev;
        return rest;
      });
      setThinkingText((prev) => {
        const { [nodeId]: _, ...rest } = prev;
        return rest;
      });

      // Auto-switch active branch to match the selected node
      const node = tree?.nodes[nodeId];
      if (node && tree && node.branchId !== tree.activeBranchId) {
        postMessage({ type: 'switchBranch', branchId: node.branchId });
      }

      // Auto-save current node's state, then restore target node's state
      postMessage({ type: 'saveAndCheckout', fromNodeId, toNodeId: nodeId });
    },
    [tree, selectedNodeId]
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleSubmitInput = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || !tree) return;

    // If a node is selected, create a child of it; otherwise create a root node
    const parentId = selectedNodeId ?? null;
    postMessage({ type: 'createNode', parentId, prompt: trimmed });
    setInputValue('');
  }, [inputValue, tree, selectedNodeId]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmitInput();
      }
    },
    [handleSubmitInput]
  );

  // Clear stale selectedNodeId if the node was deleted
  useEffect(() => {
    if (tree && selectedNodeId && !tree.nodes[selectedNodeId]) {
      setSelectedNodeId(null);
    }
  }, [tree, selectedNodeId]);

  const selectedNode: ZygoteNode | null =
    tree && selectedNodeId ? tree.nodes[selectedNodeId] ?? null : null;

  const showDetail = selectedNode !== null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.logo}>Zygote</h1>
        <div style={styles.headerRight}>
          <button
            style={styles.quickAskBtn}
            onClick={() => setShowFloatingChat((v) => !v)}
          >
            Quick Ask
          </button>
        </div>
      </header>

      {/* Workspace lock banner */}
      {workspaceLock && selectedNodeId !== workspaceLock.nodeId && (
        <div style={styles.lockBanner}>
          Editor files locked to "{workspaceLock.title}" (agent running).
          Files will update when the agent completes.
          <button
            style={styles.lockGoBtn}
            onClick={() => handleSelectNode(workspaceLock.nodeId)}
          >
            Go to running node
          </button>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div style={styles.errorBanner}>
          {errorMessage}
          <button
            style={styles.dismissBtn}
            onClick={() => setErrorMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main area: canvas + optional detail panel */}
      <div style={styles.body}>
        {/* Tree canvas */}
        <div style={styles.canvasArea}>
          {tree ? (
            <TreeCanvas
              tree={tree}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
            />
          ) : (
            <div style={styles.loading}>Loading...</div>
          )}
        </div>

        {/* Detail panel (slides in when a node is selected) */}
        {showDetail && tree && (
          <div style={styles.detailPanel}>
            <div style={styles.detailHeader}>
              {editingTitle ? (
                <input
                  style={styles.titleInput}
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = titleDraft.trim();
                      if (trimmed && selectedNodeId) {
                        postMessage({ type: 'updateNodeTitle', nodeId: selectedNodeId, title: trimmed });
                      }
                      setEditingTitle(false);
                    }
                    if (e.key === 'Escape') {
                      setEditingTitle(false);
                    }
                  }}
                  onBlur={() => {
                    const trimmed = titleDraft.trim();
                    if (trimmed && selectedNodeId) {
                      postMessage({ type: 'updateNodeTitle', nodeId: selectedNodeId, title: trimmed });
                    }
                    setEditingTitle(false);
                  }}
                />
              ) : (
                <span
                  style={styles.detailTitle}
                  onDoubleClick={() => {
                    setTitleDraft(selectedNode!.title);
                    setEditingTitle(true);
                  }}
                  title="Double-click to rename"
                >
                  {selectedNode!.title}
                </span>
              )}
              <button style={styles.closeBtn} onClick={handleCloseDetail}>
                x
              </button>
            </div>
            <div style={styles.detailBody}>
              <NodeDetail
                node={selectedNode!}
                tree={tree}
                streamingText={streamingText[selectedNode!.id]}
                streamingThinking={thinkingText[selectedNode!.id]}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom input bar */}
      <div style={styles.inputBar}>
        <div style={styles.inputHint}>
          {selectedNodeId && tree?.nodes[selectedNodeId]
            ? `Branching from: ${tree.nodes[selectedNodeId].title}`
            : 'New root node'}
        </div>
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            type="text"
            placeholder="What do you want to do next?"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <button style={styles.submitBtn} onClick={handleSubmitInput}>
            +
          </button>
        </div>
      </div>

      {/* Floating quick ask */}
      {showFloatingChat && (
        <FloatingChat onClose={() => setShowFloatingChat(false)} />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: 'var(--vscode-font-family, system-ui, sans-serif)',
    fontSize: 'var(--vscode-font-size, 13px)',
    color: 'var(--vscode-foreground, #cccccc)',
    backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 16px',
    borderBottom: '1px solid var(--vscode-panel-border, #333)',
    flexShrink: 0,
  },
  logo: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  quickAskBtn: {
    padding: '3px 10px',
    backgroundColor: 'var(--vscode-button-secondaryBackground, #3a3d41)',
    color: 'var(--vscode-button-secondaryForeground, #fff)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  lockBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 16px',
    backgroundColor: 'var(--vscode-editorWarning-background, #3d3415)',
    color: 'var(--vscode-editorWarning-foreground, #cca700)',
    fontSize: '12px',
    flexShrink: 0,
    borderBottom: '1px solid var(--vscode-panel-border, #333)',
  },
  lockGoBtn: {
    marginLeft: 'auto',
    padding: '2px 8px',
    backgroundColor: 'var(--vscode-button-secondaryBackground, #3a3d41)',
    color: 'var(--vscode-button-secondaryForeground, #fff)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  errorBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 16px',
    backgroundColor: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
    color: 'var(--vscode-errorForeground, #f48771)',
    fontSize: '12px',
    flexShrink: 0,
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '11px',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  canvasArea: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    backgroundColor: 'var(--vscode-sideBar-background, #181818)',
  },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  detailPanel: {
    width: '360px',
    minWidth: '300px',
    borderLeft: '1px solid var(--vscode-panel-border, #333)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
    flexShrink: 0,
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--vscode-panel-border, #333)',
    gap: '8px',
  },
  detailTitle: {
    fontSize: '13px',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    cursor: 'text',
  },
  titleInput: {
    flex: 1,
    fontSize: '13px',
    fontWeight: 600,
    padding: '2px 6px',
    backgroundColor: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-focusBorder, #007fd4)',
    borderRadius: '3px',
    outline: 'none',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--vscode-foreground, #ccc)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 6px',
    opacity: 0.6,
    flexShrink: 0,
  },
  detailBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
  },
  inputBar: {
    borderTop: '1px solid var(--vscode-panel-border, #333)',
    padding: '8px 16px 10px',
    flexShrink: 0,
  },
  inputHint: {
    fontSize: '10px',
    opacity: 0.5,
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '7px 12px',
    backgroundColor: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, #555)',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
  },
  submitBtn: {
    padding: '7px 14px',
    backgroundColor: 'var(--vscode-button-background, #0e639c)',
    color: 'var(--vscode-button-foreground, #fff)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 700,
    lineHeight: 1,
  },
};

export default App;
