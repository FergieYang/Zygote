import * as vscode from 'vscode';
import { getWebviewHtml } from './html.js';
import { loadTree, saveTree } from '../state/persistence.js';
import {
  createNode,
  updateNodeTitle,
  updateNodePrompt,
  deleteNode,
  deleteBranch,
  switchBranch,
  appendChatMessage,
} from '../state/tree.js';
import { runPreview, rejectPreviewResult, handleQuickAsk } from '../agent/runner.js';
import { captureWorkspaceSnapshot, restoreWorkspaceSnapshot } from '../state/snapshots.js';
import { dbg } from '../debug/logger.js';
import type {
  ZygoteTree,
  NodeId,
  WebviewToExtMessage,
  ExtToWebviewMessage,
} from '../shared/types.js';

export class ZygotePanel {
  public static currentPanel: ZygotePanel | undefined;
  private static readonly viewType = 'zygote.panel';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly secretStorage: vscode.SecretStorage;
  private tree: ZygoteTree;
  private disposables: vscode.Disposable[] = [];
  private activeRunNodeId: NodeId | null = null;
  private pendingCheckoutNodeId: NodeId | null = null;

  public static createOrShow(
    extensionUri: vscode.Uri,
    secretStorage: vscode.SecretStorage,
    tree: ZygoteTree
  ): ZygotePanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (ZygotePanel.currentPanel) {
      ZygotePanel.currentPanel.panel.reveal(column);
      ZygotePanel.currentPanel.tree = tree;
      ZygotePanel.currentPanel.sendTreeUpdate();
      return ZygotePanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      ZygotePanel.viewType,
      'Zygote',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
        ],
      }
    );

    ZygotePanel.currentPanel = new ZygotePanel(
      panel,
      extensionUri,
      secretStorage,
      tree
    );
    return ZygotePanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    secretStorage: vscode.SecretStorage,
    tree: ZygoteTree
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.secretStorage = secretStorage;
    this.tree = tree;

    // Set the webview's HTML content
    this.panel.webview.html = getWebviewHtml(
      this.panel.webview,
      this.extensionUri
    );

    // Listen for messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message: Record<string, unknown>) => {
        if (message.type === 'webviewReady') {
          this.sendTreeUpdate();
          return;
        }
        this.handleMessage(message as WebviewToExtMessage);
      },
      null,
      this.disposables
    );

    // Handle disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Tree is sent when the webview signals it's ready (webviewReady message)
  }

  public dispose(): void {
    dbg()?.info('lifecycle', 'ZygotePanel disposed');
    ZygotePanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }

  public captureDebugSnapshot(): string {
    const extra = this.runtimeState();
    return dbg()?.captureSnapshot(this.tree, extra) ?? '(logger not initialized)';
  }

  public dumpTree(): string {
    const extra = this.runtimeState();
    return dbg()?.dumpTree(this.tree, extra) ?? '(logger not initialized)';
  }

  private runtimeState(): Record<string, unknown> {
    return {
      activeRunNodeId: this.activeRunNodeId,
      pendingCheckoutNodeId: this.pendingCheckoutNodeId,
      panelVisible: this.panel.visible,
      backendSetting: vscode.workspace.getConfiguration('zygote').get('backend'),
    };
  }

  /**
   * Update the tree and persist it.
   */
  private updateTree(tree: ZygoteTree): void {
    this.tree = tree;
    saveTree(tree.workspaceRoot, tree);
    this.sendTreeUpdate();
  }

  /**
   * Send the current tree state to the webview.
   */
  private sendTreeUpdate(): void {
    this.postMessage({ type: 'treeUpdated', tree: this.tree });
  }

  /**
   * Post a message to the webview.
   */
  private postMessage(message: ExtToWebviewMessage): void {
    this.panel.webview.postMessage(message);
  }

  private async executePendingCheckout(): Promise<void> {
    if (this.pendingCheckoutNodeId) {
      const toNode = this.tree.nodes[this.pendingCheckoutNodeId];
      const checkoutHashes = toNode?.workspaceSnapshot?.after || toNode?.workspaceSnapshot?.fileHashes;
      if (checkoutHashes) {
        restoreWorkspaceSnapshot(
          this.tree.workspaceRoot,
          checkoutHashes
        );
      }
      this.pendingCheckoutNodeId = null;
      this.postMessage({ type: 'workspaceUnlocked' });
      this.sendTreeUpdate();
    }
  }

  private summarizeNodeTitle(nodeId: string, prompt: string): void {
    handleQuickAsk(
      `Summarize this coding task in 3-5 words as a short title. Reply with ONLY the title, no quotes, no punctuation at the end.\n\nTask: ${prompt}`,
      this.secretStorage
    ).then((title) => {
      const trimmed = title.trim().slice(0, 60);
      if (!trimmed) return;
      const node = this.tree.nodes[nodeId];
      if (!node) return;
      const updatedNode = { ...node, title: trimmed };
      this.tree = {
        ...this.tree,
        nodes: { ...this.tree.nodes, [nodeId]: updatedNode },
      };
      saveTree(this.tree.workspaceRoot, this.tree);
      this.sendTreeUpdate();
    }).catch(() => {
      // Keep the truncated prompt as title if summarization fails
    });
  }

  private runPreviewCallbacks() {
    return {
      onTreeUpdated: (tree: ZygoteTree) => {
        this.tree = tree;
        this.sendTreeUpdate();
      },
      onOutputStream: (nodeId: string, delta: string) => {
        this.postMessage({ type: 'nodeOutputStream', nodeId, delta });
      },
      onThinkingStream: (nodeId: string, delta: string) => {
        this.postMessage({ type: 'nodeThinkingStream', nodeId, delta });
      },
    };
  }

  private async captureCurrentSnapshot(): Promise<Record<string, string>> {
    const pattern = new vscode.RelativePattern(this.tree.workspaceRoot, '**/*');
    const exclude = '**/node_modules/**,**/.zygote/**,**/.git/**,**/dist/**';
    const uris = await vscode.workspace.findFiles(pattern, exclude, 500);
    const filePaths = uris.map((uri) => uri.fsPath);
    return captureWorkspaceSnapshot(this.tree.workspaceRoot, filePaths);
  }

  /**
   * Handle incoming messages from the webview.
   */
  private async handleMessage(message: WebviewToExtMessage): Promise<void> {
    dbg()?.info('msg', `webview → ext: ${message.type}`, this.messagePayload(message));
    try {
      switch (message.type) {
        case 'webviewReady':
          break;

        case 'createNode': {
          const result = createNode(
            this.tree,
            message.parentId,
            message.prompt
          );
          this.updateTree(result.tree);
          if (message.prompt.trim()) {
            // Async title summarization (non-blocking)
            this.summarizeNodeTitle(result.nodeId, message.prompt);

            this.activeRunNodeId = result.nodeId;
            this.tree = await runPreview(
              this.tree,
              result.nodeId,
              this.secretStorage,
              this.runPreviewCallbacks()
            );
            this.activeRunNodeId = null;
            await this.executePendingCheckout();
          }
          break;
        }

        case 'updateNodeTitle': {
          const titleUpdated = updateNodeTitle(
            this.tree,
            message.nodeId,
            message.title
          );
          this.updateTree(titleUpdated);
          break;
        }

        case 'updateNodePrompt': {
          const updatedTree = updateNodePrompt(
            this.tree,
            message.nodeId,
            message.prompt
          );
          this.updateTree(updatedTree);
          break;
        }

        case 'appendChatMessage': {
          const updatedTree = appendChatMessage(
            this.tree,
            message.nodeId,
            message.role,
            message.content
          );
          this.updateTree(updatedTree);
          break;
        }

        case 'requestChatResponse': {
          this.activeRunNodeId = message.nodeId;
          this.tree = await runPreview(
            this.tree,
            message.nodeId,
            this.secretStorage,
            this.runPreviewCallbacks()
          );
          this.activeRunNodeId = null;
          await this.executePendingCheckout();
          break;
        }

        case 'previewNode': {
          this.activeRunNodeId = message.nodeId;
          this.tree = await runPreview(
            this.tree,
            message.nodeId,
            this.secretStorage,
            this.runPreviewCallbacks()
          );
          this.activeRunNodeId = null;
          await this.executePendingCheckout();
          break;
        }

        case 'rejectPreview': {
          const node = this.tree.nodes[message.nodeId];
          const beforeHashes = node?.workspaceSnapshot?.before || node?.workspaceSnapshot?.fileHashes;
          if (beforeHashes) {
            const rejected = rejectPreviewResult(
              this.tree,
              message.nodeId,
              beforeHashes
            );
            this.updateTree(rejected);
          }
          break;
        }

        case 'saveAndCheckout': {
          if (this.activeRunNodeId) {
            this.pendingCheckoutNodeId = message.toNodeId;
            const lockedNode = this.tree.nodes[this.activeRunNodeId];
            this.postMessage({
              type: 'workspaceLocked',
              lockedToNodeId: this.activeRunNodeId,
              lockedToTitle: lockedNode?.title ?? 'running node',
            });
            this.sendTreeUpdate();
            break;
          }
          // Save current node's workspace state before switching
          if (message.fromNodeId) {
            const fromNode = this.tree.nodes[message.fromNodeId];
            if (fromNode) {
              const hashes = await this.captureCurrentSnapshot();
              const updatedFrom = {
                ...fromNode,
                workspaceSnapshot: { fileHashes: hashes },
              };
              this.tree = {
                ...this.tree,
                nodes: { ...this.tree.nodes, [message.fromNodeId]: updatedFrom },
              };
              saveTree(this.tree.workspaceRoot, this.tree);
            }
          }
          // Restore target node's snapshot
          const toNode = this.tree.nodes[message.toNodeId];
          const switchHashes = toNode?.workspaceSnapshot?.after || toNode?.workspaceSnapshot?.fileHashes;
          if (switchHashes) {
            restoreWorkspaceSnapshot(
              this.tree.workspaceRoot,
              switchHashes
            );
          }
          this.sendTreeUpdate();
          break;
        }

        case 'switchBranch': {
          const switched = switchBranch(this.tree, message.branchId);
          this.updateTree(switched);
          break;
        }

        case 'deleteBranch': {
          const branchToDelete = this.tree.branches[message.branchId];
          if (this.tree.activeBranchId === message.branchId && branchToDelete?.parentBranchId) {
            this.tree = switchBranch(this.tree, branchToDelete.parentBranchId);
          }
          const afterDelete = deleteBranch(this.tree, message.branchId);
          this.updateTree(afterDelete);
          break;
        }

        case 'deleteNode': {
          const nodeToDelete = this.tree.nodes[message.nodeId];
          const deleted = deleteNode(this.tree, message.nodeId);
          this.updateTree(deleted);
          // Revert workspace to parent node's snapshot
          if (nodeToDelete?.parentId) {
            const parent = deleted.nodes[nodeToDelete.parentId];
            const parentHashes = parent?.workspaceSnapshot?.after || parent?.workspaceSnapshot?.fileHashes;
            if (parentHashes) {
              restoreWorkspaceSnapshot(
                deleted.workspaceRoot,
                parentHashes
              );
            }
          }
          break;
        }

        case 'quickAsk': {
          try {
            const response = await handleQuickAsk(
              message.prompt,
              this.secretStorage
            );
            this.postMessage({ type: 'quickAskResponse', response });
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : String(err);
            this.postMessage({ type: 'error', message: errorMsg });
          }
          break;
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      dbg()?.error('handler', `Error handling "${message.type}"`, {
        error: errorMsg,
        stack: err instanceof Error ? err.stack : undefined,
      });
      this.postMessage({ type: 'error', message: errorMsg });
      vscode.window.showErrorMessage(`Zygote: ${errorMsg}`);
    }
  }

  private messagePayload(message: WebviewToExtMessage): Record<string, unknown> {
    switch (message.type) {
      case 'createNode':
        return { parentId: message.parentId, promptLen: message.prompt.length };
      case 'previewNode':
      case 'rejectPreview':
      case 'requestChatResponse':
      case 'deleteNode':
        return { nodeId: message.nodeId };
      case 'saveAndCheckout':
        return { fromNodeId: message.fromNodeId, toNodeId: message.toNodeId };
      case 'switchBranch':
      case 'deleteBranch':
        return { branchId: message.branchId };
      default:
        return {};
    }
  }
}
