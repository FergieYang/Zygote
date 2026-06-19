export type NodeId = string; // UUID
export type BranchId = string; // UUID
export type FileHash = string; // SHA-256 hex digest

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

// Message protocol (spec section 7.5)
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
// User clicks button → WebviewToExt → Extension processes it → ExtToWebview → UI updates
