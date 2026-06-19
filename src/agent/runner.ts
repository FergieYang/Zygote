/**
 * runner.ts — The AI execution engine at the heart of Zygote.
 *
 * This file is the bridge between Zygote's tree-based branching UI and the
 * actual AI agent that reads, edits, and reasons about the user's code.
 * Every time a user triggers a "preview" on a tree node, this is the file
 * that orchestrates the full lifecycle: snapshotting the workspace before the
 * run, dispatching the prompt to an AI backend, streaming responses and tool
 * calls back into the tree, and capturing the post-run workspace state.
 *
 * Structure:
 *  - Backend resolution (lines ~20-33): Decides whether to use the Claude
 *    Agent SDK (direct API) or the Claude Code CLI based on user settings
 *    and available credentials. This "auto" fallback makes Zygote work
 *    out-of-the-box for CLI users and power users with API keys alike.
 *  - Prompt construction (buildPrompt): Walks the branch history in the
 *    Zygote tree to assemble a conversational context — ancestor committed
 *    nodes become prior turns, giving the agent memory of earlier work in
 *    that branch.
 *  - Execution backends (runWithCLI / runWithAgentSDK): Two parallel
 *    implementations that normalize streaming events (text, thinking,
 *    tool use, token usage) into a shared callback interface.
 *  - runPreview (main export): The orchestrator. Snapshots → prompt →
 *    dispatch → accumulate response → commit result to tree → persist.
 *    Called by ZygotePanel for every run/rerun/chat-followup action.
 *  - rejectPreviewResult: Rolls the workspace back to the pre-run snapshot
 *    when the user discards a preview, enabling Zygote's core "speculative
 *    execution" model — try changes risk-free, keep or discard.
 *  - handleQuickAsk: A lightweight single-turn path for quick questions
 *    that don't need tool use or workspace mutation.
 *
 * Why this file matters:
 *  This is Zygote's single point of contact with AI. Every speculative
 *  branch, every code edit the agent makes, every rollback flows through
 *  here. It is the engine that makes the tree model more than a UI — it
 *  turns each node into a reversible, explorable computation.
 */
// ── Imports ──────────────────────────────────────────────────────────
import * as vscode from 'vscode';                // VS Code extension API (settings, UI popups, file search, etc.)
import { spawn, execSync } from 'node:child_process';  // spawn = launch long-running processes; execSync = run a quick command and wait
import {
  setNodeStatus,       // Updates a node's status (e.g. 'draft' → 'previewing' → 'committed')
  appendChatMessage,   // Adds a new message (user or assistant) to a node's chat history
  getBranchNodes,      // Returns all nodes along a branch in order (root → leaf), used to build conversation context
} from '../state/tree.js';
import { saveTree } from '../state/persistence.js';   // Writes the entire tree to disk (.zygote/ folder) so it survives restarts
import { getApiKey } from './claude.js';               // Shared API key retrieval (secret store → env var → popup) — lives in claude.ts to avoid duplication
import {
  captureWorkspaceSnapshot,   // Hashes every file in the workspace — a "before" picture we can compare or restore to
  restoreWorkspaceSnapshot,   // Reverts the workspace files back to a previous snapshot (undo agent changes)
} from '../state/snapshots.js';
import { dbg } from '../debug/logger.js';   // Debug logger — returns null when debug mode is off, so calls are safe to leave in
import type {
  ZygoteTree,   // The full tree data structure (all nodes, branches, metadata)
  NodeId,       // A unique string ID for each node in the tree
  ToolCall,     // Describes one tool the AI used (e.g. "Read file X", "Edit file Y")
} from '../shared/types.js';

// ── Backend Selection ────────────────────────────────────────────────
// Zygote can talk to Claude two ways: the Agent SDK (direct API calls) or the CLI (spawning `claude` command).
// These functions figure out which one to use.

type Backend = 'auto' | 'sdk' | 'cli';   // The three possible user settings

// Decides which backend to use: reads the user's setting, and if 'auto', checks for an API key
async function resolveBackend(secretStorage: vscode.SecretStorage): Promise<'sdk' | 'cli'> {
  const setting = vscode.workspace.getConfiguration('zygote').get<Backend>('backend', 'auto');  // Read from VS Code settings.json
  if (setting === 'sdk') return 'sdk';          // User explicitly wants SDK — use it
  if (setting === 'cli') return 'cli';          // User explicitly wants CLI — use it
  // 'auto' mode: check if an API key exists anywhere (VS Code secret store or environment variable)
  const key = (await secretStorage.get('anthropic-api-key')) || process.env.ANTHROPIC_API_KEY;
  return key ? 'sdk' : 'cli';   // Has key → SDK (faster, more control); no key → fall back to CLI
}

// ── Workspace File Discovery ─────────────────────────────────────────
// Finds all files in the project so we can snapshot them before/after an AI run.

async function getWorkspaceFiles(
  workspaceRoot: string        // Absolute path to the project root (e.g. /Users/you/my-project)
): Promise<string[]> {         // Returns an array of absolute file paths
  const pattern = new vscode.RelativePattern(workspaceRoot, '**/*');   // '**/*' = every file in every subfolder
  const exclude = '**/node_modules/**,**/.zygote/**,**/.git/**,**/dist/**';  // Skip junk folders we don't want to snapshot
  const uris = await vscode.workspace.findFiles(pattern, exclude, 500);     // Ask VS Code to find files (capped at 500)
  return uris.map((uri) => uri.fsPath);   // Convert VS Code URI objects to plain file path strings
}

// ── Prompt Construction ──────────────────────────────────────────────
// Builds the full prompt string that gets sent to Claude.
// Produces a HIERARCHICAL format — each ancestor node is indented one level deeper
// than its parent, so Claude can see the tree structure and understand task boundaries.
//
// Example output for a 3-node deep branch:
//
//   [Node · "create a login page" · committed]
//     Task: create a login page
//     Result: I created login.tsx with a form component
//
//     [Node · "add password validation" · committed]
//       Task: add password validation
//       Result: Added regex validation to the password field
//
//       [Current Node · "style the buttons"]
//         User: style the buttons
//         Assistant: I updated the button styles
//         User: make them rounded

function buildPrompt(tree: ZygoteTree, nodeId: NodeId): string {
  const node = tree.nodes[nodeId];   // Look up the node we're about to run
  if (!node) return '';               // Safety check: if the node doesn't exist, return empty

  const branchNodes = getBranchNodes(tree, node.branchId);   // Get all nodes on this branch, from root to tip
  const lines: string[] = [];   // We'll build the prompt line by line
  let depth = 0;                // Tracks the current indentation level (increments per committed ancestor)

  // Walk through ancestor nodes (the ones BEFORE the current node on this branch)
  for (const ancestorNode of branchNodes) {
    if (ancestorNode.id === nodeId) break;   // Stop when we reach the current node — we only want history
    // Only include ancestors that were successfully completed ('committed') and have a response
    if (ancestorNode.status === 'committed' && ancestorNode.agentResponse) {
      const indent = '  '.repeat(depth);   // 2 spaces per depth level (e.g. depth 0 = "", depth 1 = "  ", depth 2 = "    ")
      lines.push(`${indent}[Node · "${ancestorNode.title}" · committed]`);   // Header: shows what this node was about
      lines.push(`${indent}  Task: ${ancestorNode.prompt}`);                  // What the user asked
      lines.push(`${indent}  Result: ${ancestorNode.agentResponse}`);         // What the AI answered
      lines.push('');   // Blank line between nodes for readability
      depth++;   // Next node will be indented one level deeper (child of this one)
    }
  }

  // Now format the CURRENT node — the one we're actually running
  const indent = '  '.repeat(depth);   // Current node's indentation (one level deeper than the last ancestor)
  lines.push(`${indent}[Current Node · "${node.title}"]`);   // Header: marks this as the active task

  // Format the current node's chat messages (the ongoing conversation in this node)
  const chatMessages = node.chat
    .map((msg) => {
      const label = msg.role === 'user' ? 'User' : 'Assistant';   // Label each message by role
      return `${indent}  ${label}: ${msg.content}`;                // Indent the content one level inside the node
    })
    .join('\n');   // One message per line

  if (chatMessages) {
    lines.push(chatMessages);   // Add chat history if it exists
  } else {
    lines.push(`${indent}  Task: ${node.prompt}`);   // Fallback: fresh node with no chat yet, just show the prompt
  }

  return lines.join('\n');   // Combine all lines into the final prompt string
}

// ── CLI Path Resolution ──────────────────────────────────────────────
// Reads the user's configured CLI path from settings. Defaults to 'claude'.
// Used by both runWithCLI and handleQuickAsk.
function getCliPath(): string {
  return vscode.workspace.getConfiguration('zygote').get<string>('cliPath', 'claude');
}

// Handles the ENOENT error (CLI not found) with a helpful popup:
// offers to open install docs or VS Code settings to set the path manually.
async function handleCliNotFound(): Promise<never> {
  const action = await vscode.window.showErrorMessage(
    'Claude Code CLI not found.',
    'Install Claude Code',
    'Set Path Manually'
  );
  if (action === 'Install Claude Code') {
    vscode.env.openExternal(vscode.Uri.parse('https://docs.anthropic.com/en/docs/claude-code'));
  }
  if (action === 'Set Path Manually') {
    vscode.commands.executeCommand('workbench.action.openSettings', 'zygote.cliPath');
  }
  throw new Error('Claude Code CLI not found. Install it or set zygote.cliPath in settings.');
}

// ── CLI Backend ──────────────────────────────────────────────────────
// Runs Claude by spawning the `claude` command-line tool as a child process.
// This is the fallback for users who don't have an API key (they use Claude Code's own auth).

async function runWithCLI(
  prompt: string,              // The text prompt to send to Claude
  workspaceRoot: string,       // The project folder — Claude CLI will run here so it can see the code
  callbacks: {                 // Four callback functions we'll call as events stream in
    onText: (text: string) => void;        // Called when Claude produces text output
    onThinking: (text: string) => void;    // Called when Claude shares its reasoning (extended thinking)
    onToolUse: (tool: ToolCall) => void;   // Called when Claude uses a tool (read/edit/write a file)
    onUsage: (input: number, output: number) => void;  // Called with token counts (how much AI "brainpower" was used)
  }
): Promise<void> {
  // ── Upfront check: verify the CLI exists BEFORE attempting to spawn ──
  // This avoids wasting time spawning a process that will just fail with ENOENT
  const cliPath = getCliPath();   // Read the user's configured CLI path (defaults to 'claude')
  try {
    execSync(`bash -lc 'command -v "${cliPath}"'`, { stdio: 'ignore' });  // 'command -v' checks if a command exists
  } catch {
    await handleCliNotFound();   // Show install/settings popup immediately — never reaches spawn
  }

  return new Promise<void>((resolve, reject) => {   // Wrap the event-driven child process in a Promise so we can await it
    // Remove ANTHROPIC_API_KEY from environment — CLI uses its own auth, and we don't want conflicts
    // The underscore `_` means "grab this value but throw it away"
    const { ANTHROPIC_API_KEY: _, ...cleanEnv } = process.env;
    // Launch via login shell (`bash -l`) so the user's full PATH is loaded automatically
    // This finds `claude` wherever it's installed without hardcoding paths
    const child = spawn('bash', [
      '-lc',   // -l = login shell (loads .bashrc/.zshrc), -c = run the following command string
      `"${cliPath}" --print --output-format stream-json --verbose --dangerously-skip-permissions`,
    ], {
      cwd: workspaceRoot,    // Run in the user's project directory
      env: cleanEnv,         // Use our cleaned-up environment (no API key leak)
      stdio: ['pipe', 'pipe', 'pipe'],  // stdin/stdout/stderr all piped so we can read/write them
      //pipe: the call goes through you; ignore: you mute the person entirely; inherit: you hand the phone directly to them
    });
    child.stdin.write(prompt);   // Send the prompt to Claude's stdin (like typing into a terminal)
    child.stdin.end();           // Close stdin — tells Claude "that's the full prompt, start working"

    let stderrBuf = '';   // Buffer to collect error output in case something goes wrong

    // ── Handle stdout: parse streaming JSON events ──
    child.stdout.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);   // Split raw bytes into lines, skip empty ones
      for (const line of lines) {
        try {
          const event = JSON.parse(line);   // Each line is a JSON object representing one event
          // 'assistant' events contain Claude's actual response content
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {   // A message can have multiple content blocks
              if (block.type === 'thinking' && block.thinking) {
                callbacks.onThinking(block.thinking);   // Claude's internal reasoning
              }
              if (block.type === 'text' && block.text) {
                callbacks.onText(block.text);   // Claude's visible text response
              }
              if (block.type === 'tool_use' && block.name) {
                // Claude used a tool (e.g. Read, Edit, Write) — record it
                callbacks.onToolUse({
                  tool: block.name as ToolCall['tool'],
                  input: { path: block.input?.path || block.input?.file_path || '' },  // Which file was involved
                  result: { ok: true },   // CLI doesn't stream tool results, so we assume success
                });
              }
            }
            // Token usage info (tells us how "expensive" this response was)
            if (event.message.usage) {
              callbacks.onUsage(
                event.message.usage.input_tokens ?? 0,    // Tokens used to read the prompt
                event.message.usage.output_tokens ?? 0    // Tokens used to generate the response
              );
            }
          } else if (event.type === 'result') {
            // 'result' event = Claude is done. Check if it ended with an error
            if (event.subtype === 'error' || event.error) {
              reject(new Error(event.error || 'Claude CLI returned an error'));
            }
          }
        } catch {
          // Line wasn't valid JSON (e.g. a progress indicator) — safe to ignore
        }
      }
    });
    // hoard every error message chunk into one string
    // Collect stderr output (error messages from the CLI process)
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    // 'close' fires exactly once, when the CLI process has finished or exits.
    // ── Handle process exit ──
    child.on('close', (code) => {
      if (code !== 0) {
        // Non-zero exit code = something went wrong
        reject(new Error(`Claude CLI exited with code ${code}: ${stderrBuf.trim()}`));
      } else {
        resolve();   // Exit code 0 = success, resolve the Promise
      }
    });

    // 'error' happens even when the process can't even start
    // ── Handle spawn failure (e.g. `claude` command not found) ──
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // ENOENT = "file not found" — show a helpful popup with install/settings options
        handleCliNotFound().catch(e => reject(e));
        //*
        //it cannot wait so it catch and then send the error to make the promise fail
      } else {
        reject(err);   // Some other spawn error
      }
    });
  });
}

// ── Agent SDK Backend ────────────────────────────────────────────────
// Runs Claude via the official Agent SDK (direct API calls, no CLI needed).
// Preferred when the user has an API key — gives us more control and avoids spawning a child process.

async function runWithAgentSDK(
  prompt: string,              // The text prompt to send to Claude
  workspaceRoot: string,       // Project folder path
  apiKey: string,              // Anthropic API key for authentication
  callbacks: {                 // Same callback shape as the CLI backend (both use the same interface)
    onText: (text: string) => void;
    onThinking: (text: string) => void;
    onToolUse: (tool: ToolCall) => void;
    onUsage: (input: number, output: number) => void;
  }
): Promise<void> {
  // Dynamic import — only loads the SDK when actually needed (keeps startup fast for CLI-only users)
  const sdk = await import('@anthropic-ai/claude-agent-sdk');

  // Start a query — this returns an async iterator (like a stream of events we can loop through)
  const q = sdk.query({
    prompt,           // The user's prompt (with branch history prepended by buildPrompt)
    options: {
      cwd: workspaceRoot,                        // Working directory for the agent
      permissionMode: 'bypassPermissions',        // Skip permission checks — Zygote handles safety via preview/commit
      allowDangerouslySkipPermissions: true,       // Required flag to enable the above
      tools: { type: 'preset', preset: 'claude_code' },  // Give Claude the standard coding tools (Read, Edit, Write, Bash, etc.)
      maxTurns: 20,   // Cap at 20 back-and-forth turns (prevents runaway loops)
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',   // Use Claude Code's built-in system prompt as a base
        append: 'You are working within the Zygote tree-based coding environment. Focus on the current task and make meaningful progress.',
        // ^ Our custom addition: tells Claude it's inside Zygote, not a regular terminal
      },
      env: {
        ...process.env,               // Pass through all current environment variables
        ANTHROPIC_API_KEY: apiKey,     // Inject the API key so the SDK can authenticate
      },
    },
  });

  // Loop through streaming events as they arrive (async for...of = wait for each event one at a time)
  for await (const message of q) {
    if (message.type === 'assistant') {
      // TypeScript cast — the SDK types are loose, so we tell TS what shape to expect
      const msg = message as unknown as {
        message: {
          content: Array<{ type: string; text?: string; name?: string; input?: Record<string, string> }>;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
      };
      // Process each content block in the message (same logic as the CLI parser above)
      for (const block of msg.message.content) {
        if (block.type === 'thinking' && block.text) {
          callbacks.onThinking(block.text);     // Extended thinking / reasoning
        }
        if (block.type === 'text' && block.text) {
          callbacks.onText(block.text);          // Visible text response
        }
        if (block.type === 'tool_use' && block.name) {
          callbacks.onToolUse({                  // Tool usage (file read/edit/etc.)
            tool: block.name as ToolCall['tool'],
            input: { path: block.input?.path || block.input?.file_path || '' },
            result: { ok: true },
          });
        }
      }
      if (msg.message.usage) {
        callbacks.onUsage(
          msg.message.usage.input_tokens ?? 0,   // ?? 0 = if undefined, default to 0
          msg.message.usage.output_tokens ?? 0
        );
      }
    } else if (message.type === 'result') {
      // Final result event — check if it's an error
      const result = message as unknown as { error?: string; subtype?: string };
      if (result.subtype === 'error' || result.error) {
        throw new Error(result.error || 'Agent SDK returned an error');
      }
    }
  }
}

// ── runPreview — THE MAIN ORCHESTRATOR ───────────────────────────────
// This is the most important function in the file. It's called every time the user
// clicks "Run", "Rerun", or sends a follow-up message on a tree node.
// Flow: snapshot workspace → build prompt → call AI → collect results → save to tree
// just yell "something happened", and the UI decides how to display it.
// It only handles the Run, Rerun and Chat follow-up
export async function runPreview(
  tree: ZygoteTree,                       // The entire Zygote tree (all nodes and branches)
  nodeId: NodeId,                         // Which specific node we're running the AI for
  secretStorage: vscode.SecretStorage,    // VS Code's encrypted storage (for API keys)
  callbacks: {                            // Functions to notify the UI about what's happening
    onTreeUpdated: (tree: ZygoteTree) => void;                  // "The tree changed — re-render the UI"
    onOutputStream: (nodeId: NodeId, delta: string) => void;    // "New text chunk arrived — show it live"
    onThinkingStream: (nodeId: NodeId, delta: string) => void;  // "New thinking chunk — show it in thinking panel"
  }
): Promise<ZygoteTree> {   // Returns the updated tree when done
  const workspaceRoot = tree.workspaceRoot;   // Shortcut to the project folder path
  // same node, when stuck in a previous crashed session, and then we could do this step 1 clean up.
  // ── Step 1: Clean up if a previous run was interrupted (e.g. user closed VS Code mid-run) ──
  const existing = tree.nodes[nodeId];
  if (existing?.status === 'previewing') {   // Node is stuck in 'previewing' from a crashed run
    tree = setNodeStatus(tree, nodeId, 'draft', {   // Reset it back to 'draft' with all fields cleared
      agentResponse: undefined,
      toolCalls: undefined,
      workspaceSnapshot: undefined,
      error: undefined,
      tokens: undefined,
    });
  }

  // ── Step 2: Mark the node as "previewing" (the AI is working) ──
  // instantly flip the status flag of telling the UI of instant feedback
  tree = setNodeStatus(tree, nodeId, 'previewing');
  saveTree(workspaceRoot, tree);       // Persist to disk immediately
  callbacks.onTreeUpdated(tree);       // Tell the UI to show the "running" state

  try {
    // ── Step 3: Take a "before" snapshot of the workspace ──
    // This lets us detect what files the AI changed, and roll back if the user rejects the preview
    // set the status again but with snapshot data has been saved.
    const files = await getWorkspaceFiles(workspaceRoot);
    const preSnapshotHashes = captureWorkspaceSnapshot(workspaceRoot, files);  // Hash every file

    // Store the "before" snapshot on the node — used for rollback at any time
    tree = setNodeStatus(tree, nodeId, 'previewing', {
      workspaceSnapshot: { before: preSnapshotHashes },
    });

    // ── Step 4: Build the prompt (branch history + current request) ──
    const prompt = buildPrompt(tree, nodeId);
    const backend = await resolveBackend(secretStorage);   // Decide: SDK or CLI?
    dbg()?.info('agent', `Run starting for node ${nodeId}`, {   // Debug log (only shows when debug mode is on)
      backend,
      nodeTitle: tree.nodes[nodeId]?.title,
      promptLen: prompt.length,
    });

    // ── Step 5: Set up accumulators to collect the AI's full response ──
    const allToolCalls: ToolCall[] = [];   // Every tool the AI used (Read, Edit, Write, etc.)
    let fullResponse = '';                  // All text output concatenated together
    let fullThinking = '';                  // All thinking/reasoning concatenated
    let totalInputTokens = 0;              // Running total of input tokens across all turns
    let totalOutputTokens = 0;             // Running total of output tokens

    // Create callback functions that BOTH stream to the UI AND accumulate the full result
    // UI shows them but not stores them
    // The reason to acumulative the full response is to in step 8 that save to the final commited record of the node. 
    const agentCallbacks = {
      onText: (text: string) => {
        callbacks.onOutputStream(nodeId, text);   // Stream to UI in real-time
        fullResponse += text;                      // Also save for the final node state
      },
      onThinking: (text: string) => {
        callbacks.onThinkingStream(nodeId, text);  // Stream thinking to UI
        fullThinking += text;                       // Also accumulate
      },
      onToolUse: (tool: ToolCall) => {
        allToolCalls.push(tool);   // Just collect — we'll save them all at the end
      },
      onUsage: (input: number, output: number) => {
        totalInputTokens += input;    // Add up tokens across multiple turns
        totalOutputTokens += output;
      },
    };

    // ── Step 6: Actually call the AI (the part that takes time) ──
    if (backend === 'cli') {
      await runWithCLI(prompt, workspaceRoot, agentCallbacks);       // Spawn `claude` command
    } else {
      const apiKey = await getApiKey(secretStorage);                  // Get API key (may prompt user)
      await runWithAgentSDK(prompt, workspaceRoot, apiKey, agentCallbacks);  // Call SDK directly
    }

    // Tree metadata of JSON file, just node counts, branch counts and some error nodes or whole tree project
    // ── Step 7: Take an "after" snapshot (the AI is done, see what changed) ──
    const postFiles = await getWorkspaceFiles(workspaceRoot);
    const postSnapshotHashes = captureWorkspaceSnapshot(workspaceRoot, postFiles);

    // ── Step 8: Mark the node as "committed" and save all results ──
    tree = setNodeStatus(tree, nodeId, 'committed', {
      agentResponse: fullResponse || '(No text response — the agent may have only used tools.)',  // Fallback if AI only edited files
      thinkingContent: fullThinking || undefined,        // Save thinking (undefined if empty, to keep data clean)
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,  // Only save if tools were used
      workspaceSnapshot: { before: preSnapshotHashes, after: postSnapshotHashes },  // Both states — enables rollback at any time
      tokens: { input: totalInputTokens, output: totalOutputTokens }, // Total cost of this run
    });

    dbg()?.info('agent', `Run completed for node ${nodeId}`, {
      toolCallCount: allToolCalls.length,
      responseLen: fullResponse.length,
      tokens: { input: totalInputTokens, output: totalOutputTokens },
    });

    // Also append the response as a chat message so the conversation view shows it
    if (fullResponse) {
      tree = appendChatMessage(tree, nodeId, 'assistant', fullResponse);
    }

    // ── Step 9: Persist and notify ──
    saveTree(workspaceRoot, tree);      // Write the updated tree to disk
    callbacks.onTreeUpdated(tree);      // Tell UI to re-render with the final state
    return tree;                         // Return the updated tree to the caller (ZygotePanel)
  } catch (err) {
    // ── Error handling: if anything above threw, mark the node as "error" ──
    const errMsg = err instanceof Error ? err.message : String(err);  // Extract a readable error message
    console.error('Zygote runPreview error:', errMsg);                 // Log to VS Code's developer console
    dbg()?.error('agent', `Run failed for node ${nodeId}`, {
      error: errMsg,
      stack: err instanceof Error ? err.stack : undefined,   // Include stack trace for debugging
    });
    tree = setNodeStatus(tree, nodeId, 'error', { error: errMsg });   // Mark node as failed
    saveTree(workspaceRoot, tree);      // Still persist — the error state is useful info
    callbacks.onTreeUpdated(tree);      // Update UI to show the error
    return tree;
  }
}

// ── rejectPreviewResult — THE UNDO BUTTON ────────────────────────────
// Called when the user looks at what the AI did and says "no thanks, undo it all."
// This is what makes Zygote's speculative execution safe — you can always roll back.

export function rejectPreviewResult(
  tree: ZygoteTree,                              // The current tree
  nodeId: NodeId,                                // The node whose changes we're rejecting
  preSnapshotHashes: Record<string, string>      // The "before" snapshot (file path → hash), captured before the AI ran
): ZygoteTree {
  // Restore every file to its pre-run state (deletes new files, reverts modified ones)
  restoreWorkspaceSnapshot(tree.workspaceRoot, preSnapshotHashes);
  // Reset the node back to 'draft' and clear all AI-generated data
  const updatedNode = {
    ...tree.nodes[nodeId],           // Copy all existing node properties
    status: 'draft' as const,        // Back to draft (as if the run never happened)
    agentResponse: undefined,        // Clear the AI's text response
    toolCalls: undefined,            // Clear the list of tools it used
    workspaceSnapshot: undefined,    // Clear the snapshot data
  };
  // Immutable update: create a new tree object with the updated node (never mutate the original)
  tree = { ...tree, nodes: { ...tree.nodes, [nodeId]: updatedNode } };
  saveTree(tree.workspaceRoot, tree);   // Persist the rollback to disk
  return tree;
}

// ── handleQuickAsk — LIGHTWEIGHT SINGLE-TURN Q&A ─────────────────────
// A simpler path for quick questions that don't need the full preview/commit/snapshot cycle.
// No tool use, no workspace changes — just ask Claude a question and get a text answer back.

export async function handleQuickAsk(
  prompt: string,                          // The user's question
  secretStorage: vscode.SecretStorage      // For API key lookup
): Promise<string> {                       // Returns Claude's text answer as a plain string
  const backend = await resolveBackend(secretStorage);   // SDK or CLI?
  let text = '';   // Will accumulate the response

  // ── CLI path: simple one-shot call, no streaming needed ──
  if (backend === 'cli') {
    // Upfront check: verify CLI exists before spawning
    const cliPath = getCliPath();
    try {
      execSync(`bash -lc 'command -v "${cliPath}"'`, { stdio: 'ignore' });
    } catch {
      await handleCliNotFound();
    }

    return new Promise<string>((resolve, reject) => {
      const { ANTHROPIC_API_KEY: _k, ...cleanEnv2 } = process.env;  // Strip API key from env (same as runWithCLI)
      // Launch via login shell so the user's full PATH is loaded
      const child = spawn('bash', ['-lc', `"${cliPath}" --print ${JSON.stringify(prompt)}`], {
        env: cleanEnv2,
        stdio: ['ignore', 'pipe', 'pipe'],   // 'ignore' stdin (no input needed), pipe stdout and stderr
      });
      let stdout = '';   // Collect the response
      let stderr = '';   // Collect any errors
      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });   // Append each chunk
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Claude CLI exited with code ${code}`));
        } else {
          resolve(stdout.trim());   // Return the response with whitespace trimmed
        }
      });
      child.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          handleCliNotFound().catch(e => reject(e));   // Show install/settings popup
        } else {
          reject(err);
        }
      });
    });
  }

  // ── SDK path: single-turn, no tools ──
  const apiKey = await getApiKey(secretStorage);
  try {
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    const q = sdk.query({
      prompt,
      options: {
        tools: [],          // Empty array = no tools allowed (pure Q&A, no file editing)
        maxTurns: 1,        // Only one turn — ask and answer, no back-and-forth
        systemPrompt: 'You are a helpful coding assistant. Answer concisely.',  // Simple system prompt
        env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
      },
    });
    // Read the response (same async iterator pattern, but simpler — only looking for text)
    for await (const message of q) {
      if (message.type === 'assistant') {
        const msg = message as unknown as { message: { content: Array<{ type: string; text?: string }> } };
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text) {
            text += block.text;   // Accumulate all text blocks into one string
          }
        }
      }
    }
  } catch {
    throw new Error('Failed to get quick ask response. Check your API key and try again.');
  }

  return text;   // Return the complete answer
}
