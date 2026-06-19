# Zygote v0.1 — Product Specification

> A VS Code extension that replaces the chat-based conversation with AI agents with a structured, forkable, file-state-aware working surface.

**Status**: Pre-implementation specification
**Author**: Fergie
**Last updated**: 2026-05-15
**Target implementation start**: 2026-05-W3

---

## Table of Contents

1. [What is Zygote](#1-what-is-zygote)
2. [The Problem](#2-the-problem)
3. [The Insight](#3-the-insight)
4. [Information Architecture](#4-information-architecture)
5. [Core Interaction Model](#5-core-interaction-model)
6. [v0.1 Scope](#6-v01-scope)
7. [Technical Architecture](#7-technical-architecture)
8. [Competitive Differentiation](#8-competitive-differentiation)
9. [Roadmap](#9-roadmap)
10. [Open Questions](#10-open-questions)
11. [Appendix: Demo Scenario](#11-appendix-demo-scenario)

---

## 1. What is Zygote

Zygote is a VS Code extension that changes the unit of human-AI collaboration from "a conversation" to "a node in an evolving tree."

When you work with an AI coding agent today—through Claude Code, Cursor, Copilot Chat, or similar tools—the interface is a linear stream of messages. The agent reads a file, proposes a plan, writes code, runs tests, fixes errors, and at the end you have a working feature and a long scroll of chat history. The history is read-only, append-only, and structurally flat. You cannot fork it. You cannot ask "what if we had taken a different approach at step 7?" You cannot see, at a glance, where you currently are in the larger task. And when the conversation grows long enough that the model's attention starts to degrade, your only option is to start a new chat and lose all accumulated context.

Zygote argues that the conversation is the wrong abstraction. The right abstraction is a tree of work units, where each unit is a discrete decision or action with persistent state, every branch represents an alternative approach that was actually attempted (not just discussed), and the file system itself is versioned alongside the thinking that produced it. Conversation still exists in Zygote, but it is demoted from the primary interface to a tool inside each node—a way of exploring before committing.

The name "zygote" comes from embryology: a zygote is the single, undifferentiated cell that contains, in potential, every future cell of the organism. It is the moment before specialization, when all paths are still possible. The metaphor describes both the product (a tree that grows by differentiation from a single root task) and the design philosophy (start from the smallest possible structural commitment and let work develop by branching, not by extending a flat stream).

---

## 2. The Problem

Three observable failure modes occur during sustained AI-assisted coding sessions. They are not separate problems; they share a single root cause.

### 2.1 Hierarchical Disorientation

You begin a session with a high-level goal: refactor the authentication module. The agent decomposes this into sub-tasks: read the existing code, propose approaches, apply the chosen approach, run tests. Within "apply the chosen approach," you discover an unrelated bug and ask the agent to fix it. Within fixing the bug, you discuss a library choice. Within the library choice, you read documentation together. Forty minutes later you are tuning a parameter in a helper function and you have lost track of why you started tuning anything at all. The original goal is buried under seven levels of context, all visually identical in the chat scroll.

The work has a tree structure, but the interface presents it as a line. Humans cannot easily reconstruct a tree from a line; reconstruction requires re-reading and remembering, which is exactly the cognitive load the AI was supposed to remove.

### 2.2 Context Window Decay

Language models have finite context windows. As a conversation grows, two failure modes appear: the model begins to forget early decisions (the agreed-upon coding style, the architectural commitment made at message twelve, the rejected approach you do not want to revisit), and the cost of every subsequent turn grows linearly with history. The conversation eventually becomes both expensive and unreliable.

The standard mitigation is to "start a new chat"—but a new chat is a hard reset. Every implicit agreement, every clarification, every false start that taught you something useful, is gone. The user is forced to choose between two bad options: continue in a slow, forgetful conversation, or restart and pay the cost of re-establishing context manually.

### 2.3 Loss of Branching Memory

Real engineering work is exploratory. You try approach A, see it does not work, try approach B, decide B is acceptable, and ship B. In a chat-based interface, approach A is recorded as a sequence of messages and then implicitly abandoned when you ask the agent to try approach B. The file system reflects B; the chat history is dominated by B. Approach A exists somewhere in the scrollback but is not retrievable as a coherent unit—you cannot return to it, you cannot compare its result to B's result, you cannot fork off it to try approach C.

In effect, the chat interface forgets the structure of your exploration. Only the winning path is preserved with any clarity. This is the opposite of how engineering knowledge should accumulate: failed approaches are often more informative than successful ones, but the medium discards them.

### 2.4 The Common Root

All three failures share the same cause: **the conversation is treated as the unit of work**. Conversations are linear, append-only, and flat. Real engineering work is hierarchical, exploratory, and stateful. The mismatch produces the symptoms above.

Existing tools attempt to patch the symptoms—Claude Code adds `--fork-session` and file checkpoints, Cursor adds rewind, observability tools add visualization—but the underlying interface remains a chat. The patches are valuable but they do not address the structural mismatch.

---

## 3. The Insight

Zygote's core claim is that the conversation should not be the primary interface. The primary interface should be a **tree of work nodes**, where each node represents a discrete unit of committed work, and conversation is repositioned as an internal tool inside each node.

### 3.1 The Node as the Unit of Work

A node in Zygote is not a message. A node is a *commitment*: a decision to do a specific piece of work, with explicit inputs, an executed action, recorded outputs, and a snapshot of the file system after the action completes. Nodes are durable, addressable by ID, and connected to their ancestors and descendants by parent-child relationships.

Nodes are created intentionally. The user does not type a message and have it automatically become a node; the user defines a piece of work, optionally discusses it with the agent inside the node, and then commits the node for execution. Once executed, the node is immutable: its inputs, outputs, and file snapshot become part of the project's permanent history.

This intentionality is the entire point. By forcing the user to define a node before work happens, Zygote makes the structure of work visible to the user *while it is being created*, not as an afterthought. The user always knows what node they are working in, because they created it.

### 3.2 Branches as First-Class Exploration

When a user wants to try a different approach, they fork a node. Forking creates a new branch starting from that node's state—including the file system state at that point. The original branch is preserved; the new branch evolves independently. Both branches remain navigable, comparable, and resumable.

This makes exploration concrete rather than ephemeral. "Let me try the middleware approach instead" stops being a phrase that overwrites your previous attempt and becomes an act of creating a new branch where the middleware approach is actually implemented, in parallel to the original.

### 3.3 Conversation as an In-Node Tool

Conversation does not disappear. Inside each node, before it is committed, the user can chat freely with the agent—clarifying intent, requesting alternatives, debating tradeoffs. This conversation is the *exploration* phase of the node. When the user is satisfied, they commit the node, and the conversation is preserved as part of the node's permanent record. The commit is the moment of transition from "still deciding" to "decided."

Separately, for queries that have nothing to do with the current project—"what does the `satisfies` keyword do in TypeScript?"—Zygote provides a Floating Chat: a transient conversation that is explicitly not persisted, not attached to any node, and discarded when closed. This honors the legitimate need for ephemeral AI interaction without polluting the project's tree.

### 3.4 File State as Part of the Tree

Each committed node stores a snapshot of the workspace files that the node touched. Forking a node restores the workspace to the state at that node, then begins the new branch from that point. This makes the tree not just a record of conversations and decisions, but a record of *the project's evolution as a physical artifact*. Two branches of the tree correspond to two real, complete, comparable states of the codebase—not two descriptions of what the codebase might have been.

This is the property that distinguishes Zygote from every existing agent observability tool. Existing tools record what the agent *did*; Zygote records the file system *as it evolved through the agent's thinking*, and lets the user navigate that evolution as freely as they navigate git history.

---

## 4. Information Architecture

Zygote organizes work in a four-level hierarchy:

```
Project        (one VS Code workspace = one project)
└── Branch     (a coherent line of work; one branch is "active" at any time)
    └── Node   (a discrete, committed unit of work)
        └── Chat (the exploration that happened inside the node before commit)
```

**Project** corresponds to a VS Code workspace. All of Zygote's state for a project lives in a `.zygote/` folder at the workspace root, analogous to `.git/`. A project contains one or more branches and a single tree of nodes.

**Branch** is a named line of work. The first branch is always called `main` and is created automatically. Forking a node creates a new branch with a user-supplied name (e.g., "try-middleware-approach"). Only one branch is "active" at a time; the active branch is what new nodes are appended to. Switching the active branch restores the workspace files to that branch's current state.

**Node** is the atomic unit of work. A node has:
- A unique ID
- A reference to its parent node and the branch it belongs to
- An *input*: the prompt or instruction that initiated this node
- An optional *internal chat*: the conversation that happened inside the node before preview
- An *output*: what the agent produced (text response, tool calls, file edits)
- A *workspace snapshot*: content hashes of files modified by this node
- A *status*: draft, previewing, preview-complete, or committed

**Chat** is the conversation inside a single node, before preview. It is not a top-level entity in the data model—it is a list of messages stored as part of the node. Once preview begins, the chat becomes read-only and is preserved as historical record.

**Floating Chat** is intentionally outside this hierarchy. It is a separate ephemeral conversation, not stored in `.zygote/`, not represented as any node, and discarded when closed. It exists only at the UI level.

---

## 5. Core Interaction Model

### 5.1 Three Modes of AI Interaction

Zygote distinguishes three categories of user-AI interaction. Each has its own UI entry point, its own persistence behavior, and its own role in the project's history.

**New Task** — The user wants to begin a new unit of work, either at the root of the tree or as a child of an existing node. The user clicks "+ New Task" (at root level) or "+ Sub-task" (on an existing node). A new draft node is created and the user enters its prompt.

**Node Chat** — The user has a draft node selected and wants to refine the plan before execution. They type in the node's chat panel; the agent responds; the conversation iterates until the user commits the node. All of this is preserved as part of the node's permanent record once committed.

**Floating Chat** — The user has a question unrelated to the current project, or wants to think through something without affecting the tree. They open the floating chat via a button in the top-right of the Zygote pane. The conversation is not persisted and disappears when closed.

A summary table:

| Interaction | Entry point | Creates a node? | Persists? |
|---|---|---|---|
| New Task | "+ New Task" button | Yes | Yes |
| Node Chat | Selected draft node's chat panel | No (lives inside an existing node) | Yes (as part of the node) |
| Floating Chat | Top-right "Quick Ask" icon | No | No |

### 5.2 The Node Lifecycle

A node passes through four states:

**Draft** — The node exists but has not been executed. The user can edit its prompt, conduct internal chat with the agent, refine the plan, and delete the node entirely. No file system changes have occurred. Draft nodes are visually distinct in the tree (e.g., dashed border, lighter color).

**Previewing** — The user has clicked "Preview." The agent is now executing the node: reading files, calling tools, writing code. Before execution begins, a pre-preview snapshot of all workspace files is captured. The node's internal chat is now read-only; the agent's actions stream into the node's output. Real file edits occur in the workspace.

**Preview-complete** — The agent has finished executing, and the user can now evaluate the result: the proposed file changes, agent response, and tool calls are all visible. The user has two choices. They can **accept** the preview, which commits the node—locking its input, chat, output, and workspace snapshot into permanent history. Or they can **reject** the preview, which discards the agent's output, restores workspace files from the pre-preview snapshot, and returns the node to draft state so the user can revise the prompt and try again.

**Committed** — The preview has been accepted. The node's input, internal chat, output, and workspace snapshot are now immutable. The node can be forked, inspected, or used as the basis for new child nodes, but its own content cannot be edited.

The key design principle is that a commitment should be made with full information about both the prompt *and* the output, not just the prompt. The old model asked the user to commit before seeing results; the new model lets the user see exactly what the agent produced and then decide whether to make it permanent. The "Preview" button initiates execution; the "Accept" button is the true commitment. Accept is intentionally prominent and slightly heavy: it should feel like a decision, because it is one.

Only one preview at a time is supported per node in v0.1. If the user wants to compare multiple alternative approaches, they should use fork, which creates a permanent branch. Rejected previews are discarded entirely—no preview history is preserved. (This may change in v0.2.)

### 5.3 Fork Semantics

Forking a committed node N produces:

1. A new branch with a user-supplied name (default: `<original-branch>-fork-<timestamp>`)
2. The new branch's head is positioned at N's parent (the new branch will append work after N's parent, not after N itself)
3. The workspace files are restored to N's parent's snapshot (i.e., the state *before* N was executed)
4. The active branch is switched to the new branch
5. An empty draft node is created, ready for the user to write a new prompt

**Important**: forking does not copy N's chat or output into the new branch. The fork represents "let me try something different starting from this point in history," not "let me clone this and modify it." If the user wants to continue N's thinking with a variation, they can read N's chat (still visible in the original branch) and reference it in the new node's prompt.

Switching branches without forking is also supported: the user can navigate to any branch, and the workspace files are restored to that branch's current head. This makes Zygote behave like a git checkout on the agent's working state.

Preview-reject and fork serve overlapping but distinct purposes. Preview-reject is *iteration within a single node*: the user refines a prompt, previews the result, decides it is not right, and tries again—all within the same node, on the same branch. Fork is *exploration across permanent branches*: the user wants to try a fundamentally different approach and preserve both alternatives for comparison. Preview-reject is lightweight and ephemeral; fork is structural and permanent. A typical workflow might involve several preview-reject cycles to get a single node right, then a fork later to try an entirely different strategy.

### 5.4 The Right Pane Layout

The Zygote webview occupies the right pane of VS Code and contains four regions, stacked vertically:

```
┌──────────────────────────────────────────────────┐
│ HEADER                                            │
│ Branch: main    [⎇ Switch]    [💬 Quick Ask]      │
├──────────────────────────────────────────────────┤
│ TREE                                              │
│ ● Refactor auth.py                                │
│   ├─ ● Read auth.py                               │
│   ├─ ● Plan: 3 approaches                         │
│   └─ ◐ [draft] Apply approach #2                  │
├──────────────────────────────────────────────────┤
│ DETAIL (draft state)                              │
│ Selected: "Apply approach #2"                     │
│                                                   │
│ Prompt: Apply the middleware-based approach       │
│ from the plan.                                    │
│                                                   │
│ Chat:                                             │
│   You: What about the legacy callback handlers?  │
│   AI:  Three options: ...                         │
│   [type to continue...]                           │
│                                                   │
│ [ Preview ▶ ]    [ Delete ]                        │
├──────────────────────────────────────────────────┤
```

When a node enters preview-complete, the detail region changes:

```text
├──────────────────────────────────────────────────┤
│ DETAIL (preview-complete state)                   │
│ Selected: "Apply approach #2"                     │
│                                                   │
│ Prompt: Apply the middleware-based approach       │
│ from the plan.                                    │
│                                                   │
│ Agent output:                                     │
│   Read auth.py → wrote auth.py (middleware added) │
│   "I've added a middleware layer that..."         │
│                                                   │
│ [ ✓ Accept ]    [ ✗ Reject ]                      │
├──────────────────────────────────────────────────┤
│ FOOTER                                            │
│ [+ New Task at root]                              │
└──────────────────────────────────────────────────┘
```

The detail region adapts based on what is selected. For a draft node, it shows the editable prompt, the chat, and the Preview button. For a preview-complete node, it shows the agent's output with Accept and Reject buttons. For a committed node, it shows the immutable record: prompt, full chat, output (including any tool calls and file edits), and Fork/Inspect buttons.

---

## 6. v0.1 Scope

The purpose of v0.1 is to prove that the interaction model works—that a person can sit down at VS Code, use Zygote instead of a chat-based interface, and feel that something fundamental about working with an AI has changed. v0.1 is not a complete product. It is the smallest possible artifact that embodies the idea.

### 6.1 In Scope for v0.1

**Tree visualization** — A tree of nodes rendered in the Zygote webview, with parent-child relationships visible. Nodes show their status (draft, previewing, preview-complete, committed) and their title/prompt.

**Node creation** — Users can create new root-level tasks and sub-tasks under any existing committed node. (Draft and preview-complete nodes are not valid parents because their state is not yet final.)

**Node chat** — Each draft node has an internal chat panel where the user and agent can converse before preview.

**Preview & Commit** — Previewing a node captures a pre-preview snapshot of workspace files, then sends the node's prompt and internal chat as context to the Claude API. The agent's response streams into the node's output. If the agent requests tool use (reading or writing files), the tool calls are executed against the workspace and their results are recorded in the node. When the agent finishes, the node enters preview-complete state. The user can accept (committing the node into permanent history) or reject (discarding the output and restoring files from the pre-preview snapshot). Only one preview at a time per node; rejected previews are discarded with no history preserved.

**Fork** — Users can fork any committed node. A new branch is created and the workspace is restored to the pre-node state.

**Branch switching** — Users can switch between branches via a dropdown or list. Switching restores the workspace to the target branch's current state.

**File snapshots** — Each committed node stores content hashes of files it modified. The `.zygote/` folder contains a content-addressable store of file versions. Fork and branch-switch operations restore files from this store.

**Floating Chat** — A button in the top-right opens a panel for a non-persisted, non-tree-attached conversation with the agent. Closing the panel discards the conversation.

**Persistence** — All tree state is stored in `.zygote/tree.json` and `.zygote/snapshots/`. Closing and reopening VS Code restores the full project state.

### 6.2 Explicitly Out of Scope for v0.1

**Merge** — Combining work from two branches back into one. This is a hard problem and is deferred to a later version.

**Polished UI** — v0.1 may look unrefined. Functionality over aesthetics.

**Multi-user collaboration** — Single user, single machine.

**Complex tool use** — v0.1 supports reading files and writing files. It does not support running shell commands, executing tests, or invoking arbitrary tools. (This is a deliberate constraint to keep v0.1 implementable in 4-5 weeks.)

**Cost tracking, token analytics, telemetry** — Deferred.

**Agent autonomy improvements** — Zygote v0.1 is not about making the agent smarter. It is about making the agent's work *legible to the human*. The underlying agent is just Claude with basic tool use.

**Multi-file workspaces with thousands of files** — v0.1 is built for small-to-medium projects. Performance optimization for large workspaces is deferred.

**Settings and configuration UI** — One hard-coded model (Claude Sonnet 4.6 or whatever is current at implementation time), API key read from environment variable or VS Code secret storage.

**Multiple simultaneous previews per node** — v0.1 supports only one preview at a time. The user must accept or reject the current preview before starting another.

**Rejected preview history** — When a preview is rejected, it is discarded entirely. No record of rejected previews is kept. (Future versions may preserve rejected previews for comparison.)

### 6.3 Success Criteria for v0.1

v0.1 is successful when the author can:

1. Use Zygote (not Claude Code, not Cursor) for a real coding task lasting at least one hour, without falling back to chat-based tools out of frustration.
2. Fork a node, work on the new branch, switch back to the original branch, and have the workspace files correctly reflect each branch's state.
3. Close VS Code, reopen it the next day, and resume work on the existing tree without any data loss.
4. Record a two-minute screencast that demonstrates the core loop (create node → chat to refine → preview → accept/reject → fork → compare) in a way that a stranger watching it can understand the product.

The fourth criterion is the most important. If the screencast cannot be made because the product does not demo well, v0.1 has failed regardless of whether the code works.

---

## 7. Technical Architecture

### 7.1 System Overview

Zygote is a VS Code extension. It consists of three runtime components that communicate via well-defined channels:

```
┌─────────────────────────────────────────────────────────────┐
│ VS Code Window                                               │
│                                                              │
│  ┌──────────────────────┐    ┌──────────────────────────┐   │
│  │ Editor (left)         │    │ Zygote Webview (right)    │   │
│  │ - User's source code  │    │ - React + React Flow      │   │
│  │ - File tree           │    │ - Tree, detail, chat UI   │   │
│  │ - Modified by Zygote  │    │ - Sends user actions      │   │
│  │   when nodes execute  │    │ - Renders extension state │   │
│  └──────────────────────┘    └────────────┬─────────────┘   │
│           ▲                                │                 │
│           │ vscode.workspace.applyEdit     │ postMessage     │
│           │ vscode.workspace.fs.writeFile  │                 │
│           │                                ▼                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Extension Host (Node.js process)                      │   │
│  │ - Owns the source of truth for tree state             │   │
│  │ - Persists state to .zygote/                          │   │
│  │ - Calls Claude API on commit                          │   │
│  │ - Executes tool calls (read/write files)              │   │
│  │ - Manages file snapshots                              │   │
│  │ - Streams agent output back to webview                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

The extension host is the source of truth. The webview is a view layer; it never holds authoritative state. This ensures that closing the webview, switching VS Code windows, or restarting does not lose data.

### 7.2 Data Model

The data model is defined in TypeScript. The full type signatures:

```typescript
type NodeId = string;     // UUID
type BranchId = string;   // UUID
type FileHash = string;   // SHA-256 hex digest

type NodeStatus = 'draft' | 'previewing' | 'preview-complete' | 'committed' | 'error';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ToolCall {
  tool: 'read_file' | 'write_file';
  input: { path: string; content?: string };
  result: { ok: boolean; data?: string; error?: string };
}

interface ZygoteNode {
  id: NodeId;
  parentId: NodeId | null;        // null only for the root node of a branch
  branchId: BranchId;
  createdAt: number;

  // Input
  title: string;                  // user-facing short label
  prompt: string;                 // the actual instruction

  // Internal chat (exploration before commit)
  chat: ChatMessage[];

  // Output (populated after commit)
  status: NodeStatus;
  agentResponse?: string;
  toolCalls?: ToolCall[];
  error?: string;

  // File state after this node executed
  workspaceSnapshot?: {
    fileHashes: Record<string, FileHash>;   // filepath → content hash
  };

  // Token / cost tracking (optional, for future)
  tokens?: { input: number; output: number };
}

interface ZygoteBranch {
  id: BranchId;
  name: string;
  headNodeId: NodeId | null;       // null for an empty branch
  parentBranchId?: BranchId;       // which branch this was forked from
  forkedAtNodeId?: NodeId;         // which node was forked from
  createdAt: number;
}

interface ZygoteTree {
  workspaceRoot: string;
  rootNodeIds: NodeId[];           // top-level tasks (multiple roots allowed)
  nodes: Record<NodeId, ZygoteNode>;
  branches: Record<BranchId, ZygoteBranch>;
  activeBranchId: BranchId;
}
```

**Design notes:**

Nodes are stored flat in a `Record<NodeId, ZygoteNode>`, not nested. The tree structure is reconstructed by following `parentId` references. This makes fork O(1)—a fork is just a new branch entry, no copying of node data.

Branches are explicit first-class entities, not implicit views over nodes. This mirrors git's design (commits have parents, branches are named refs). Without explicit branches, operations like "switch to branch X" or "list all branches" would require expensive graph traversals.

Workspace snapshots use content-addressable storage. The `.zygote/snapshots/<hash>` file contains the raw content; nodes reference content by hash. Two nodes that don't modify a file share the same hash for that file, so storage cost scales with *unique* content, not with tree depth.

### 7.3 Persistence Layout

```
<workspace_root>/
├── .zygote/
│   ├── tree.json              # the full ZygoteTree object, serialized
│   ├── snapshots/             # content-addressable file storage
│   │   ├── <hash1>            # raw file content
│   │   ├── <hash2>
│   │   └── ...
│   └── config.json            # extension config (model, etc.)
├── .gitignore                 # users should add .zygote/snapshots/ to gitignore
└── <user's actual project files>
```

The `tree.json` file is human-readable, intentionally. This makes the tree inspectable, debuggable, and git-friendly: users can commit `.zygote/tree.json` to track the evolution of their agent-assisted work over time, while ignoring the snapshot blobs.

### 7.4 Agent Runtime

The extension host runs the agent loop on preview. The loop is intentionally simple in v0.1:

```
On preview of node N:
  0. Initialize an empty pre-preview snapshot for N
  1. Set N.status = 'previewing'
  2. Gather context:
     - All ancestor nodes (root → N's parent) → flatten their prompts and outputs
     - N's own prompt
     - N's internal chat history
  3. Send to Claude API with tool definitions (read_file, write_file)
  4. Receive response (may contain text and/or tool_use blocks)
  5. For each tool_use:
     - If write_file and the target file has not yet been snapshotted in this preview session, capture its current content into the pre-preview snapshot
     - Execute the tool against the workspace via vscode.workspace.fs
     - Append a ToolCall record to N
     - If write_file, capture the new content hash into N's snapshot
     - Send tool_result back to Claude and continue the loop
  6. When Claude returns a text-only response (no tools), capture as agentResponse
  7. Finalize N.workspaceSnapshot from the hashes captured during step 5 (no additional file reads needed)
  8. Set N.status = 'preview-complete', persist tree.json
  9. Await user decision:
     - Accept → set N.status = 'committed', finalize snapshot as permanent record
     - Reject → discard N's agentResponse, toolCalls, and workspaceSnapshot; restore files from pre-preview snapshot; preserve N's prompt and chat; set N.status = 'draft'
```

This loop is single-turn-per-preview for v0.1. The agent gets one shot to read/write files and produce a final answer. v0.2 will allow multi-turn agent loops within a single node, where the agent can iterate (read → write → test → fix) without re-committing.

### 7.5 Webview ↔ Extension Host Protocol

Communication uses VS Code's standard `webview.postMessage` / `onDidReceiveMessage`. Messages are JSON-serializable objects with a `type` field.

**Messages from Webview to Extension Host:**

| Type | Payload | Meaning |
|---|---|---|
| `createNode` | `{ parentId, prompt }` | Create a new draft node |
| `updateNodePrompt` | `{ nodeId, prompt }` | Edit a draft node's prompt |
| `appendChatMessage` | `{ nodeId, role, content }` | Append a message to a node's internal chat |
| `requestChatResponse` | `{ nodeId }` | Ask the agent to respond to the current chat (no commit yet) |
| `previewNode` | `{ nodeId }` | Begin preview execution of a draft node |
| `acceptPreview` | `{ nodeId }` | Accept the preview, committing the node into permanent history |
| `rejectPreview` | `{ nodeId }` | Reject the preview, restore files from pre-preview snapshot, return node to draft |
| `forkNode` | `{ nodeId, newBranchName }` | Fork a committed node |
| `switchBranch` | `{ branchId }` | Switch the active branch |
| `deleteNode` | `{ nodeId }` | Delete a draft node |
| `quickAsk` | `{ prompt }` | Floating chat: send prompt, get response (not stored) |

**Messages from Extension Host to Webview:**

| Type | Payload | Meaning |
|---|---|---|
| `treeUpdated` | `{ tree: ZygoteTree }` | Full tree state has changed; re-render |
| `nodeStatusChanged` | `{ nodeId, status }` | A node's status changed (e.g., previewing → preview-complete) |
| `nodeOutputStream` | `{ nodeId, delta }` | Streaming output from the agent |
| `error` | `{ message, nodeId? }` | Something went wrong |
| `quickAskResponse` | `{ response }` | Floating chat reply |

This protocol is intentionally chatty. The webview asks for everything; the extension host pushes updates. The webview never modifies state directly.

### 7.6 File System Interaction

When the agent executes a `write_file` tool call, the extension uses `vscode.workspace.fs.writeFile` to write the file. VS Code automatically detects the change and updates any open editors, so the user sees their code change in real time in the left pane.

When a fork or branch switch restores a file from a snapshot, the same API is used. If the user has the file open with unsaved modifications, VS Code's normal "file has been modified externally" prompt appears. v0.1 does not attempt to handle this gracefully—the assumption is that the user is using Zygote as the primary editing surface and does not have conflicting manual edits.

### 7.7 Project Structure

The implementation will be organized as:

```
zygote/
├── package.json                # VS Code extension manifest + npm deps
├── tsconfig.json
├── README.md
├── SPEC.md                     # this document
├── src/
│   ├── extension.ts            # entry point: activate(), command registration
│   ├── webview/
│   │   ├── ZygotePanel.ts      # webview lifecycle, message routing
│   │   └── html.ts             # initial HTML scaffold
│   ├── state/
│   │   ├── tree.ts             # ZygoteTree operations (create, fork, etc.)
│   │   ├── persistence.ts      # load/save tree.json
│   │   └── snapshots.ts        # content-addressable file storage
│   ├── agent/
│   │   ├── claude.ts           # Anthropic API client
│   │   ├── tools.ts            # tool definitions and executors
│   │   └── runner.ts           # the commit-and-execute loop
│   └── shared/
│       └── types.ts            # types shared between extension and webview
├── webview-ui/                  # the React app that runs inside the webview
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Tree.tsx
│   │   │   ├── NodeDetail.tsx
│   │   │   ├── NodeChat.tsx
│   │   │   ├── FloatingChat.tsx
│   │   │   └── BranchSelector.tsx
│   │   └── vscode-api.ts       # wrapper around acquireVsCodeApi()
│   └── vite.config.ts          # builds to dist/webview/
└── dist/                        # build output
```

The webview UI is a separate Vite-built React app whose output is loaded into the webview. This separation lets the React app be developed and previewed independently (with mocked data) before integration.

---

## 8. Competitive Differentiation

The agent observability and orchestration space is increasingly crowded. As of mid-2026 the relevant landscape includes:

- **Claude Code** (Anthropic, first-party) — Has `--fork-session`, file checkpoints, rewind. CLI-based. Conversation-first interface.
- **Agent Flow** (patoles/agent-flow, open source) — Visualizes Claude Code execution as a node graph in a browser. Read-only observer; does not let the user drive work from the visualization.
- **Agent View** (Anthropic, May 2026) — Terminal dashboard for managing multiple parallel Claude Code sessions. Session-level, not node-level.
- **Agent Trace Ops** — Trace analysis and decision tree visualization, focused on cost and performance debugging.
- **LangGraph Studio** — Visual builder for developer-defined agent workflows. The graph is pre-defined in code, not dynamically created by the agent.
- **Cursor / Windsurf** — Chat-based agent UIs with checkpoint and rewind features.

Zygote's positioning relative to these is captured by three claims:

**Claim 1: Zygote is a working surface, not an observability tool.**

Every product listed above is something a developer looks at while or after their agent is doing work. The agent's primary interface is still elsewhere (the Claude Code CLI, the Cursor chat, etc.). Zygote is where the developer initiates and drives work; the tree is not a visualization of work happening somewhere else, it is *the place where work happens*.

**Claim 2: Zygote's atomic unit is the node, not the conversation.**

In every other tool, the unit is the message (in chat-based products) or the tool call (in observability products). Zygote's commitment-based node is a different concept: it is a user-defined unit of intent that exists *before* execution and contains exploration, decision, and outcome as a single durable artifact.

**Claim 3: Zygote treats file state as part of the tree.**

The fork semantics—where forking a node restores the workspace files to that node's pre-state—exist in no other tool. Claude Code's checkpoints can restore files, but they are tied to individual file edits, not to the conceptual structure of the agent's work. Zygote unifies the agent's reasoning history and the file system's evolution into a single navigable structure.

These three claims define Zygote's defensible space. Anthropic could add tree visualization to Agent View tomorrow and Zygote would still be different, because Anthropic is unlikely to redefine the conversation as a secondary interface—that would break compatibility with millions of existing users. Zygote is free to make that break because it has no installed base.

---

## 9. Roadmap

### v0.1 — The Spike (4-5 weeks of focused work)

The minimum demonstration that the model works. Single user, single workspace, basic tool use (read/write files), persistent tree, working fork. Detailed scope in Section 6.

Deliverable: A `.vsix` file that can be installed in any VS Code, a README with setup instructions, and a 2-minute screencast.

### v0.2 — Multi-turn Agent Loops

Within a single node, allow the agent to iterate: read a file, write a file, run a check, see the result, fix an error. Currently v0.1 limits each commit to one round of tool calls; v0.2 makes a single node potentially many internal turns.

This is also where shell command execution is added, with appropriate safety prompts.

### v0.3 — Branch Comparison and Diff

The "two branches at once" experience: a UI that lets the user view two branches side by side and see the differences in file state and in agent reasoning. This is where Zygote's "fork to explore alternatives" use case becomes truly powerful, because alternatives become comparable.

### v0.4 — Merge

The hard problem. Allow the user to take results from one branch and apply them to another. The interesting question is whether merging is a manual operation (the user picks which files to take from each branch) or an AI-assisted one (the agent reads both branches and proposes a merge). v0.4 will explore both.

### v0.5 — Multi-agent and Sub-agents

A node can spawn child nodes that run in parallel with their own contexts—the equivalent of git submodules for agent work, or of Claude's sub-agent feature. The tree gains genuine concurrency.

### Beyond v0.5

Speculation, not commitment: web version (collaborative tree editing across users), integration with other agent frameworks (not just Claude), an "agent reasoning replay" mode where you can scrub through a node's chat as it happened.

---

## 10. Open Questions

These are decisions deferred to implementation. Listed here so they are not forgotten.

**Q1: How is the Claude API key managed?**

Likely via VS Code's secret storage API, with a one-time setup command. An environment variable fallback for development. Open question: what is the failure mode when no key is set? Likely a clear in-webview prompt with a link to instructions.

**Q2: What happens when the agent's tool call would modify a file outside the workspace?**

Block it. The agent's tool definitions will be constrained to paths within the workspace root.

**Q3: How are draft nodes preserved across VS Code restarts?**

They are persisted to `tree.json` like any other node. On restart, they appear in their draft state and can be resumed or deleted. Open question: should they auto-expire after some time? v0.1 says no.

**Q4: How big can the tree get before performance degrades?**

Unknown. Initial guess: low hundreds of nodes is fine, low thousands is the edge. Performance optimization is deferred until it becomes a real problem.

**Q5: What happens to snapshot blobs when a branch is deleted?**

For v0.1, branches cannot be deleted; this question is deferred. When v0.x adds branch deletion, a garbage collection pass will be needed.

**Q6: How does the user know what files a draft node will touch?**

They do not, until execution. The agent decides. An interesting future direction: ask the agent to declare its file-touch intentions before committing, so the user can review.

**Q7: Should the floating chat have any memory across opens?**

For v0.1, no. Open and close is a hard reset. This might change if users find it too disruptive.

**Q8: How does Zygote interact with the user's git?**

It does not, in v0.1. The user is responsible for their own git commits. Zygote modifies files; the user commits them when they choose. Future versions might offer automatic git commits keyed to Zygote node commits, but this couples two version control systems in ways that need careful design.

**Q9: What is the UI for "this node's execution failed"?**

The node enters the `error` state, the error message is displayed in the detail pane, and the user can either delete the node or edit its prompt and re-preview. The workspace is *not* automatically rolled back on error—the user can fork from the parent if they want a clean slate.

**Q10: Is Zygote's tree always a tree, or can it be a DAG?**

A tree. Multiple parents would make the data model significantly more complex and the UI much harder to understand. If something like "this node depends on results from two earlier nodes" is needed, it is handled at the prompt level (the user includes the references in the prompt text), not at the structural level.

---

## 11. Appendix: Demo Scenario

This is the scenario the v0.1 screencast will demonstrate. Writing it out here forces every feature in v0.1 to justify its existence by appearing in the demo.

**Setup**: A small Python project with an `auth.py` file containing a basic authentication function. The user wants to refactor it to support JWT tokens.

**Scene 1 (0:00-0:20): The problem**

Brief voiceover over a generic chat-based agent interface. "Working with AI on real code, I keep losing track of where I am. I want to try alternatives but I can't fork. I open a new chat and lose everything." Quick cuts illustrating the pain.

**Scene 2 (0:20-0:35): Zygote opens**

VS Code opens with `auth.py` visible on the left. The Zygote panel opens on the right, empty. The user clicks "+ New Task" and types: "Refactor auth.py to support JWT tokens." A new draft node appears in the tree.

**Scene 3 (0:35-1:15): Preview, reject, iterate, accept**

The user opens the node's chat. They type: "What approaches should I consider?" The agent responds with three options: rewrite from scratch, add a middleware layer, use a decorator pattern. The user types: "Let's go with the middleware approach. Keep the existing function signatures intact." The agent confirms.

The user clicks **Preview**. The node's status changes to previewing. The right pane streams output: the agent reads `auth.py`, then writes a new version. The left pane updates—the user can see `auth.py` change in real time. The node enters preview-complete.

The user inspects the result. The middleware implementation works, but the agent broke backward compatibility with the existing `authenticate()` function signature—callers in `main.py` would break. The user clicks **Reject**. The workspace files snap back to their original state; the node returns to draft.

The user edits the prompt, adding: "Important: preserve the existing authenticate() function signature. Add the middleware layer alongside it, not as a replacement." They click **Preview** again. This time the agent produces a clean implementation that wraps the existing function without changing its signature. The user clicks **Accept**. The node's status becomes committed.

**Scene 4 (1:15-1:35): The fork**

Voiceover: "But wait—what if the decorator approach is actually cleaner?" The user right-clicks the committed node and selects **Fork**. They name the new branch "try-decorator." The workspace file `auth.py` snaps back to its original state—visibly, in the editor, the user can see the code revert.

The user types in the new draft node: "Apply the decorator approach instead." They preview, inspect the result, and accept. The agent rewrites `auth.py` using decorators.

**Scene 5 (1:35-1:50): Compare**

The user switches branches via the branch dropdown. `auth.py` snaps between the two implementations. Each branch's tree is visible in the panel. The user comments: "Two real implementations, side by side. I can keep whichever I like."

**Scene 6 (1:50-2:00): The pitch**

Voiceover over the full tree, now containing both branches: "Your conversation with AI shouldn't be a stream you scroll through. It should be a structure you build. This is Zygote."

End card: GitHub URL, blog URL.

---

## Closing Note

This specification represents approximately fifteen rounds of structured thinking with Claude over two days. It is intentionally more detailed than necessary for implementation, because its second purpose—after guiding development—is to serve as a portfolio artifact and a foundation for future blog posts.

The author commits to revisiting this document weekly during implementation and recording any deviations as they occur. Specifications are hypotheses; implementation tests them. The document at the end of v0.1 will look different from the one at the beginning, and that is the entire point.
