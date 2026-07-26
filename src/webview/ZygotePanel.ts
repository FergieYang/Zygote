/**
 * ZygotePanel — extension-host controller that owns the Zygote webview.
 *
 * MEANING: the one bridge between html.ts's two worlds — the React UI
 * (sandboxed webview) and the Node/VS Code backend. A per-window singleton
 * (`currentPanel`) that carries no business logic itself; it's the switchboard
 * wiring user intent to the backend modules.
 *
 * FUNCTION:
 *   - owns the panel lifecycle (createOrShow / dispose) and the live webview.
 *   - holds the authoritative in-memory `tree` (the branch/speculation state).
 *   - inbound: maps each WebviewToExtMessage (createNode, previewNode,
 *     switchBranch, deleteNode, quickAsk…) onto a pure backend call.
 *   - outbound: posts ExtToWebviewMessage back (treeUpdated, output/thinking
 *     streams, workspaceLocked/Unlocked) so the UI re-renders.
 *   - serializes run vs. checkout (activeRunNodeId, pendingCheckoutNodeId) and
 *     snapshots the workspace per node.
 *
 * POSITION — extension.ts creates it on `zygote.open`; html.ts (sibling)
 * renders its page; agent/runner.ts does the AI work; state/{tree,persistence,
 * snapshots}.ts mutate / save / restore; shared/types.ts is the message
 * contract both sides speak. The controller in the middle:
 * extension.ts → ZygotePanel → {tree, runner, snapshots}, html.ts the view side.
 * extension.ts ──→ ZygotePanel ──┬──→ html.ts (webview/React UI)
                               ├──→ state/tree.ts, state/persistence.ts, state/snapshots.ts
                               ├──→ agent/runner.ts ──→ agent/claude.ts, agent/tools.ts
                               ├──→ shared/types.ts (message contract, used by both sides)
                               └──→ debug/logger.ts
 * The backend modules (tree, runner, snapshots) aren't running alongside ZygotePanel; 
 * they're passive libraries of functions that ZygotePanel calls when a message arrives.
 */
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
  // static = lives on the class, one shared slot (not per-instance); the singleton
  // handle to the one open panel, or undefined when none is open. Static ≠ fixed: reassigned.
  public static currentPanel: ZygotePanel | undefined;
  // static readonly = class-level AND set-once; the ID string VS Code uses to tag this webview type.
  private static readonly viewType = 'zygote.panel';

  // readonly = assigned once in the constructor, never rebound afterward.
  private readonly panel: vscode.WebviewPanel;      // the live VS Code webview — the actual tab/surface
  private readonly extensionUri: vscode.Uri;        // where the extension is installed — resolves asset paths
  private readonly secretStorage: vscode.SecretStorage; // VS Code's encrypted store — holds the API key
  // tree, activeRunNodeId, pendingCheckoutNodeId could be reassigned.
  // disposables is mutated but never reassigned.
  // mutated. e.g. .push() or .pop(), contents has been changed but still the same array object.
  private tree: ZygoteTree;                         // authoritative in-memory app state (branches + nodes)
  private disposables: vscode.Disposable[] = [];    // cleanup handles freed on dispose() — mutated, so not readonly
  private activeRunNodeId: NodeId | null = null;    // node currently mid-run, or null when idle
  private pendingCheckoutNodeId: NodeId | null = null; // checkout deferred until the active run finishes, or null
  // 'method' or 'function' defined inside the class ZygotePanel.
  public static createOrShow(
    extensionUri: vscode.Uri,
    secretStorage: vscode.SecretStorage,
    tree: ZygoteTree
    // name: Type: default in typescript language, that "this thing has this type".
  ): ZygotePanel {
    // activeTextEditor = the editor the user is currently focused in (undefined if none).
    // .viewColumn = which split/pane (column) that editor sits in — VS Code tiles editors
    // into columns 1, 2, 3… left to right. We grab it so the Zygote panel opens in the
    // same column the user is looking at; undefined when there's no active editor.
    // // typical ts logic here: condition ? valueIfTrue : valueIfFalse
    // // // column is the number of the splitted group inside the vsc
    // // // and the way to split the group inside the vsc is use 'Ctrl+\'
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    // meaning: opening zygote twice doesn't give you two panels
    // the second open just refocuses and refreshes the one that's already there.    
    // If we already have a panel, show it
    if (ZygotePanel.currentPanel) {
      // bring the existing panel to the front, focus it in that panel
      // the reveal method is an vsc api method.
      ZygotePanel.currentPanel.panel.reveal(column);
      // swap in the latest tree data
      ZygotePanel.currentPanel.tree = tree;
      // push that new tree to the ui so it re-renders.
      // our own private postmessage method
      ZygotePanel.currentPanel.sendTreeUpdate();
      // hand back the existing panel and skip creation
      return ZygotePanel.currentPanel;
    }

    // Otherwise, create a new panel
  const panel = vscode.window.createWebviewPanel(   // ask VS Code for a fresh raw webview pane
    // always fixed, always the class itself
    ZygotePanel.viewType,          // internal type id 'zygote.panel' — tags what kind of webview this is
    'Zygote',                      // the tab title the user sees
    column || vscode.ViewColumn.One, // put it in the user's column; if none, fall back to column 1
    {
      enableScripts: true,             // allow JS to run inside (needed — it's a React app)
      retainContextWhenHidden: true,   // keep the webview alive when tab is hidden (don't reload on switch)
      localResourceRoots: [            // whitelist the only folder the webview may load files from
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview'), // = <extension>/dist/webview (the built JS/CSS)
      ],
    }
  );
    // create the new panel of zygote as here
    // create a new instance of ZygotePanel, wrap the raw panel in our own class.
    ZygotePanel.currentPanel = new ZygotePanel(
      panel, // pass the exact raw created panel to the constructor
      extensionUri,
      secretStorage,
      tree
    );
    return ZygotePanel.currentPanel;
  }
  // Private only called from inside the class.
  // 'this' works in every instance method of the class 'down' in the class body
  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    secretStorage: vscode.SecretStorage,
    tree: ZygoteTree
  ) {
    // this: save the ingredients I was given to myself, so my methods can use them later.
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.secretStorage = secretStorage;
    this.tree = tree;

    // Set the webview's HTML content
    this.panel.webview.html = getWebviewHtml(
      // How do I write that path so the browser sandbox can load it?
      this.panel.webview,
      // where do the built files live on disk?
      this.extensionUri
    );

    // Listen for messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message: Record<string, unknown>) => {
        if (message.type === 'webviewReady') {
    // just feed the UI for its first tree
          this.sendTreeUpdate();
          return;
        }
    // the big switch to the backend calls
        this.handleMessage(message as WebviewToExtMessage);
      },
     // place skipper for nothing
      null,
    // subscription deposit their cancel-tickets into disposable at birth and dispose()
    // cashes them all in at death, so we don't leak memory. The webview is a sandboxed iframe, and if the user closes it, we need to free the event listener.
      this.disposables
    );

    // Handle disposal
    // this.dispose() is the function to run per message
    // null = thisArg is the unused one and act as the placeholder
    // this.disposables = collection bucket and the bucket to drop the cancel-ticket into.
    this.panel.onDidDispose(          // "when the user closes the Zygote tab..."
    () => this.dispose(),           // "...run my cleanup method"
    null,                           // (skip the thisArg slot — arrow fn doesn't need it)
    this.disposables                // "and put this subscription's cancel-ticket in the bucket too"
    );
    // Tree is sent when the webview signals it's ready (webviewReady message)
  }

  public dispose(): void {
    // dbg() fetch the debugger logger
    // life cycle = the category of this log message
    // ZygotePanel disposed = the message
    dbg()?.info('lifecycle', 'ZygotePanel disposed');
    ZygotePanel.currentPanel = undefined;
    // dispose of the panel itself.
    // dispose all the own separate registration of the message listener
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }

  // tab closed
  // └→ onDidDispose fires        (the trigger)
  // └→ this.dispose() runs  (the cleanup routine)
  //      └→ while loop empties the bucket
  //           └→ ...which cancels the onDidDispose subscription too
  // Each time it is called, a fresh, at-this-moment snapshot of the tree is captured.
  public captureDebugSnapshot(): string {
    const extra = this.runtimeState();
    return dbg()?.captureSnapshot(this.tree, extra) ?? '(logger not initialized)';
  }
  // human-readable markdown file of the entire tree
  public dumpTree(): string {
    const extra = this.runtimeState();
    return dbg()?.dumpTree(this.tree, extra) ?? '(logger not initialized)';
  }
  // Record<string, unknown> = 
  // an object type with keys of type string and values of type unknown
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
  this.tree = tree;                      // 1. MEMORY — replace the panel's in-RAM copy
  saveTree(tree.workspaceRoot, tree);    // 2. DISK — write it to a file in the workspace
  this.sendTreeUpdate();                 // 3. UI — post it to the webview so React re-renders
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
