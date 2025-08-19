// Purpose: bridge webview <-> extension, handle live preview writes.
import * as vscode from "vscode";
import { applyPreview } from "./preview";
import { categories } from "./util/categories";
import { readCurrentThemeCustomizations } from "./preview";

export const createPanel = (
	panel: vscode.WebviewPanel,
	ctx: vscode.ExtensionContext
) => {
	// cache of the last payload sent from the webview so exporters can use it
	let lastModel: any | undefined;
	panel.webview.html = getHtml(panel, ctx);
	// Handle messages from webview
	panel.webview.onDidReceiveMessage(async (msg) => {
		switch (msg.type) {
			case "REQUEST_BOOT":
				panel.webview.postMessage({
					type: "BOOT",
					payload: {
						categories,
						settings: await readCurrentThemeCustomizations(),
					},
				});
				break;
			case "REQUEST_IMPORT":
				await vscode.commands.executeCommand("designLab.importTheme");
				break;
			case "REQUEST_USE_CURRENT":
				await vscode.commands.executeCommand("designLab.useCurrent");
				break;
			case "REQUEST_START_BLANK":
				await vscode.commands.executeCommand("designLab.startBlank");
				break;
			case "REQUEST_EXPORT_JSON":
				await vscode.commands.executeCommand("designLab.export.json");
				break;
			case "REQUEST_EXPORT_CSS":
				await vscode.commands.executeCommand("designLab.export.css");
				break;
			case "REQUEST_EXPORT_VSIX":
				await vscode.commands.executeCommand("designLab.export.vsix");
				break;
			case "REQUEST_SAVE_THEME":
				await vscode.commands.executeCommand("designLab.export.json");
				break;
			case "APPLY_PREVIEW":
				lastModel = msg.payload;
				await applyPreview(msg.payload);
				break;
			case "LOCATE":
				// forward to webview for pulse outline in preview DOM
				panel.webview.postMessage({ type: "LOCATE", payload: msg.payload });
				break;
		}
	});
	// helper so other commands can talk to the webview
	vscode.commands.registerCommand("vscode.postToDesignLab", (message: any) =>
		panel.webview.postMessage(message)
	);

	// expose the last model for exporters; falls back to reading current settings if not yet available
	vscode.commands.registerCommand("designLab.getLastModel", async () => {
		if (lastModel) return lastModel;
		// If no model yet, ask preview side for current settings as a basic fallback
		// Keep this minimal to avoid dependency cycles; exporters can also fallback further.
		return undefined;
	});
};

function getHtml(panel: vscode.WebviewPanel, ctx: vscode.ExtensionContext) {
	const scriptUri = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(ctx.extensionUri, "out/media/webview.js")
	);
	const styleUri = panel.webview.asWebviewUri(
		vscode.Uri.joinPath(ctx.extensionUri, "media", "style.css")
	);
	return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline' ${panel.webview.cspSource}; script-src ${panel.webview.cspSource};"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <link rel="stylesheet" href="${styleUri}">
    <title>VS Code Design Lab</title>
  </head>
  <body>
    <div id="app" class="lab">
      <aside class="left">
				<div class="toolbar">
		  <button id="btn-use" title="Use Current Settings" aria-label="Use current settings">Use Current</button>
          <button id="btn-blank" title="Start Blank">Blank</button>
		  <button id="btn-undo" title="Undo (Ctrl+Z)" aria-label="Undo">Undo</button>
		  <button id="btn-redo" title="Redo (Ctrl+Y)" aria-label="Redo">Redo</button>
          <button id="btn-import" title="Import Theme">Import</button>
          <div style="flex:1"></div>
					<span id="status" aria-live="polite" title="Edit status"></span>
		  <button id="btn-export-json" title="Export JSON" aria-label="Export JSON">JSON</button>
		  <button id="btn-export-css" title="Export CSS Vars" aria-label="Export CSS variables">CSS</button>
		  <button id="btn-export-vsix" title="Export VSIX" aria-label="Export VSIX">VSIX</button>
        </div>
        <div class="tabs">
          <button data-tab="colors" class="tab active">Colors</button>
          <button data-tab="tokens" class="tab">Tokens</button>
          <button data-tab="semantic" class="tab">Semantic</button>
        </div>
	<input id="search" placeholder="Search colors/tokens…" aria-label="Search colors, tokens, and semantic rules" />
        <div id="panel-colors" class="panel active"></div>
        <div id="panel-tokens" class="panel"></div>
        <div id="panel-semantic" class="panel"></div>
      </aside>
      <main class="right">
        <div class="preview-tabs">
          <button data-demo="editor" class="ptab active">Editor</button>
          <button data-demo="panels" class="ptab">Panels</button>
          <button data-demo="problems" class="ptab">Problems</button>
          <button data-demo="terminal" class="ptab">Terminal</button>
          <button data-demo="notifications" class="ptab">Notifications</button>
          <button data-demo="statusbar" class="ptab">Status Bar</button>
          <button data-demo="lists" class="ptab">Lists/Tabs</button>
        </div>
        <div id="preview"></div>
      </main>
    </div>
    <script src="${scriptUri}"></script>
  </body>
  </html>`;
}
