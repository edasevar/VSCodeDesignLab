# Project Memory: VSCodeDesignLab

Date: 2025-08-16

## Tech Stack
- VS Code Extension (webview)
- TypeScript + Webpack (ts-loader)
- copy-webpack-plugin for assets

## Key Decisions
- Two-panel UI with left controls (Colors, Tokens, Semantic) and right live preview.
- Live preview writes to workbench.colorCustomizations, editor.tokenColorCustomizations (textMateRules), and editor.semanticTokenColorCustomizations (enabled + rules).
- JSON template loaded via require() and copied via webpack to out/assets.
- Scope target controlled by `designLab.preview.applyToWorkspace`.

## Commands
- designLab.open
- designLab.useCurrent
- designLab.importTheme
- designLab.export.json
- designLab.export.css
- designLab.export.vsix

## Features Implemented
- Webview UI scaffolding with tabs and search.
- Colors, Tokens, Semantic editors wiring and live preview plumbing.
- Import (JSON/JSONC/VSIX), Use Current, Start Blank logic in extension.
- Export (JSON, CSS vars, VSIX) stubs.

## Outstanding Work
- Refine Colors UI (alpha slider sync, better inputs, category performance).
- Tokens and Semantic editor enhancements (add/remove, validation, search).
- Navigation pulse mapping for more keys.
- Tests and improved docs.

## Versioning
- package.json version: 1.2.1
- CHANGELOG updated for 1.2.1

## Next Steps
1. End-to-end test imports/exports and toolbar actions (see README checklist).
2. Virtualize/optimize color list rendering if performance issues appear.
3. Add validation and better UX affordances.
