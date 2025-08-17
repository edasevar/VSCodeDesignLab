// Purpose: extension entrypoint; opens Design Lab, wires import/export, and applies live preview updates.
import * as vscode from "vscode";
import { createPanel } from "./messaging";
import {
	applyPreview,
	clearPreview,
	readCurrentThemeCustomizations,
} from "./preview";
import { importFromJSON, importFromJSONC } from "./importers/jsonTheme";
import { parseJSONC } from "./importers/jsonc";
import { importFromVSIX } from "./importers/vsix";
import { exportThemeJSON } from "./exporters/jsonTheme";
import { exportCssVars } from "./exporters/cssVars";
import { exportVsix } from "./exporters/vsix";

export function activate(ctx: vscode.ExtensionContext) {
	const open = vscode.commands.registerCommand("designLab.open", () => {
		const panel = vscode.window.createWebviewPanel(
			"designLab",
			"VS Code Design Lab",
			vscode.ViewColumn.Active,
			{ enableScripts: true, retainContextWhenHidden: true }
		);
		createPanel(panel, ctx);
	});

	const startBlank = vscode.commands.registerCommand(
		"designLab.startBlank",
		async () => {
			await vscode.commands.executeCommand("designLab.open");
			vscode.commands.executeCommand("vscode.postToDesignLab", {
				type: "LOAD_IMPORTED",
				payload: { colors: {}, tokenColors: [], semanticTokens: {} },
			});
		}
	);

	const useCurrent = vscode.commands.registerCommand(
		"designLab.useCurrent",
		async () => {
			const current = await readCurrentThemeCustomizations();
			// Send to any open webview
			vscode.window.visibleTextEditors; // noop; panel messaging handles broadcast
			vscode.commands.executeCommand("designLab.open").then(() => {
				vscode.commands.executeCommand("vscode.postToDesignLab", {
					type: "LOAD_CURRENT",
					payload: current,
				});
			});
		}
	);

	const importTheme = vscode.commands.registerCommand(
		"designLab.importTheme",
		async () => {
			const picked = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectMany: false,
				filters: {
					"All Supported": ["json", "jsonc", "vsix"],
					"Theme JSON": ["json", "jsonc"],
					VSIX: ["vsix"],
				},
			});
			if (!picked?.[0]) {
				return;
			}
			const uri = picked[0];
			const buf = await vscode.workspace.fs.readFile(uri);
			let payload: any;
			if (uri.fsPath.endsWith(".vsix")) payload = await importFromVSIX(buf);
			else if (uri.fsPath.endsWith(".jsonc")) {
				const text = Buffer.from(buf).toString("utf8");
				const obj = parseJSONC(text);
				payload = importFromJSONC(obj);
			} else {
				const text = Buffer.from(buf).toString("utf8");
				const obj = JSON.parse(text);
				payload = importFromJSON(obj);
			}

			vscode.commands.executeCommand("designLab.open").then(() => {
				vscode.commands.executeCommand("vscode.postToDesignLab", {
					type: "LOAD_IMPORTED",
					payload,
				});
			});
		}
	);

	const exportJson = vscode.commands.registerCommand(
		"designLab.export.json",
		async () => exportThemeJSON()
	);
	const exportCss = vscode.commands.registerCommand(
		"designLab.export.css",
		async () => exportCssVars()
	);
	const exportVsx = vscode.commands.registerCommand(
		"designLab.export.vsix",
		async () => exportVsix()
	);

	ctx.subscriptions.push(
		open,
		startBlank,
		useCurrent,
		importTheme,
		exportJson,
		exportCss,
		exportVsx
	);
}

export function deactivate() {
	clearPreview();
}
