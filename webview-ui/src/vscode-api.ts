/**
 * Typed wrapper around the VS Code webview API.
 */

// Types mirrored from the extension (keep in sync with src/shared/types.ts)
// We duplicate minimally to avoid complex build-time sharing.
export type NodeId = string;
export type BranchId = string;
export type FileHash = string;

export type NodeStatus =
  | 'draft'
  | 'previewing'
  | 'committed'
  | 'error';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ToolCall {
  tool: 'read_file' | 'write_file' | 'list_files' | 'search_files';
  input: { path: string; content?: string };
  result: { ok: boolean; data?: string; error?: string };
}

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
    fileHashes: Record<string, FileHash>;
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

export function getVisibleNodeIds(tree: ZygoteTree): Set<NodeId> {
  const branch = tree.branches[tree.activeBranchId];
  if (!branch?.headNodeId) return new Set();
  const visible = new Set<NodeId>();
  let cur: NodeId | null = branch.headNodeId;
  while (cur) {
    const node: ZygoteNode | undefined = tree.nodes[cur];
    if (!node) break;
    visible.add(cur);
    cur = node.parentId;
  }
  return visible;
}

// VS Code API singleton
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
