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

## E2E validation checklist
- Launch: Run “Design Lab: Open” from the Extension Development Host.
- Use Current: Load your current settings into the editor; verify preview updates.
- Colors: Change a color (including alpha); confirm #RRGGBBAA sync + live UI changes.
- Locate: Edits trigger a brief pulse on the related preview element.
- Tokens: Add/remove a scope; set foreground and fontStyle (bold/italic/underline/strikethrough); verify in editor + preview.
- Semantic: Add/remove a selector; set foreground/fontStyle; verify.
- Search: Filter across Colors, Tokens, and Semantic.
- Import: Load JSON/JSONC/VSIX and verify categories/rules.
- Export: JSON/CSS/VSIX; open exported files and optionally install the VSIX to test.
- Scope: Toggle `designLab.preview.applyToWorkspace` and confirm writes go to workspace or user settings accordingly.

## Quality gates
- Build: `npm run build` should complete without TypeScript errors.
- Artifacts: `out/src/extension.js`, `out/media/webview.js`, and `out/assets/colors-template.json` present.
- Runtime: Webview loads; toolbar buttons operate without errors in Dev Tools console.

## Notes
- JSON template is copied at build. If you add more assets, extend `copy-webpack-plugin` patterns in `webpack.config.js`.
- Live preview respects workspace/user scope via `designLab.preview.applyToWorkspace`.
