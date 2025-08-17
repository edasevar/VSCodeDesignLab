# VS Code Design Lab

Two-panel theme editor for VS Code. Edit Colors, Tokens, and Semantic tokens with a live preview. Import existing themes (JSON/JSONC/VSIX), use your current settings, or start blank. Export as JSON theme, CSS variables, or VSIX.

## Features
- Two-panel UI: left controls (tabs: Colors, Tokens, Semantic); right live preview (Editor, Panels, Problems, Terminal, Notifications, Status Bar, Lists/Tabs).
- Colors: categorized from `assets/colors-template.json`; swatches, hex input (#RRGGBB or #RRGGBBAA) with alpha slider, and descriptions; “Locate in Preview”.
- Tokens: flat rules (scope, foreground, fontStyle checkboxes: bold/italic/underline/strikethrough); add/remove rules.
- Semantic: flat map; edit foreground + fontStyle checkboxes; add/remove selectors.
- Search: global filter for keys/rules/tokens.
- Import: Use Current, Blank, JSON/JSONC (JSONC safe parser), VSIX.
- Export: JSON theme, CSS variables, VSIX (minimal, runnable).
- Live preview: writes to workbench.colorCustomizations, editor.tokenColorCustomizations (textMateRules), and editor.semanticTokenColorCustomizations (enabled + rules).
- Workspace/User scope: `designLab.preview.applyToWorkspace` controls target.

## Commands
- Design Lab: Open (`designLab.open`)
- Design Lab: Start Blank (`designLab.startBlank`)
- Design Lab: Use Current Settings (`designLab.useCurrent`)
- Design Lab: Import Theme (JSON / JSONC / VSIX) (`designLab.importTheme`)
- Design Lab: Export JSON (`designLab.export.json`)
- Design Lab: Export CSS Variables (`designLab.export.css`)
- Design Lab: Export VSIX (`designLab.export.vsix`)

## Development
1. Install dependencies and build.
2. Press F5 to launch the Extension Development Host.
3. Run “Design Lab: Open”.
4. Use the in-webview toolbar to Import/Use Current/Blank or Export JSON/CSS/VSIX.

```bash
npm ci
npm run build
```

Watch mode:

```bash
npm run dev
```

## Notes
- JSON template is copied at build. If you add more assets, extend `copy-webpack-plugin` patterns in `webpack.config.js`.
- Live preview respects workspace/user scope via `designLab.preview.applyToWorkspace`.
