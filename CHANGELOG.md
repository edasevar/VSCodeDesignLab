# Changelog

All notable changes to this project will be documented in this file.

## 1.2.1 - 2025-08-16
### Docs
- Added E2E validation checklist and clarified development steps in README.
- Recorded build verification status and artifact list.

## 1.2.0 - 2025-08-16
### Added
- In-webview toolbar: Use Current, Blank, Import, Export (JSON/CSS/VSIX).
- Command: Design Lab: Start Blank.
- Colors panel alpha slider synced with #RRGGBBAA.
### Changed
- Tokens/Semantic editors: remove buttons and fontStyle checkboxes with normalized fontStyle handling.
### Build
- Ensure color template asset is copied during build for runtime require.

### Added
- Two-panel webview UI (`media/designLab.html`, `media/style.css`, `media/webview.ts`).
- Colors, Tokens, and Semantic editors with live preview.
- Import (VSIX/JSON/JSONC), Use Current, Start Blank flows.
- Export as JSON theme, CSS variables, and VSIX.
- “Locate in Preview” pulse and category-based color editing from template.

### Changed
- Switched JSON template import to `require` for stability.
- Build now copies `assets/colors-template.json` via `copy-webpack-plugin`.

### Fixed
- Removed redundant activation event from `package.json`.
