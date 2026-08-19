/**
 * The bridge between the webview UI and the extension host — the only file in
 * webview-ui that talks to VS Code directly. It mirrors the shared data model
 * (tree, nodes, branches) and the two message protocols from src/shared/types.ts,
 * and wraps acquireVsCodeApi() in typed postMessage/onMessage helpers so the rest
 * of the UI never handles raw, untyped messages. It serves as the single doorway of all messages.
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
// no trace of the types: instructions to the compiler but not to the computer
export type NodeId = string;
export type BranchId = string;
// SHA-256 hash of a file's content, as a 64-character hex string
// example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
// One hash = the fingerprint of one file's bytes at one moment.
export type FileHash = string;

export type NodeStatus =
  | 'draft'
  | 'previewing'
  | 'committed'
  | 'error';


// In TypeScript language: interface describes the shape of an object

// Current zygote ai just accept the input of the string as the content, here as
// the further explore of array of the typed blocks of text, images, tool calls. tool results and thinking ,extra.
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}


// other useful tool call in the industry: edit (string replacement), Glob(filename patterns),
// grep (fast content search), bash (run terminal commands), websearch/webfetch,
// subagents(task/agent) for spawning parallel workers...
// edit-by-patch, MCP, semantic codebase search via embeddings vs. agentic grep
// computer use
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
  // snapshot of the workspace Zygote is opened on
  // path of the file under workspaceroot -> hash of the file content
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
  // the branch that this node lives on
  parentBranchId?: BranchId;
  // that forked node itself
  forkedAtNodeId?: NodeId;
  createdAt: number;
}


// workspaceroot is the absolute path of the folder vs code has open
// the current active node id can be derived from the active branchId
// The "selected node" is deliverately not tree data because only serve for the viewing function
export interface ZygoteTree {
  workspaceRoot: string;
  // []: means an array of that type of the NodeId.
  // the list of the root nodes
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
// "A global function named acquireVsCodeApi will exist at runtime, 
// returning a VsCodeApi-shaped object. 
// Don't ask where it comes from — just let me call it."
declare function acquireVsCodeApi(): VsCodeApi;


/**
 * This pattern is called lazy singleton: 
 * 'Lazy':
 * not required until someone actually needs it.
 * 'Singleton':
 * there is only ever one.
 */
/**
 * Modern JS/TS Style:
 * Const by default: for bindings are never reassigned.
 * let only when reassignment is the point, it would change somewhere.
 */
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
  // '=>' describe the shape and the type of the function.
  handler: (message: ExtToWebviewMessage) => void
  // return type of the onMessage
): () => void {
  // add a wrapper and remember it in a const, because we'll need this exact const listener
  const listener = (event: MessageEvent) => {
    handler(event.data as ExtToWebviewMessage);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
/**
 * register once ->
 * fire N times ->
 * deregister once ->
 * window is the browser's built-in global object
 */
