// Purpose: import a theme from a .vsix (zip). Finds contributes.themes[].path and loads it.
import JSZip from "jszip";

export async function importFromVSIX(buf: Uint8Array) {
	const zip = await JSZip.loadAsync(buf);
	const manifestStr = await zip.file("extension/package.json")?.async("string");
	if (!manifestStr) throw new Error("VSIX missing extension/package.json");
	const manifest = JSON.parse(manifestStr);
	const themeRel = manifest?.contributes?.themes?.[0]?.path;
	if (!themeRel) throw new Error("No theme entry in VSIX");
	const themePath = `extension/${themeRel.replace(/^\.\//, "")}`;
	const themeStr = await zip.file(themePath)?.async("string");
	if (!themeStr) throw new Error("Theme file not found in VSIX");
	const theme = JSON.parse(themeStr);
	return {
		colors: theme.colors || {},
		tokenColors: Array.isArray(theme.tokenColors)
			? theme.tokenColors.map((r: any) => ({
					scope: r.scope,
					settings: {
						foreground: r.settings?.foreground,
						fontStyle: r.settings?.fontStyle,
					},
			  }))
			: [],
		semanticTokens: theme.semanticTokenColors || {},
	};
}
