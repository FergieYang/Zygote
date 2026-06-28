/**
  * there are two different programs here:
  * A. Extension-host code: source of src,  built by tsc of the compile
  * output as the output of node js,
  * can use vsc api, fs and paths.
  * B. Webview side code: src of webview-ui, built by vite, output as broswer bundle,
  * run in sandboxed bundle and can use react dom and window
  * src/extension.ts          (activate — VS Code starts here)
      │ creates
      ▼
src/webview/ZygotePanel.ts:87
      │   this.panel.webview.html = getWebviewHtml(this.panel.webview, this.extensionUri)
      │ calls
      ▼
src/webview/html.ts        ← returns an HTML *string*
      │   that string contains:  <script src="dist/webview/assets/main.js">
      **** html.ts produces the page -> the page contains a pointer to 
      **** the asset
      │ the browser frame then loads
      **** loads the page follow the page's pointer to the asset
      ▼
dist/webview/assets/main.js   ← compiled output of...
      ▲
webview-ui/src/main.tsx → App.tsx → components/*   (built by vite.config.ts)
      *** basically run it
 */
/**
 * vite is a build tool, take your reaction source and compiles it into plain broswer-runnable js files
 * brower cannnot run .tsx file directly
 * the bundle here mean the output of the vite
 */
import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Get the HTML content for the Zygote webview.
 * Loads the Vite-built React app from dist/webview/.
 * P.S.: The live vscode.webview object owned by the ZygotePanel
 * P.S.: extensionUri is a vscode.Uri pointing at the root folder where your extension is installed
 * on disk.
 * P.S.: It's just extensionUri + /dist/webview
 */
export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const distPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');

  // The location of the manifest path is deterministic.
  // The file only exists if vite build has run with manifest output enabled.
  // contents are not deterministic.
  const manifestPath = path.join(
    extensionUri.fsPath,
    'dist',
    'webview',
    '.vite',
    'manifest.json'
  );

  let scriptUri: vscode.Uri;
  // Safe placeholder: empty means now no rending as current, 
  // only get overwritten when the real css file is found
  let styleTag = '';

  if (fs.existsSync(manifestPath)) {
    // Production: load from Vite build manifest
    // JOSN.parse() turns into a real JavaScript object you can index
    // 'utf-8' decodes the bytes as the text
     const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    // The code only needs single starting file
    // there are two candidates:
    // 1. HTML-driven build -> keyed as 'index.html'
    // 2. JS-driven build -> keyed as 'src/main.tsx'
    const entry = manifest['index.html'] ?? manifest['src/main.tsx'];

    if (entry) {
      // if the entry is found, get the js file and convert it to a webview URI
      const jsFile = entry.file;
      scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(distPath, jsFile)
      );
      // additionally if css is present, add a <link> tag to the HTML head
      if (entry.css && entry.css.length > 0) {
        const cssFile = entry.css[0];
        const cssUri = webview.asWebviewUri(
          vscode.Uri.joinPath(distPath, cssFile)
        );
        styleTag = `<link rel="stylesheet" href="${cssUri}">`;
      }
    // else if the entry is not found, fallback to a guess
    } else {
      scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(distPath, 'assets', 'index.js')
      );
    }
  // else if the manifest file does not exist, fallback to a guess
  } else {
    // Fallback: guess the filename
    scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'assets', 'index.js')
    );
  }

  /*
  getWebviewHtml always outputs an HTML page pointing at one JS bundle; 
  the manifest+entry exist to look up the correct bundle filename, 
  and assets/index.js is only the fallback guess used when that lookup fails.
  */

  const nonce = getNonce();
  // building one big HTML string
  // 
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
//extension-host process (Node)          webview (browser frame)
//─────────────────────────────         ──────────────────────
//getWebviewHtml() runs
//  └─ calls getNonce()  ← generated HERE
//  └─ bakes nonce into the HTML string
//        │  sends finished HTML ──────▶  receives page with nonce already in it
//                                         browser enforces it; can't change it


//the approved origin VS Code serves webview files from — 
// put it in the CSP so your own assets aren't blocked.