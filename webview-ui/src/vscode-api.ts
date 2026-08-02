/**
 * The bridge between the webview UI and the extension host — the only file in
 * webview-ui that talks to VS Code directly. It mirrors the shared data model
 * (tree, nodes, branches) and the two message protocols from src/shared/types.ts,
 * and wraps acquireVsCodeApi() in typed postMessage/onMessage helpers so the rest
 * of the UI never handles raw, untyped messages.
 */

/**
 * src/webview/ - the extension-host side of the webview
 * webview-ui/ - the UI itself, a standalone web app
 */
/** as here for the bridge:
 * Browser end: this file, sends messages out via postMessage() and 
 * receives them via onMessage()
 * Extension end: ZygotePanel.ts, onDidReceiveMessage handler what the UI sends and 
 * webview.postMessage() sends updates back.
 */
// Types mirrored from the extension (keep in sync with src/shared/types.ts)
// We duplicate minimally to avoid complex build-time sharing.
// Typical TypeScript feature, not JavaScript, 
// completely erased when the code compiles
export type NodeId = string;
export type BranchId = string;
export type FileHash = string;

export type NodeStatus =
  | 'draft'
  | 'previewing'
  | 'committed'
  | 'error';


// In TypeScript language: interface describes the shape of an object

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ToolCall {
  tool: 'read_file' | 'write_file' | 'list_files' | 'search_files';
  // content optional input to the tool call
  input: { path: string; content?: string };
  // success flag for the tool execution
  result: { ok: boolean; data?: string; error?: string };
}

// createAt is the moment the node or branch has been created
// its main purpose is for ordering
export interface ZygoteNode {
  id: NodeId;
  parentId: NodeId | null;
  branchId: BranchId;
  createdAt: number;
  title: string;
  prompt: string;
  chat: ChatMessage[];
  status: NodeStatus;
  agentResponse?: string;
  thinkingContent?: string;
  toolCalls?: ToolCall[];
  error?: string;
  workspaceSnapshot?: {
    before?: Record<string, FileHash>;
    after?: Record<string, FileHash>;
    fileHashes?: Record<string, FileHash>;  // Legacy — kept for backward compatibility with existing saved trees
  };
  tokens?: { input: number; output: number };
}

export interface ZygoteBranch {
  id: BranchId;
  name: string;
  headNodeId: NodeId | null;
  parentBranchId?: BranchId;
  forkedAtNodeId?: NodeId;
  createdAt: number;
}

export interface ZygoteTree {
  workspaceRoot: string;
  rootNodeIds: NodeId[];
  nodes: Record<NodeId, ZygoteNode>;
  branches: Record<BranchId, ZygoteBranch>;
  activeBranchId: BranchId;
}

export type WebviewToExtMessage =
  | { type: 'webviewReady' }
  | { type: 'createNode'; parentId: NodeId | null; prompt: string }
  | { type: 'updateNodePrompt'; nodeId: NodeId; prompt: string }
  | { type: 'updateNodeTitle'; nodeId: NodeId; title: string }
  | { type: 'appendChatMessage'; nodeId: NodeId; role: 'user'; content: string }
  | { type: 'requestChatResponse'; nodeId: NodeId }
  | { type: 'previewNode'; nodeId: NodeId }
  | { type: 'rejectPreview'; nodeId: NodeId }
  | { type: 'saveAndCheckout'; fromNodeId: NodeId | null; toNodeId: NodeId }
  | { type: 'switchBranch'; branchId: BranchId }
  | { type: 'deleteNode'; nodeId: NodeId }
  | { type: 'deleteBranch'; branchId: BranchId }
  | { type: 'quickAsk'; prompt: string };

export type ExtToWebviewMessage =
  | { type: 'treeUpdated'; tree: ZygoteTree }
  | { type: 'nodeStatusChanged'; nodeId: NodeId; status: NodeStatus }
  | { type: 'nodeOutputStream'; nodeId: NodeId; delta: string }
  | { type: 'nodeThinkingStream'; nodeId: NodeId; delta: string }
  | { type: 'workspaceLocked'; lockedToNodeId: NodeId; lockedToTitle: string }
  | { type: 'workspaceUnlocked' }
  | { type: 'error'; message: string; nodeId?: NodeId }
  | { type: 'quickAskResponse'; response: string };

// pure helper function, used in Tree.tsx
// walk path from the head backwards up to the root
export function getVisibleNodeIds(tree: ZygoteTree): Set<NodeId> {
  const branch = tree.branches[tree.activeBranchId];
// no branch, or branch with no nodes yet -> nothing visible
  if (!branch?.headNodeId) return new Set();
  const visible = new Set<NodeId>();
// start at the tip or head of the branch
// if the branch is empty, set the head to be null
  let cur: NodeId | null = branch.headNodeId;
  while (cur) {
// only check if zygote node exist here
    const node: ZygoteNode | undefined = tree.nodes[cur];
    if (!node) break;
    visible.add(cur);
    cur = node.parentId;
  }
  return visible;
}

// VS Code API singleton: exact method vsc itself gives every webview
// postMessage: the only channel to the sandbox, a JSON message to the extension host
// getState / setState: persist state within the webview, especially when the tab is switched/
interface VsCodeApi {
  postMessage(message: WebviewToExtMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    api = acquireVsCodeApi();
  }
  return api;
}

/**
 * Send a typed message to the extension host.
 */
export function postMessage(message: WebviewToExtMessage): void {
  getVsCodeApi().postMessage(message);
}

/**
 * Listen for messages from the extension host.
 */
export function onMessage(
  handler: (message: ExtToWebviewMessage) => void
): () => void {
  const listener = (event: MessageEvent) => {
    handler(event.data as ExtToWebviewMessage);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
