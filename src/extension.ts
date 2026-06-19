import * as vscode from 'vscode';
import { ZygotePanel } from './webview/ZygotePanel.js';
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

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      dbg()?.info('lifecycle', 'Opening Zygote panel', { workspaceRoot });

      const tree = loadTree(workspaceRoot);

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
        return;
      }
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

  context.subscriptions.push(openCommand, snapshotCommand, dumpTreeCommand);
}

export function deactivate(): void {
  // Clean up if needed
}
