// Purpose: create a minimal runnable VSIX with your theme.
import * as vscode from "vscode";
import JSZip from "jszip";

export async function exportVsix() {
	const color =
		(vscode.workspace
			.getConfiguration()
			.get("workbench.colorCustomizations") as any) || {};
	const token =
		(vscode.workspace
			.getConfiguration()
			.get("editor.tokenColorCustomizations") as any) || {};
	const sem =
		(vscode.workspace
			.getConfiguration()
			.get("editor.semanticTokenColorCustomizations") as any) || {};

	const theme = {
		$schema: "vscode://schemas/color-theme",
		name: "Design Lab Theme",
		type: "dark",
		colors: color,
		tokenColors: token?.textMateRules || [],
		semanticTokenColors: sem?.rules || {},
	};

	const zip = new JSZip();
	zip.file(
		"extension/package.json",
		JSON.stringify(
			{
				name: "design-lab-theme",
				displayName: "Design Lab Theme",
				version: "0.1.0",
				engines: { vscode: "^1.88.0" },
				contributes: {
					themes: [
						{
							label: "Design Lab Theme",
							uiTheme: "vs-dark",
							path: "./themes/design-lab.json",
						},
					],
				},
			},
			null,
			2
		)
	);
	zip.file("extension/themes/design-lab.json", JSON.stringify(theme, null, 2));

	const uri = await vscode.window.showSaveDialog({
		filters: { VSIX: ["vsix"] },
		saveLabel: "Save VSIX",
	});
	if (!uri) return;
	const buf = await zip.generateAsync({ type: "uint8array" });
	await vscode.workspace.fs.writeFile(uri, buf);
	vscode.window.showInformationMessage("VSIX exported.");
}
