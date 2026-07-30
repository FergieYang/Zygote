/*
* content-addressable file store, git-like database that capture the state of workspace files.
two state: 1. The blob (low-level) — a single file's content, living at .zygote/snapshots/<hash>. The "state" here is literally one file's bytes, addressed by their own SHA-256.
2. The manifest (high-level) — the Record<string, string> that captureWorkspaceSnapshot returns at line 71: a map of relative path → content hash.
{
  "src/index.ts":     "a1b2c3…",
  "package.json":     "d4e5f6…",
  "src/login.tsx":    "99aa88…"
}
*/
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { ensureZygoteDir } from './persistence.js';

const ZYGOTE_DIR = '.zygote';
const SNAPSHOTS_DIR = 'snapshots';

/**
 * Compute the SHA-256 hex digest of file content.
 * This hash is the identity of the content, identical content always produces the same hash.
 */
export function hashContent(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * write content into a hash and return the hash
 * Save content to the content-addressable snapshot store.
 * Returns the hash (filename) under which it was saved.
 */
export function saveSnapshot(workspaceRoot: string, content: Buffer): string {
  ensureZygoteDir(workspaceRoot);
  const hash = hashContent(content);
  const snapshotPath = path.join(
    workspaceRoot,
    ZYGOTE_DIR,
    SNAPSHOTS_DIR,
    hash
  );
  // filename makes "exists" equivalent to "already have this exact content.
  // Content-addressable: skip write if the file already exists
  if (!fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, content);
  }

  return hash;
}

/**
 * Load content from the content-addressable snapshot store.
 * "loadSnapshot fetches one stored block — one file's content — 
 * from the snapshot store, addressed by its hash, provided it was saved earlier."
 */
export function loadSnapshot(
  workspaceRoot: string,
  hash: string
): Buffer {
  const snapshotPath = path.join(
    workspaceRoot,
    ZYGOTE_DIR,
    SNAPSHOTS_DIR,
    hash
  );

  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Snapshot not found: ${hash}`);
  }

  return fs.readFileSync(snapshotPath);
}

/**
 * Capture a snapshot of all workspace files, storing each in the
 * content-addressable store. Returns a map of relative path -> hash.
 */
/**
 * both runner.ts and zygotepanel.ts could run this file, the file that has
 * been looped only determined by the caller
 */
export function captureWorkspaceSnapshot(
  workspaceRoot: string,
  filePaths: string[]
): Record<string, string> {
  const fileHashes: Record<string, string> = {};

  for (const filePath of filePaths) {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspaceRoot, filePath);

    if (!fs.existsSync(absPath)) {
      continue;
    }
    // entire content of the file as raw bytes — binary-safe
    const content = fs.readFileSync(absPath);
    const hash = saveSnapshot(workspaceRoot, content);
    const relPath = path.relative(workspaceRoot, absPath);
    fileHashes[relPath] = hash;
  }

  return fileHashes;
}

/**
 * Restore workspace files from a snapshot (hash map).
 * a user rejects an agent's preview, the runner calls restoreWorkspaceSnapshot(before) to wipe out the agent's edits and put the codebase back exactly as it was before the run. The same call also materializes a node's file state when you jump to a different branch in the tree — "restore that node's manifest" makes the workspace become what that branch looked like.

So in one line: it's the "checkout" / undo primitive — feed it a snapshot manifest and it forces the workspace files back to that exact state.
 */
export function restoreWorkspaceSnapshot(
  workspaceRoot: string,
  fileHashes: Record<string, string>
): void {
  for (const [relPath, hash] of Object.entries(fileHashes)) {
    const absPath = path.join(workspaceRoot, relPath);
    const content = loadSnapshot(workspaceRoot, hash);

    // Ensure parent directory exists
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(absPath, content);
  }
}

/*
* The hash is not a cached middle-step you can cut — 
it's the shared address that lets dozens of overlapping tree snapshots 
dedupe down to "store each unique file-version once." Drop it and rollback 
still works, but every snapshot becomes a full directory copy, 
and the speculative tree gets too heavy to keep around.
*/

/*
* a system with many overlapping versions needs dedup, 
and content-addressing is how you get it nearly for free.
*/