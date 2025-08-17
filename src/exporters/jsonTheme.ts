// Purpose: export current in-memory model (requested from webview) as theme JSON and save to disk.
import * as vscode from "vscode";

export async function exportThemeJSON() {
	const data = await vscode.commands.executeCommand<any>(
		"vscode.postToDesignLab",
		{ type: "REQUEST_MODEL" }
	);
	// webview will respond with a message, but to keep flow simple we ask user to pick save location and the webview will send payload back via APPLY_PREVIEW echo
	const uri = await vscode.window.showSaveDialog({
		filters: { "JSON Theme": ["json"] },
		saveLabel: "Save Theme JSON",
	});
	if (!uri) return;
	const theme = buildTheme(await readModel());
	await vscode.workspace.fs.writeFile(
		uri,
		Buffer.from(JSON.stringify(theme, null, 2), "utf8")
	);
	vscode.window.showInformationMessage("Theme JSON exported.");
}

// This is a light shim. In practice you’d keep the model in the extension host or request it from the webview via a promise bridge.
async function readModel(): Promise<any> {
	// In MVP, reuse current settings as the source of truth:
	const color =
		vscode.workspace.getConfiguration().get("workbench.colorCustomizations") ||
		{};
	const token =
		(vscode.workspace
			.getConfiguration()
			.get("editor.tokenColorCustomizations") as any) || {};
	const sem =
		(vscode.workspace
			.getConfiguration()
			.get("editor.semanticTokenColorCustomizations") as any) || {};
	return {
		colors: color,
		textMateRules: token?.textMateRules || [],
		semanticTokens: sem?.rules || {},
	};
}

function buildTheme(m: any) {
	return {
		$schema: "vscode://schemas/color-theme",
		name: "Design Lab Theme",
		type: "dark",
		colors: m.colors,
		tokenColors: m.textMateRules,
		semanticTokenColors: m.semanticTokens,
	};
}
