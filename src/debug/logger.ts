// Zygote's internal debugging tool, it is for the developer
// Event logging (info, warn, error) — writes timestamped log entries to .debug/session.jsonl
//  so you can trace what happened during a session (auto-rotates at 2MB)

// Snapshot (captureSnapshot) — dumps the entire Zygote tree state to .debug/snapshot.json — how many nodes, 
// branches, which nodes errored, token usage. Quick diagnostic freeze-frame.

// Tree dump (dumpTree) — writes a human-readable markdown file (.debug/tree-dump.md) showing the full tree hierarchy: 
// every branch, node, prompt, chat history, tool calls, agent responses, and the context chain sent to the agent. 
// This is the big one — it lets you see exactly what the agent saw and said at every node.
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ZygoteTree, ZygoteNode, NodeId } from '../shared/types.js';

const DEBUG_DIR = '.debug';
const SESSION_LOG = 'session.jsonl';
const SNAPSHOT_FILE = 'snapshot.json';
const TREE_DUMP_FILE = 'tree-dump.md';
const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2MB — rotates to session.jsonl.prev

// The current logic, is that only the committed nodes over the loop of unshifting direction could be saved as the context.
function buildContextChain(
  tree: ZygoteTree,
  node: ZygoteNode
): { ancestors: Array<{ title: string; prompt: string; response: string }>; currentInput: string } {
  const ancestors: Array<{ title: string; prompt: string; response: string }> = [];
  let walkId: NodeId | null = node.parentId;
  while (walkId) {
    const ancestor = tree.nodes[walkId];
    if (!ancestor) break;
    if (ancestor.status === 'committed' && ancestor.agentResponse) {
      ancestors.unshift({
        title: ancestor.title,
        prompt: ancestor.prompt,
        response: ancestor.agentResponse,
      });
    }
    walkId = ancestor.parentId;
  }

  // if the node has chat history, format as "User: ..." and "Assistant: ..."
  // if not, just use the node's original prompt as the current input 
  const currentInput = node.chat.length > 0
    ? node.chat.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
    : node.prompt;
 // output the context in a way of ancestors' prompts and responses, 
 // and the current node chat history.
  return { ancestors, currentInput };
}

interface LogEntry {
  ts: string; // timestamp of when the event happened
  level: 'error' | 'warn' | 'info'; // severity level of the log
  cat: string; // category, eg: 'snapshot', 'lifecycle', 'dump'
  msg: string; // human-readable message describing the event
  data?: unknown; // optional additional data (e.g. error details, node IDs, counts) 
  // that can be helpful for debugging
}

class DebugLogger {
  // private - only accessible inside this class.
  // readonly - can only be set once (in the constructor).
  private readonly debugDir: string;
  private readonly logPath: string;
  private readonly snapshotPath: string;

  // Paths are just strings in memory — 
  // the folder only needs to exist when actually reading/writing files, not when defining the path.
  constructor(extensionRoot: string) {
    // with "this": save it on the object so that other methods can acess it later.
    this.debugDir = path.join(extensionRoot, DEBUG_DIR);
    this.logPath = path.join(this.debugDir, SESSION_LOG);
    this.snapshotPath = path.join(this.debugDir, SNAPSHOT_FILE);
    // create the .debug/ folder if it does not exist yet.
    this.ensureDir();
  }

  // the function in the debuglogger class
  private ensureDir(): void {
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
  }

  //Check the current log file's size
  //If it exceeds 2MB:
  //If an old .prev backup already exists → delete it
  //Rename the current log to .prev (becomes the backup)
  // So "backup" just means "the previous log sticks around until the next rotation." 
  private rotateIfNeeded(): void {
    try {
      const stat = fs.statSync(this.logPath);
      if (stat.size > MAX_LOG_SIZE) {
        const prevPath = this.logPath + '.prev';
        if (fs.existsSync(prevPath)) {
          fs.unlinkSync(prevPath);
        }
        fs.renameSync(this.logPath, prevPath);
      }
    } catch {
      // file doesn't exist yet
    }
  }

  private write(level: LogEntry['level'], cat: string, msg: string, data?: unknown): void {
    // rotate the log file if it's over 2MB
    this.rotateIfNeeded();
    //build a log entry object
    const entry: LogEntry = {
      // timestamp now
      ts: new Date().toISOString(),
      //leveled passed in
      level,
      cat,
      msg,
      // only if provided, if not provided, the log entry won't have a "data" field at all.
      ...(data !== undefined && { data }),
    };
    try {
      // append it as one json line to session.jsonl
      // automatically creates a new file if it doesn't exist.
      fs.appendFileSync(this.logPath, JSON.stringify(entry) + '\n');
    } catch {
      // best-effort
    }
  }
// shortcuts for calling write() with a preset severity level.
  info(cat: string, msg: string, data?: unknown): void {
    this.write('info', cat, msg, data);
  }

  warn(cat: string, msg: string, data?: unknown): void {
    this.write('warn', cat, msg, data);
  }

  error(cat: string, msg: string, data?: unknown): void {
    this.write('error', cat, msg, data);
  }

  captureSnapshot(tree: ZygoteTree, extra?: Record<string, unknown>): string {
    const errorNodes = Object.values(tree.nodes).filter((n) => n.status === 'error');
    const previewingNodes = Object.values(tree.nodes).filter((n) => n.status === 'previewing');

    const snapshot = {
      capturedAt: new Date().toISOString(),
      summary: {
        nodeCount: Object.keys(tree.nodes).length,
        branchCount: Object.keys(tree.branches).length,
        activeBranchId: tree.activeBranchId,
        errorNodeCount: errorNodes.length,
        previewingNodeCount: previewingNodes.length,
      },
      errorNodes: errorNodes.map((n) => ({
        id: n.id,
        title: n.title,
        prompt: n.prompt,
        error: n.error,
        tokens: n.tokens,
      })),
      // the whole tree is included in the snapshot, so you can inspect the full state at this moment in time — not just the error nodes.
      // Problem, but it is a very big file, especially if there are a lot of nodes with chat history.
      tree,
      ...extra,
    };

    try {
      fs.writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2));
    } catch {
      // best-effort
    }

    this.info('snapshot', 'Debug snapshot captured', {
      path: this.snapshotPath,
      errorNodes: errorNodes.length,
    });

    return this.snapshotPath;
  }

  dumpTree(tree: ZygoteTree, extra?: Record<string, unknown>): string {
    // active branch information is emphasized
    const dumpPath = path.join(this.debugDir, TREE_DUMP_FILE);
    const lines: string[] = [];

    const ts = new Date().toISOString();
    lines.push(`# Zygote Tree Dump`);
    lines.push(`Captured: ${ts}  `);
    lines.push(`Workspace: \`${tree.workspaceRoot}\`  `);
    const activeBranch = tree.branches[tree.activeBranchId];
    lines.push(`Active branch: **${activeBranch?.name ?? '???'}** (\`${tree.activeBranchId.slice(0, 8)}\`)  `);
    lines.push(`Nodes: ${Object.keys(tree.nodes).length} | Branches: ${Object.keys(tree.branches).length}`);
    // the log of the extra information is customized by the developer
    if (extra) {
      lines.push('');
      lines.push('**Runtime state:**');
      for (const [k, v] of Object.entries(extra)) {
        lines.push(`- ${k}: \`${JSON.stringify(v)}\``);
      }
    }
    lines.push('');
    // one-line overview per branch, counts, head and fork info.
    // Branch summary
    lines.push(`## Branches`);
    lines.push('');
    const branchNodeCounts: Record<string, number> = {};
    // count how many nodes are in each branch
    for (const node of Object.values(tree.nodes)) {
      branchNodeCounts[node.branchId] = (branchNodeCounts[node.branchId] ?? 0) + 1;
    }
    // name, count, head, is active or not, fork info of each branch
    for (const branch of Object.values(tree.branches)) {
      const count = branchNodeCounts[branch.id] ?? 0;
      const head = branch.headNodeId ? tree.nodes[branch.headNodeId] : null;
      const isActive = branch.id === tree.activeBranchId ? ' **(active)**' : '';
      const fork = branch.forkedAtNodeId
        ? ` | forked from: "${tree.nodes[branch.forkedAtNodeId]?.title ?? branch.forkedAtNodeId.slice(0, 8)}"`
        : '';
      lines.push(`- **${branch.name}**${isActive} — ${count} node(s), head: "${head?.title ?? '(empty)}'}"${fork}`);
    }
    lines.push('');

    // Full tree hierarchy
    lines.push(`## Full Tree`);
    lines.push('');
    // build a parent - child map
    const childrenMap: Record<string, ZygoteNode[]> = {};
    for (const node of Object.values(tree.nodes)) {
      // if no parent, use "__root__" as the key to group all root nodes together.
      const key = node.parentId ?? '__root__';
      // initialize the array if this is the first child for this parent
      if (!childrenMap[key]) childrenMap[key] = [];
      // add the node to its parent's list of children
      childrenMap[key].push(node);
    }
    for (const kids of Object.values(childrenMap)) {
      // sort in the creating time as the hierarchy.
      kids.sort((a, b) => a.createdAt - b.createdAt);
    }
    //### [x] Fix login bug
// ID: `abc12345` | Branch: **main** | Status: `committed` | Created: 6/9/2026
// Tokens: 500 in / 1200 out

  // ### [~] Try new approach
  // ID: `def67890` | Branch: **experiment** | Status: `previewing` | Created: 6/9/2026

    // ### [!] Refactor auth
    // ID: `ghi11111` | Branch: **experiment** | Status: `error` | Created: 6/9/2026

    // **Error:**
    // > API rate limit exceeded

    const renderNode = (node: ZygoteNode, depth: number): void => {
      //* status, tokens and errors per node
      const indent = '  '.repeat(depth);
      const branchName = tree.branches[node.branchId]?.name ?? '???';
      const statusIcon: Record<string, string> = {
        draft: '[ ]', previewing: '[~]', committed: '[x]', error: '[!]',
      };
      const icon = statusIcon[node.status] ?? '[?]';

      lines.push(`${indent}### ${icon} ${node.title}`);
      lines.push(`${indent}ID: \`${node.id.slice(0, 8)}\` | Branch: **${branchName}** | Status: \`${node.status}\` | Created: ${new Date(node.createdAt).toLocaleString()}`);
      if (node.tokens) {
        lines.push(`${indent}Tokens: ${node.tokens.input} in / ${node.tokens.output} out`);
      }
      if (node.error) {
        lines.push('');
        lines.push(`${indent}**Error:**`);
        lines.push(`${indent}> ${node.error}`);
      }
      lines.push('');
      //*
      // Prompt
      //**Prompt:**
      //> Fix the login bug in auth.ts
      //> Make sure the session token is refreshed correctly

      lines.push(`${indent}**Prompt:**`);
      lines.push(`${indent}> ${node.prompt.replace(/\n/g, `\n${indent}> `)}`);
      lines.push('');

      // Chat history (all turns)
      // **Chat History** (3 message(s)):
      //> **You** (10:00:05): Fix the login bug
      //>
      //> **Claude** (10:00:08): I'll look at auth.ts to find the issue...
      //>
      //> **You** (10:00:15): Also check the session refresh logic
      //>
      // note: preview is a defined paramater that shows a 'preview/snippet of the content'
      if (node.chat.length > 0) {
        lines.push(`${indent}**Chat History** (${node.chat.length} message(s)):`);
        for (const msg of node.chat) {
          const role = msg.role === 'user' ? 'You' : 'Claude';
          const time = new Date(msg.timestamp).toLocaleTimeString();
          const preview = msg.content.length > 500
            ? msg.content.slice(0, 500) + `... [${msg.content.length} chars total]`
            : msg.content;
          lines.push(`${indent}> **${role}** (${time}): ${preview.replace(/\n/g, `\n${indent}> `)}`);
          lines.push(`${indent}>`);
        }
        lines.push('');
      }

      // Tool calls
      // **Tool Calls** (3):
// - `read_file(src/auth.ts)` → OK
// - `search_files(login)` → OK
// - `write_file(src/auth.ts)` → ERR: Permission denied

      if (node.toolCalls && node.toolCalls.length > 0) {
        lines.push(`${indent}**Tool Calls** (${node.toolCalls.length}):`);
        for (const tc of node.toolCalls) {
          const status = tc.result.ok ? 'OK' : `ERR: ${tc.result.error}`;
          lines.push(`${indent}- \`${tc.tool}(${tc.input.path})\` → ${status}`);
        }
        lines.push('');
      }
      // // The agent's final answer to the user's prompt, truncated if over 800 chars.
      // Agent response summary
      if (node.agentResponse) {
        const preview = node.agentResponse.length > 800
          ? node.agentResponse.slice(0, 800) + `\n\n... [${node.agentResponse.length} chars total]`
          : node.agentResponse;
        lines.push(`${indent}**Agent Response:**`);
        lines.push(`${indent}> ${preview.replace(/\n/g, `\n${indent}> `)}`);
        lines.push('');
      }
      // the content indented had been generated above by the function
      // Because the agent has no real memory — it only knows what's in the context sent to it. If a parent node's prompt/response is missing from this chain, the agent acts like that conversation never happened.
      // Context sent to agent — this is the key for diagnosing "memory" issues
      // intuition: Is it possible to build or coordinate a memory of the agent in the future?
      const context = buildContextChain(tree, node);
      if (context.ancestors.length > 0) {
        lines.push(`${indent}**Context Sent to Agent** (${context.ancestors.length} ancestor(s) included):`);
        lines.push(`${indent}\`\`\`\``);
        for (const anc of context.ancestors) {
          lines.push(`${indent}User: ${anc.prompt}`);
          lines.push(`${indent}Assistant: ${anc.response.length > 300 ? anc.response.slice(0, 300) + '...' : anc.response}`);
          lines.push(`${indent}`);
        }
        lines.push(`${indent}---`);
        lines.push(`${indent}${context.currentInput}`);
        lines.push(`${indent}\`\`\`\``);
        lines.push('');
      }

      lines.push(`${indent}---`);
      lines.push('');

      // Render children
      const children = childrenMap[node.id] ?? [];
      for (const child of children) {
        renderNode(child, depth + 1);
      }
    };

    const roots = (childrenMap['__root__'] ?? []);
    if (roots.length === 0) {
      lines.push('*(empty tree — no nodes yet)*');
    }
    for (const root of roots) {
      renderNode(root, 0);
    }
// renderNode(node, depth):
  //┌─────────────────────────────┐
  //│  1. Header (status, tokens) │
  //│  2. Prompt                  │
  //│  3. Chat history            │  ← all of this renders ONE node
  //│  4. Tool calls              │
  //│  5. Agent response          │
  //│  6. Context chain           │
  //└─────────────────────────────┘
  // 7. For each child → renderNode(child, depth + 1)  ← triggers the next node
// after the recursion, only run once. write up the entire array into one disk file
    try {
      fs.writeFileSync(dumpPath, lines.join('\n'));
    } catch {
      // best-effort
    }
// capture to the session.jsonl
    this.info('dump', 'Tree dump captured', { path: dumpPath, nodeCount: Object.keys(tree.nodes).length });
// return the path
    return dumpPath;
  }
}
// Extension starts → initDebugLogger()     → notebook opens
// User sends prompt → dbg()?.info(...)      → writes a line
// Agent calls tool  → dbg()?.info(...)      → writes a line
// Tool fails        → dbg()?.error(...)     → writes a line
// User asks again   → dbg()?.info(...)      → writes a line
// ...keeps going until the extension closes

let _instance: DebugLogger | null = null;
// serve as the multiple-written notebook that could be writen for multiple times
export function initDebugLogger(extensionRoot: string): void {
  _instance = new DebugLogger(extensionRoot);
  _instance.info('lifecycle', 'Debug logger initialized', { extensionRoot });
}
// provide the single instance of the debug logger to the rest of the extension code, so they can call dbg()?.info(...) to write logs without needing to know about the implementation details of the DebugLogger class or worry about initialization.
export function dbg(): DebugLogger | null {
  return _instance;
}
