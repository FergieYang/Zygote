import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Get the HTML content for the Zygote webview.
 * Loads the Vite-built React app from dist/webview/.
 */
export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const distPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');

  // Try to load the Vite manifest to find the correct asset filenames
  const manifestPath = path.join(
    extensionUri.fsPath,
    'dist',
    'webview',
    '.vite',
    'manifest.json'
  );

  let scriptUri: vscode.Uri;
  let styleTag = '';

  if (fs.existsSync(manifestPath)) {
    // Production: load from Vite build manifest
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const entry = manifest['index.html'] ?? manifest['src/main.tsx'];

    if (entry) {
      const jsFile = entry.file;
      scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(distPath, jsFile)
      );

      if (entry.css && entry.css.length > 0) {
        const cssFile = entry.css[0];
        const cssUri = webview.asWebviewUri(
          vscode.Uri.joinPath(distPath, cssFile)
        );
        styleTag = `<link rel="stylesheet" href="${cssUri}">`;
      }
    } else {
      scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(distPath, 'assets', 'index.js')
      );
    }
  } else {
    // Fallback: guess the filename
    scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'assets', 'index.js')
    );
  }

  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}';
    font-src ${webview.cspSource};
    img-src ${webview.cspSource} data:;
  ">
  <title>Zygote</title>
  ${styleTag}
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
