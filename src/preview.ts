// Purpose: write live preview to VS Code settings, respecting workspace/user target.
import * as vscode from "vscode";
import * as path from "path";
import { parseJSONC } from "./importers/jsonc";
import { importFromJSON, importFromJSONC } from "./importers/jsonTheme";

export type PreviewPayload = {
	colors?: Record<string, string>;
	tokenColors?: any[]; // TextMate rules
	semanticTokens?: {
		[selector: string]: { foreground?: string; fontStyle?: string };
	};
};

export async function readCurrentThemeCustomizations() {
	const color =
		vscode.workspace.getConfiguration().get("workbench.colorCustomizations") ||
		{};
	const token =
		vscode.workspace
			.getConfiguration()
			.get("editor.tokenColorCustomizations") || {};
	const sem =
		vscode.workspace
			.getConfiguration()
			.get("editor.semanticTokenColorCustomizations") || {};
	return { colors: color, tokenColors: token, semanticTokens: sem };
}

async function readActiveThemeDefinition(): Promise<
	{ colors: any; tokenColors: any[]; semanticTokens: any } | undefined
> {
	const themeLabel = vscode.workspace
		.getConfiguration("workbench")
		.get<string>("colorTheme");
	if (!themeLabel) return undefined;
	for (const ext of vscode.extensions.all) {
		const pkg: any = ext.packageJSON;
		const themes: any[] = pkg?.contributes?.themes || [];
		const found = themes.find((t) => t?.label === themeLabel);
		if (!found) continue;
		try {
			const themePath = path.join(ext.extensionPath, found.path);
			const buf = await vscode.workspace.fs.readFile(
				vscode.Uri.file(themePath)
			);
			const text = Buffer.from(buf).toString("utf8");
			// Try JSONC parsing first
			let data: any;
			try {
				data = parseJSONC(text);
			} catch {
				data = JSON.parse(text);
			}
			const payload = importFromJSON(data);
			return payload; // { colors, tokenColors, semanticTokens }
		} catch {
			// ignore and continue
		}
	}
	return undefined;
}

function coerceRulesArray(x: any): any[] {
	if (Array.isArray(x)) return x;
	if (x && Array.isArray(x.textMateRules)) return x.textMateRules;
	return [];
}
function coerceSemRulesMap(
	x: any
): Record<string, { foreground?: string; fontStyle?: string }> {
	if (x && typeof x === "object") {
		if (x.rules && typeof x.rules === "object") return x.rules;
		const { enabled, ...rest } = x as any;
		return rest && Object.keys(rest).length ? (rest as any) : {};
	}
	return {};
}

export async function readActiveThemeOrSettingsCombined(): Promise<PreviewPayload> {
	const settings = await readCurrentThemeCustomizations();
	const active = await readActiveThemeDefinition();
	const colors = {
		...(active?.colors || {}),
		...((settings.colors as any) || {}),
	};
	const tokenActive = active?.tokenColors || [];
	const tokenSettings = coerceRulesArray(settings.tokenColors);
	// settings first so they win where scopes overlap in our merge
	const tokenColors = [...tokenSettings, ...tokenActive];
	const semActive = active?.semanticTokens || {};
	const semSettings = coerceSemRulesMap(settings.semanticTokens);
	const semanticTokens = { ...semActive, ...semSettings };
	return { colors, tokenColors, semanticTokens };
}

export async function applyPreview(payload: PreviewPayload) {
	const workspace = vscode.workspace
		.getConfiguration("designLab")
		.get<boolean>("preview.applyToWorkspace", true);
	const target = workspace
		? vscode.ConfigurationTarget.Workspace
		: vscode.ConfigurationTarget.Global;

	if (payload.colors) {
		await vscode.workspace
			.getConfiguration()
			.update("workbench.colorCustomizations", payload.colors, target);
	}
	if (payload.tokenColors) {
		// Merge into { textMateRules: [...] } form
		await vscode.workspace
			.getConfiguration()
			.update(
				"editor.tokenColorCustomizations",
				{ textMateRules: payload.tokenColors },
				target
			);
	}
	if (payload.semanticTokens) {
		await vscode.workspace
			.getConfiguration()
			.update(
				"editor.semanticTokenColorCustomizations",
				{ enabled: true, rules: payload.semanticTokens },
				target
			);
	}
}

export function clearPreview() {
	// Keep user’s settings; no automatic cleanup here.
}
