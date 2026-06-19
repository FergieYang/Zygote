/**
 * src/state/tree.ts — Zygote's in-memory state model: the node/branch tree.
 *
 * Zygote is a VS Code extension that gives AI coding agents a *tree-based working
 * surface*. Instead of one linear chat, each prompt is a `ZygoteNode` and alternative
 * continuations live on separate `ZygoteBranch`es — a git-like DAG of speculative
 * edits you can preview, commit, fork, or discard.
 *
 * This module is the single source of truth for that structure. It is a set of PURE,
 * IMMUTABLE transforms over a `ZygoteTree`: every function takes a tree and returns a
 * new one (never mutating in place), and performs NO I/O — no disk, no agent calls, no
 * workspace file changes. That keeps the model predictable, diffable, and serializable.
 *
 * Contents:
 *   • Grow the tree — createDefaultTree, createNode. (createNode auto-forks
 *     a branch when a parent already has a child on the active branch; this is what
 *     makes branching "speculative".)
 *   • Edit a node through its draft → previewing → committed / error lifecycle —
 *     setNodeStatus, updateNodePrompt, updateNodeTitle, appendChatMessage.
 *   • Prune & navigate — deleteNode, deleteBranch, switchBranch.
 *     (Undo/reject of a committed preview lives in runner.ts `rejectPreviewResult`,
 *     since it must also restore workspace files — out of scope for this pure module.)
 *   • Query — getBranchNodes (root→leaf along a branch), getNodeChildren.
 *
 * Position in the project — this is the "model" layer; its neighbours handle effects:
 *   • ../shared/types.ts        — defines ZygoteTree / ZygoteNode / ZygoteBranch.
 *   • ../state/persistence.ts   — saves & loads the tree to/from disk.
 *   • ../state/snapshots.ts     — captures & restores the workspace files that a
 *                                 node's `workspaceSnapshot` records.
 *   • ../agent/runner.ts        — drives node status transitions while an agent runs.
 *   • ../webview/ZygotePanel.ts — turns UI actions into these tree operations.
 *
 * Agent execution, file restoration, and persistence are deliberately kept out of
 * this file and handled by those neighbours.
 */
/*
*The big picture: two different jobs
tree.ts	ZygotePanel.ts
Role	Model — pure data	Controller — orchestration
What it does	Given a tree + args, compute a new tree	Receive UI messages, call the model, do side effects
Side effects	None (no disk, no agent, no VS Code)	All of them (save to disk, push to UI, run agent, restore files)
Knows about	Only the data shape	VS Code, webview, secrets, disk, the agent
this/state	Stateless functions	Holds the live this.tree
So the "same-named functions" aren't two copies of one thing — they're one computation (tree.ts) wrapped by one orchestration step (ZygotePanel).
*/
import { v4 as uuidv4 } from 'uuid';
import type {
  ZygoteTree,
  ZygoteNode,
  ZygoteBranch,
  NodeId,
  BranchId,
  NodeStatus,
  FileHash,
} from '../shared/types.js';

/*loadTree(workspaceRoot)
│
├─ tree.json MISSING?  ──yes──▶  createDefaultTree → save → return   [lines 65–70]
│
└─ no (file exists)
       │
       ▼
   try {                                                            [lines 72–112]
     read tree.json → JSON.parse → repair it (self-heal) → return
   } catch (err) {                                                  [lines 113–118]
     parse failed → createDefaultTree → save → return   ← THE try/catch
   }
*/
export function createDefaultTree(workspaceRoot: string): ZygoteTree {
  const mainBranchId = uuidv4();

  const mainBranch: ZygoteBranch = {
    id: mainBranchId,
    name: 'main',
    headNodeId: null,
    createdAt: Date.now(),
  };

  return {
    workspaceRoot,
    rootNodeIds: [],
    nodes: {},
    branches: { [mainBranchId]: mainBranch },
    activeBranchId: mainBranchId,
  };
}

/**
 * Create a new node on the active branch.
 */
export function createNode(
  tree: ZygoteTree,
  parentId: NodeId | null,
  prompt: string
): { tree: ZygoteTree; nodeId: NodeId } {
  const nodeId = uuidv4();
  let targetBranchId = tree.activeBranchId;
  let updatedBranches = tree.branches;
  // !parentId — falsy check. True when no parent was given at all — null, undefined, or '' (a root node).
  // || — logical OR. The whole condition is true if EITHER side is true; the right side is only evaluated if the left is false.
  // ! — logical NOT. Flips truthy↔falsy.
  // tree.nodes[parentId] — looks up that parent in the nodes map. Returns the node object if it exists, or undefined if there's no such id.
  // So !tree.nodes[parentId] means "that parent does NOT exist in the tree."

  // Whole condition in plain English

  // "The parent is unusable — either none was supplied, or the supplied id has no matching node."

  // If there is no usable parent, treat this node as a root.
  // (Note: this also normalizes a falsy parentId like undefined to a clean null below.)
  if (!parentId || !tree.nodes[parentId]) {
    parentId = null;
  }

  // Auto-branch: if parent already has a child on the active branch, fork a new branch
  if (parentId) {
  // Object.values(...) throws away the keys and hands you back an array of just the node objects:
  // [ {…node aaa…}, {…node bbb…}, {…node ccc…} ]
  // .some(...) checks if at least one of those nodes 
  // matches the condition in the callback: T/F check, early stop if we find it.
  // n -> This is the test function so that .some can check each node it is a check logic, && for both true.
    const hasChildOnActiveBranch = Object.values(tree.nodes).some(
      (n) => n.parentId === parentId && n.branchId === tree.activeBranchId
    );
    if (hasChildOnActiveBranch) {
      const parentNode = tree.nodes[parentId];
      const newBranchId = uuidv4();
      const branchCount = Object.keys(tree.branches).length;
      const newBranch: ZygoteBranch = {
        id: newBranchId,
        name: `branch-${branchCount}`,
        headNodeId: null,
        parentBranchId: parentNode.branchId,
        forkedAtNodeId: parentId,
        createdAt: Date.now(),
      };
      targetBranchId = newBranchId;
      // "Build a new object containing everything tree.branches had, 
      // plus one more entry keyed by the new branch's id."
      updatedBranches = { ...tree.branches, [newBranchId]: newBranch };
      // updatedBranches = { ...tree.branches, [newBranchId]: newBranch } ;
      //└────────────── one assignment statement ──────────────────┘ end
    }
  }
  // new node's data, plain object literal.
  const node: ZygoteNode = {
    id: nodeId,
    parentId,
    branchId: targetBranchId,
    createdAt: Date.now(),
    title: prompt.slice(0, 60) + (prompt.length > 60 ? '...' : ''),
    prompt,
    chat: [
      {
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
      },
    ],
    status: 'draft',
  };
// put in the nodes map.
// Copy all existing nodes, then add this new node under its id (original tree.nodes untouched)
const updatedNodes = { ...tree.nodes, [nodeId]: node };
// adjust the root list
// If the node has no parent it's a top-level root → append its id to the root list;
// otherwise it's a child, so leave the root list exactly as it was
const updatedRootNodeIds =
  parentId === null ? [...tree.rootNodeIds, nodeId] : tree.rootNodeIds;
// find its branch
// Look up the branch this node lands on — either the active branch,
// or the freshly-forked branch set earlier by the auto-branch block
const targetBranch = updatedBranches[targetBranchId];
// point that branch's head at it.
// Copy that branch but move its "head" pointer to the new node —
// the new node becomes the tip (latest node) of the branch
const updatedBranch: ZygoteBranch = {
  ...targetBranch,
  headNodeId: nodeId,
};
// collect the ingredients you built above into one final result.
// Return a NEW tree (old one left intact) plus the id of the node we created
return {
  tree: {
    ...tree,                                                   // shallow-copy old tree (keeps workspaceRoot, etc.)
    nodes: updatedNodes,                                       // swap in the node map that includes the new node
    rootNodeIds: updatedRootNodeIds,                           // swap in root list (changed only if this was a root)
    branches: { ...updatedBranches, [targetBranchId]: updatedBranch }, // merge branches, overriding target with its moved head
    activeBranchId: targetBranchId,                            // make target branch active (matters when we auto-forked)
  },
  nodeId,                                                      // also hand the new node's id back to the caller
};

}
// updateNodeTitle in tree.ts is the pure manual-rename path; 
// it can't do AI summary because tree.ts 
// is forbidden from making agent calls (no I/O). 
// The AI feature lives one layer up, in the controller.
/**
 * Update a node's title.
 */
/**
 * only title is user typed rename
 */
export function updateNodeTitle(
  tree: ZygoteTree,
  nodeId: NodeId,
  title: string
): ZygoteTree {
  const node = tree.nodes[nodeId];
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  return {
    ...tree,
    nodes: { ...tree.nodes, [nodeId]: { ...node, title } },
  };
}

/**
 * Update a node's prompt text (only when status is 'draft').
 */
export function updateNodePrompt(
  tree: ZygoteTree,
  nodeId: NodeId,
  prompt: string
): ZygoteTree {
  const node = tree.nodes[nodeId];
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  if (node.status !== 'draft') {
    throw new Error(`Cannot update prompt: node status is ${node.status}`);
  }

  const updatedNode: ZygoteNode = {
    ...node,
    prompt,
    title: prompt.slice(0, 60) + (prompt.length > 60 ? '...' : ''),
  };

  return {
    ...tree,
    nodes: { ...tree.nodes, [nodeId]: updatedNode },
  };
}

/**
 * Set a node's status.
 */
// setNodeStatus = "change the node's status — 
// and, optionally, record the result data that came along with reaching 
// that status — in one atomic update."
// They arrive together.
// example to be called:
// setNodeStatus(tree, nodeId, 'previewing');                              // status only, no extras
// setNodeStatus(tree, nodeId, 'committed', { agentResponse, toolCalls,   // status + all results
//                                            workspaceSnapshot, tokens });
// setNodeStatus(tree, nodeId, 'error', { error: errMsg });               // status + just the error

export function setNodeStatus(
  tree: ZygoteTree,
  nodeId: NodeId,
  status: NodeStatus,
  // It's defined inline, right here in the function signature
  extras?: {
    agentResponse?: string;
    thinkingContent?: string;
    toolCalls?: ZygoteNode['toolCalls'];
    error?: string;
    workspaceSnapshot?: ZygoteNode['workspaceSnapshot'];
    tokens?: { input: number; output: number };
  }
): ZygoteTree {
  const node = tree.nodes[nodeId];
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const updatedNode: ZygoteNode = {
    ...node,
    status,
    // ... means spread operator.
    // only the fields the caller actually provided 
    // get written; everything else is left untouched.
    // !== undefined -> explicitly provided
    ...(extras?.agentResponse !== undefined && {
      agentResponse: extras.agentResponse,
    }),
    ...(extras?.thinkingContent !== undefined && {
      thinkingContent: extras.thinkingContent,
    }),
    ...(extras?.toolCalls !== undefined && { toolCalls: extras.toolCalls }),
    ...(extras?.error !== undefined && { error: extras.error }),
    ...(extras?.workspaceSnapshot !== undefined && {
      workspaceSnapshot: extras.workspaceSnapshot,
    }),
    ...(extras?.tokens !== undefined && { tokens: extras.tokens }),
  };

  return {
    ...tree,
    nodes: { ...tree.nodes, [nodeId]: updatedNode },
  };
}

/**
 * Append a chat message to a node.
 */
export function appendChatMessage(
  tree: ZygoteTree,
  nodeId: NodeId,
  role: 'user' | 'assistant',
  content: string
): ZygoteTree {
  const node = tree.nodes[nodeId];
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
// own conversation log of the history
  const updatedNode: ZygoteNode = {
    ...node,
    chat: [
      ...node.chat,
      { role, content, timestamp: Date.now() },
    ],
  };
// role	content is…	Who calls it
// 'user'	a user message (a follow-up typed in the chat)	webview → ZygotePanel.ts:279, from NodeChat.tsx:24
// 'assistant'	the agent's reply	runner.ts:488 appendChatMessage(tree, nodeId, 'assistant', fullResponse)
  return {
    ...tree,
    nodes: { ...tree.nodes, [nodeId]: updatedNode },
  };
}

/**
 * Delete a node from the tree. Only leaf nodes (no children) can be deleted.
 */
export function deleteNode(
  tree: ZygoteTree,
  nodeId: NodeId
): ZygoteTree {
  const node = tree.nodes[nodeId];
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  // Check that the node has no children
  const hasChildren = Object.values(tree.nodes).some(
    (n) => n.parentId === nodeId
  );
  if (hasChildren) {
    throw new Error('Cannot delete a node that has children');
  }

  // Immutably "delete a key": pull the node we want gone into a throwaway (_removed),
  // and collect EVERY OTHER node into a brand-new object (remainingNodes).
  // tree.nodes is left untouched; remainingNodes is a copy minus this one entry.
  const { [nodeId]: _removed, ...remainingNodes } = tree.nodes;
  // Drop this id from the root list too (no-op if it wasn't a root). filter() returns a NEW array.
  const updatedRootNodeIds = tree.rootNodeIds.filter((id) => id !== nodeId);

  // If the deleted node was the head of its branch, update the branch
  const branch = tree.branches[node.branchId];   // the branch the deleted node lived on
  let updatedBranches = tree.branches;            // default: branches unchanged (let, so we can swap it below)
  // Only fix up when this branch exists AND its tip (headNodeId) was pointing at the node we're deleting —
  // otherwise the head would be left dangling at a node that no longer exists.
  if (branch && branch.headNodeId === nodeId) {
    // Rebuild branches immutably: copy them all, but replace THIS branch with a copy
    // whose head is moved to the deleted node's parent (the new tip; null if it was a root).
    updatedBranches = {
      ...tree.branches,                 // keep every other branch as-is
      [node.branchId]: {                // override just the affected branch...
        ...branch,                      // ...copy its fields...
        headNodeId: node.parentId,      // ...but repoint head to the parent (new last node, or null)
      },
    };
  }

  // ── Prune a now-empty forked branch ──────────────────────────────────────
  // Deleting the LAST node of a non-main branch would otherwise leave a "ghost"
  // branch: still present in tree.branches, but owning no nodes and with a head
  // pointing across into the parent branch. So if no remaining node belongs to
  // this branch AND it isn't the main branch (main is the one with no
  // parentBranchId), drop the branch entirely.
  let updatedActiveBranchId = tree.activeBranchId;
  const branchIsNowEmpty = !Object.values(remainingNodes).some(
    (n) => n.branchId === node.branchId
  );
  if (branch && branch.parentBranchId && branchIsNowEmpty) {
    // Same immutable "delete a key" trick as above, but on the branches map.
    const { [node.branchId]: _removedBranch, ...remainingBranches } = updatedBranches;
    updatedBranches = remainingBranches;
    // If we just removed the active branch, fall back to its parent so
    // activeBranchId never dangles at a branch that no longer exists.
    if (updatedActiveBranchId === node.branchId) {
      updatedActiveBranchId = branch.parentBranchId;
    }
  }

  return {
    ...tree,
    nodes: remainingNodes,
    rootNodeIds: updatedRootNodeIds,
    branches: updatedBranches,
    activeBranchId: updatedActiveBranchId,
  };
}

/**
 * Delete a branch and all nodes exclusively owned by it.
 * Also recursively deletes child branches forked from this branch.
 */
export function deleteBranch(
  tree: ZygoteTree,
  branchId: BranchId
): ZygoteTree {
  const branch = tree.branches[branchId];
  if (!branch) {
    throw new Error(`Branch not found: ${branchId}`);
  }
  // 'main' is the default canvas baseline branch; 
  // the lineage the canvas always starts with
  if (!branch.parentBranchId) {
    throw new Error('Cannot delete the main branch');
  }
  // active branch -> the branch you'are presently navigating or working in.
  if (tree.activeBranchId === branchId) {
    throw new Error('Cannot delete the active branch. Switch to another branch first.');
  }

  // Collect this branch PLUS every branch transitively forked from it (the cascade set).
  // Build a parent → children index ONCE (O(B)), then walk only the real descendants
  // (O(K)) — instead of rescanning every branch at each step (which was ~O(B²)).
  const childrenByParent = new Map<BranchId, BranchId[]>();
  for (const b of Object.values(tree.branches)) {
    if (b.parentBranchId) {
      const kids = childrenByParent.get(b.parentBranchId) ?? [];
      kids.push(b.id);
      childrenByParent.set(b.parentBranchId, kids);
    }
  }

  const branchesToDelete = new Set<BranchId>();        // ids to remove; Set = no dupes + O(1) lookup
  const stack: BranchId[] = [branchId];                // iterative DFS (no recursion → depth-safe)
  while (stack.length > 0) {
    const bid = stack.pop();
    if (bid === undefined || branchesToDelete.has(bid)) continue;  // already queued → skip (dedupe / cycle guard)
    branchesToDelete.add(bid);                         // mark this branch for deletion
    for (const childId of childrenByParent.get(bid) ?? []) {
      stack.push(childId);                             // queue each direct child → pulls in the whole subtree
    }
  }

  const remainingNodes: Record<NodeId, ZygoteNode> = {};
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (!branchesToDelete.has(node.branchId)) {
      remainingNodes[id] = node;
    }
  }

  const remainingBranches: Record<BranchId, ZygoteBranch> = {};
  for (const [id, b] of Object.entries(tree.branches)) {
    if (!branchesToDelete.has(id)) {
      remainingBranches[id] = b;
    }
  }
  //rootNodeIds: the array of node ids that are top-level roots
  //.filter(predicate) returns a new array keeping only elements for which predicate is true
  // the logic of the loop up is that in remainingNodes if the node still exists, so we keep it.
  const updatedRootNodeIds = tree.rootNodeIds.filter(
    (id) => remainingNodes[id] !== undefined
  );

  return {
    ...tree,
    nodes: remainingNodes,
    branches: remainingBranches,
    rootNodeIds: updatedRootNodeIds,
  };
}

/**
 * Switch to an existing branch.
 */
export function switchBranch(
  tree: ZygoteTree,
  branchId: BranchId
): ZygoteTree {
  const branch = tree.branches[branchId];
  if (!branch) {
    throw new Error(`Branch not found: ${branchId}`);
  }

  return {
    ...tree,
    activeBranchId: branchId,
  };
}

/**
 * Get all nodes on a given branch, in order from root to head.
 */
export function getBranchNodes(
  tree: ZygoteTree,
  branchId: BranchId
): ZygoteNode[] {
  const branch = tree.branches[branchId];
  // the only triggering part is the two case below:
  // a. a brand-new tree thus no node yet.
  // b. a branch that the last node has been deleted.
  if (!branch || !branch.headNodeId) {
    return [];
  }

  const nodes: ZygoteNode[] = [];
  let currentId: NodeId | null = branch.headNodeId;
  // C (head) unshift(C) -> [C]
  // B unshift(B) -> [B, C]
  // A unshift(A) -> [A, B, C]
  // Then return [A, B, C] — the full lineage from root to head. 
  while (currentId !== null) {
    const node: ZygoteNode | undefined = tree.nodes[currentId];
    if (!node) break;
    nodes.unshift(node);
    currentId = node.parentId;
  }

  return nodes;
}

/**
 * Get the children of a given node.
 */
export function getNodeChildren(
  tree: ZygoteTree,
  nodeId: NodeId
): ZygoteNode[] {
  return Object.values(tree.nodes).filter((n) => n.parentId === nodeId);
}
