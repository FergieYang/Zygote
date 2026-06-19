import * as vscode from 'vscode';
// Let you read, write, delete and manipulate files and directories in the workspace.
import * as fs from 'node:fs';
// Let you work with file and directory paths.
import * as path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';

/**
 * Tool definitions in Claude's tool_use format.
 */
/**
 * costomize: Add a definition to toolDefinitions (tells Claude the tool exists)
Add a case in executeTool (actually runs it)
 */
export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description:
      'Read the contents of a file at the given path, relative to the workspace root.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'The file path relative to the workspace root.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description:
      'List files and directories at the given path, relative to the workspace root. Returns names with a trailing / for directories.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description:
            'The directory path relative to the workspace root. Use "." for the root.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Write content to a file at the given path, relative to the workspace root. Creates parent directories if needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'The file path relative to the workspace root.',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'search_files',
    description:
      'Search for a text pattern across all files in the workspace. Returns matching lines with file paths and line numbers. Useful for finding where functions, variables, imports, or patterns are used.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'The text or regex pattern to search for.',
        },
        file_glob: {
          type: 'string',
          description:
            'Optional glob to restrict search to specific file types, e.g. "*.py", "*.ts". Defaults to all files.',
        },
      },
      required: ['pattern'],
    },
  },
];

/**
 * Execute a tool call. Returns the result as a string.
 */
/**
 * Tools that could be furthered applied in the future:
  run_terminal_command — let the agent run shell commands (linting, tests, builds)
edit_file — apply a targeted edit instead of rewriting the whole file (what write_file does now)
web_search / fetch_url — let the agent look things up online
create_directory — scaffold project structure
delete_file — cleanup or refactoring
 */
export async function executeTool(
  workspaceRoot: string,
  toolName: string,
  // both the keys and the values are strings:
  // eg: { "path": "src/index.ts", "content": "hello world" }
  input: Record<string, string>
): Promise<{ ok: boolean; data?: string; error?: string }> {
  //true = tool succeeded, false = it failed
  // either data or error will be populated, but not both
  try {
  // switch: cleaner way to write multiple if/else if checks:
    switch (toolName) {
      case 'read_file': {
        const filePath = input.path;
        if (!filePath) {
          return { ok: false, error: 'Missing required parameter: path' };
        }
        const absPath = path.isAbsolute(filePath)
        // if it is already an absolute path, and then use it; otherwise, join with the directory of the workspace to get the absolute path
          ? filePath
          : path.join(workspaceRoot, filePath);
        // if it is a directory, then use the list_files tool instead of read_file
        const stat = fs.statSync(absPath, { throwIfNoEntry: false });
        if (stat?.isDirectory()) {
          return {
            ok: false,
            error: `"${filePath}" is a directory. Use list_files instead.`,
          };
        }
        // absolute path string --> vscode Uri object
        const uri = vscode.Uri.file(absPath);
        // read the file as the raw bytes.
        const contentBytes = await vscode.workspace.fs.readFile(uri);
        // convert the bytes to a readable UTF-8 string
        const content = Buffer.from(contentBytes).toString('utf-8');
        return { ok: true, data: content };
      }

      case 'list_files': {
        const dirPath = input.path || '.';
        const absDir = path.isAbsolute(dirPath)
          ? dirPath
          : path.join(workspaceRoot, dirPath);
        const stat = fs.statSync(absDir, { throwIfNoEntry: false });
        if (!stat?.isDirectory()) {
          return { ok: false, error: `"${dirPath}" is not a directory.` };
        }
        // read all items in the directory, with metadata: file or folder
        const entries = fs.readdirSync(absDir, { withFileTypes: true });
        const names = entries
        //skip .zygote and node_modules, don't want the agent to browsing these
          .filter((e) => e.name !== '.zygote' && e.name !== 'node_modules')
        // add '/' if it is a directory, not if not, then agent could distinguish.
          .map((e) => (e.isDirectory() ? e.name + '/' : e.name));
        // join these names wtth newlines to return a string, which is easier for the agent to read and parse than a JSON array.
        return { ok: true, data: names.join('\n') };
      }

      case 'write_file': {
        const filePath = input.path;
        const content = input.content;
        if (!filePath) {
          return { ok: false, error: 'Missing required parameter: path' };
        }
        if (content === undefined) {
          return { ok: false, error: 'Missing required parameter: content' };
        }
        const absPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(workspaceRoot, filePath);
        const uri = vscode.Uri.file(absPath);
        const encoded = Buffer.from(content, 'utf-8');
        await vscode.workspace.fs.writeFile(uri, encoded);
        return { ok: true, data: `File written: ${filePath}` };
      }
      // content is the auto-generated text from the claude。
      // Yes, it currently rewrites the whole file. This is a huge limitation.


      case 'search_files': {
        const pattern = input.pattern;
        if (!pattern) {
          return { ok: false, error: 'Missing required parameter: pattern' };
        }
        // restrict to the specified glob folder or the default of all files
        const glob = input.file_glob || '**/*';
        // create a vscode relative pattern to only search within the workspace of the specified glob
        const relPattern = new vscode.RelativePattern(workspaceRoot, glob);
        // exclude irrelevant and large folders
        const exclude = '**/node_modules/**,**/.zygote/**,**/.git/**,**/dist/**';
        // find matching files, with a cap of 200 to avoid overwhelming the system if the glob is too broad
        const uris = await vscode.workspace.findFiles(relPattern, exclude, 200);
        // RegExp - built-in JavaScript class for pattern matching.
        // pattern - search string
        // "gi", g for global (find all matches, not just the first), i for case-insensitive, eg: "function myFunc" would match "function myfunc"
        const regex = new RegExp(pattern, 'gi');
        const matches: string[] = [];
        for (const uri of uris) {
          try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(bytes).toString('utf-8');
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                const rel = path.relative(workspaceRoot, uri.fsPath);
                matches.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
                if (matches.length > 50) break;
              }
              regex.lastIndex = 0;
            }
          } catch {
            // skip binary or unreadable files
          }
          if (matches.length > 50) break;
        }
        /*
        **
matches = []                          // collect results here
for each file found:
  try:
    read file as bytes                // raw file content
    convert bytes to text string      // make it readable
    split text into lines             // one string per line
    for each line:
      if line matches the regex:
        get relative path             // e.g. "src/index.ts" instead of full absolute path
        add "path:lineNum: content"   // e.g. "src/index.ts:42: const x = 1"
        stop if 50 matches            // cap results per file
      reset regex position            // needed because 'g' flag remembers last match position
  catch:
    skip file                         // binary or unreadable, ignore it
  stop if 50 matches                  // cap results overall
        */

        if (matches.length === 0) {
          return { ok: true, data: `No matches found for "${pattern}"` };
        }
        if (matches.length > 50) {
          return { ok: true, data:
            `Found more than 50 matches. Showing first 50 — use file_glob to narrow the search:\n${matches.slice(0, 50).join('\n')}` };
        }
        return { ok: true, data: matches.join('\n') };
      }

      default:
        return { ok: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
//snapshot_state, save current state as the necessarily important
//  information in one branch
//speculative_write, write in a certain branch so that the user could have discerning
//diff_branches, compare the difference between two different branches for the result
//list_branches, show the tree logic of speculative states
//...s