// Purpose: import from JSON/JSONC theme structures into Design Lab payload.
export function importFromJSON(theme: any) {
	return {
		colors: theme.colors || {},
		tokenColors: normalizeTextMate(theme.tokenColors),
		// If semanticTokenColors is provided, use it; otherwise empty map.
		// semanticHighlighting is a boolean flag in some themes, not the rules map.
		semanticTokens: theme.semanticTokenColors || {},
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
