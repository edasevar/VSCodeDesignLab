# Changelog

All notable changes to this project will be documented in this file.

## 1.9.0 - 2025-08-18
### Added
- Save Theme button in preview title bar (triggers Export JSON).
- Category icons, card-style rows, and Advanced toggles for Tokens and Semantic editors.
- Richer live preview: breadcrumbs, dirty dot and close icons on tabs, minimap, and bottom panel (Problems/Output/Terminal).

### Changed
- Descriptions now truncate with More/Less toggles for readability.
- Visual polish across controls, buttons, and preview for a VSCodeThemes.one-like feel.

### Fixed
- Export JSON now pulls the live in-memory model (fallback to settings) to ensure accurate exports.

## 1.6.0 - 2025-08-18
### Changed
- Documentation and project memory synchronized to package.json version 1.6.0.
- Minor UI/preview polish and accessibility updates.

## 1.4.0 - 2025-08-18
### Changed
- Full UI and live preview rewrite for maximum visual appeal.
- Added palette row: all theme colors shown as large preview chips at the top of the Colors panel.
- Improved color chip tooltips and accessibility.
- Live preview now uses a modern, VS Code-like frame with tabs, titlebar, and statusbar for a more realistic look.
- Enhanced overall UI polish and usability.

## 1.3.0 - 2025-08-17
### Added
- Collapsible color categories with scrollable lists and global search that auto-expands matches.
- Richer live preview demos (Editor with gutter/selection/cursor, Panels, Problems, Terminal, Notifications, Status Bar, Lists/Tabs) bound to VS Code theme variables.
- Token color visualization in the editor demo.

### Changed
- Single webview panel reused across actions (no duplicate tabs on Use Current).
- Use Current now reads the active theme definition and merges in settings overrides.
- UI state persistence now includes left tab/preview tab/search, category open state, and left scroll position.

### Fixed
- Robust handling of token/semantic payload shapes from settings when using Use Current.
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
