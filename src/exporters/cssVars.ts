// Purpose: export colors as CSS variables for external use.
import * as vscode from "vscode";
export async function exportCssVars() {
	const color =
		(vscode.workspace
			.getConfiguration()
			.get("workbench.colorCustomizations") as any) || {};
	const lines = [
		":root {",
		...Object.entries(color).map(
			([k, v]) => `  --${k.replace(/\./g, "-")}: ${v};`
		),
		"}",
	];
	const uri = await vscode.window.showSaveDialog({
		filters: { CSS: ["css"] },
		saveLabel: "Save CSS Variables",
	});
	if (!uri) return;
	await vscode.workspace.fs.writeFile(
		uri,
		Buffer.from(lines.join("\n"), "utf8")
	);
	vscode.window.showInformationMessage("CSS variables exported.");
}
