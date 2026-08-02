import * as vscode from 'vscode';
import { ZygotePanel } from './webview/ZygotePanel.js';
// the tool of read the tree from the disk
import { loadTree } from './state/persistence.js';
import { initDebugLogger, dbg } from './debug/logger.js';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Zygote extension is now active');

  initDebugLogger(context.extensionUri.fsPath);
  dbg()?.info('lifecycle', 'Zygote extension activated');

  const openCommand = vscode.commands.registerCommand(
    'zygote.open',
    () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
          'Zygote requires an open workspace folder.'
        );
        return;
      }
      // the first opened folder
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      dbg()?.info('lifecycle', 'Opening Zygote panel', { workspaceRoot });
      // reads/repairs tree.json from disk
      const tree = loadTree(workspaceRoot);
      // builds the webview with that tree passed in
      ZygotePanel.createOrShow(
        context.extensionUri,
        context.secrets,
        tree
      );
    }
  );

  const snapshotCommand = vscode.commands.registerCommand(
    'zygote.captureSnapshot',
    () => {
      const panel = ZygotePanel.currentPanel;
      if (!panel) {
        vscode.window.showWarningMessage('Zygote panel is not open.');
        // early exist
        return;
      }
      // extension.ts (command) → ZygotePanel (owns the live state) → debug logger (writes the file).
      const snapshotPath = panel.captureDebugSnapshot();
      vscode.window.showInformationMessage(`Zygote debug snapshot saved to ${snapshotPath}`);
    }
  );

  const dumpTreeCommand = vscode.commands.registerCommand(
    'zygote.dumpTree',
    () => {
      const panel = ZygotePanel.currentPanel;
      if (!panel) {
        vscode.window.showWarningMessage('Zygote panel is not open.');
        return;
      }
      const dumpPath = panel.dumpTree();
      vscode.window.showInformationMessage(`Zygote tree dump saved to ${dumpPath}`);
    }
  );
  // cleanup bucket: VS Code auto-disposes these when the extension deactivates

  context.subscriptions.push(openCommand, snapshotCommand, dumpTreeCommand);
}
// nothing to do: command disposal is handled by context.subscriptions
export function deactivate(): void {
  // Clean up if needed
}
