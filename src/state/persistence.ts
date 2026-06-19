/**
 * persistence.ts — Disk I/O for Zygote's state tree.
 *
 * Position in Zygote:
 *   The branching tree of conversation/computation nodes lives in memory at
 *   runtime, but must survive across editor sessions. This file is the single
 *   bridge between that in-memory `ZygoteTree` and its on-disk home under
 *   `<workspace>/.zygote/` (tree.json + a snapshots/ dir for workspace state).
 *   It sits below the state layer (tree.ts builds/mutates the tree) and is
 *   called whenever the tree must be read at startup or flushed after a change.
 *
 * Functions:
 *   - ensureZygoteDir : create the .zygote/ and .zygote/snapshots/ dirs if absent.
 *   - loadTree        : read tree.json into a ZygoteTree (or seed a default one),
 *                       self-healing it — recover nodes stuck "previewing" from
 *                       an interrupted session and repair orphaned/missing roots.
 *   - saveTree        : serialize the ZygoteTree back to tree.json.
 *  Metaphor:
 *  persistence.ts: Code, The librarian — knows how to fetch and shelve the book
 *  tree.json: Data, The book — the actual tree contents
**/
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ZygoteTree } from '../shared/types.js';
import { createDefaultTree } from './tree.js';

const ZYGOTE_DIR = '.zygote';
const TREE_FILE = 'tree.json';
const SNAPSHOTS_DIR = 'snapshots';

/**
 * Ensure the .zygote directory exists in the workspace root.
 * ensureZygoteDir() guarantees:
<workspace>/
└── .zygote/              ← 1st check (lines 35–38)
    └── snapshots/        ← 2nd check (lines 40–43)
 * { recursive: true } means "create any missing parent folders too, 
    and don't error if it already exists."
 */
export function ensureZygoteDir(workspaceRoot: string): void {
  const zygoteDir = path.join(workspaceRoot, ZYGOTE_DIR);
  if (!fs.existsSync(zygoteDir)) {
    fs.mkdirSync(zygoteDir, { recursive: true });
  }

  const snapshotsDir = path.join(zygoteDir, SNAPSHOTS_DIR);
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }
}

/**
 * Load the tree from .zygote/tree.json.
 * Returns a default tree with a "main" branch if the file does not exist.
 */
export function loadTree(workspaceRoot: string): ZygoteTree {
  const treePath = path.join(workspaceRoot, ZYGOTE_DIR, TREE_FILE);
/**
 * tree.json missing?  ──yes──▶  build default + save + return   (this block)
       │
       no
       ▼
   read existing tree.json, repair it, return   (the try/catch below)
 */
  if (!fs.existsSync(treePath)) {
    const defaultTree = createDefaultTree(workspaceRoot);
    ensureZygoteDir(workspaceRoot);
    saveTree(workspaceRoot, defaultTree);
    return defaultTree;
  }

  try {
    const raw = fs.readFileSync(treePath, 'utf-8');
    const tree: ZygoteTree = JSON.parse(raw);
    // Ensure workspaceRoot matches current location
    tree.workspaceRoot = workspaceRoot;
    let dirty = false;
    for (const node of Object.values(tree.nodes)) {
      // Recover nodes stuck in "previewing" from a prior interrupted session
      if (node.status === 'previewing') {
        node.status = 'draft';
        node.agentResponse = undefined;
        node.toolCalls = undefined;
        node.workspaceSnapshot = undefined;
        node.error = undefined;
        node.tokens = undefined;
        dirty = true;
      }
      // Prevent the case when a dev manually deletes a node from tree.json and forget to leaves a child behind
      // Fix orphaned nodes: parent doesn't exist → make it a root
      if (node.parentId && !tree.nodes[node.parentId]) {
        node.parentId = null;
        if (!tree.rootNodeIds.includes(node.id)) {
          tree.rootNodeIds.push(node.id);
        }
        dirty = true;
      }
      // It guarantees the rootNodeIds list is complete — 
      // every node that claims to be a root (parentId === null) is actually registered there, 
      // so none get dropped from the view.
      // Ensure all root-level nodes are in rootNodeIds
      if (node.parentId === null && !tree.rootNodeIds.includes(node.id)) {
        tree.rootNodeIds.push(node.id);
        dirty = true;
      }
    }
    // logic: we assume disk and memory match in the beginning, but ever if 
    // some repairs have been made in the process, we save the tree back to disk like updation.
    if (dirty) {
      saveTree(workspaceRoot, tree);
    }
    return tree;
  } catch (err) {
    console.error('Failed to parse .zygote/tree.json, creating default tree:', err);
    const defaultTree = createDefaultTree(workspaceRoot);
    saveTree(workspaceRoot, defaultTree);
    return defaultTree;
  }
}

/**
 * Save the tree to .zygote/tree.json.
 */
export function saveTree(workspaceRoot: string, tree: ZygoteTree): void {
  ensureZygoteDir(workspaceRoot);
  const treePath = path.join(workspaceRoot, ZYGOTE_DIR, TREE_FILE);
  fs.writeFileSync(treePath, JSON.stringify(tree, null, 2), 'utf-8');
}
