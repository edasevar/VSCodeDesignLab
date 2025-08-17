// Purpose: import from JSON/JSONC theme structures into Design Lab payload.
export function importFromJSON(theme: any) {
	return {
		colors: theme.colors || {},
		tokenColors: normalizeTextMate(theme.tokenColors),
		semanticTokens:
			theme.semanticTokenColors || theme.semanticHighlighting
				? theme.semanticTokenColors || {}
				: {},
	};
}
export function importFromJSONC(obj: any) {
	return importFromJSON(obj);
}

function normalizeTextMate(input: any): any[] {
	if (!Array.isArray(input)) return [];
	return input.map((r) => ({
		scope: r.scope,
		settings: {
			foreground: r.settings?.foreground,
			fontStyle: r.settings?.fontStyle, // allow bold/italic/underline/strikethrough combos like "bold italic underline"
		},
	}));
}
