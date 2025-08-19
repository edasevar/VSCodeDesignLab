# VSCodeDesignLab — Project Memory

Last updated: 2025-08-18

## User Info

Keep contact and preference details to speed up collaboration.

### GitHub
- Username: edasevar
- Primary repo(s): edasevar/vscodedesignlab
- Default branch: main
- PR style: smal
- Issue tracker: <url>

### Preferences
- Code style: <notes>
- PRs: <size/review expectations>
- Documentation: <level of detail>

### Access
- Secrets/Keys: <where/how managed>
- Permissions: <who can deploy/merge>

---

## Table of Contents
- [User Info](#user-info)
- [Project Brief](#project-brief)
- [Project Context](#project-context)
- [Repository Visual](#repository-visual)
- [Active Context](#active-context)
- [Decision Log](#decision-log)
- [Progress](#progress)
- [System Patterns](#system-patterns)
- [Architect Notes](#architect-notes)

---

# Project Brief

- Project: VSCodeDesignLab
- Date: 2025-08-18
- Version: 1.6.0

### Goal
Ship a production-ready VS Code theme editor (like themes.vscode.one) with two-panel UI, live preview, import/export, navigation, and template-backed descriptions.

### Scope
- In:
  - Colors (categorized), Tokens, Semantic editing
  - Live preview (workspace/user scope)
  - Import JSON/JSONC/VSIX, Use Current, Start Blank
  - Export JSON, CSS variables, VSIX
- Out:
  - Online gallery hosting; multi-theme management

### Risks & Assumptions
- Risks: Webview performance with large categories; user confusion with fontStyle combinations; VSIX packaging edge cases
- Assumptions: Template is authoritative for color keys and descriptions
- Mitigations: Virtualize color list if needed; validate inputs; minimal VSIX scaffold

### Links
- Repo: local workspace

---

## Project Context

Use this section to capture the practical setup and constraints for the project.

### Repository & Workspace
- Monorepo/Repo: edasevar/vscode-design-lab
- Workspace root: E:/ravin/Projects/VSCodeDesignLab
- Packages/Apps: <list>

### Environments
- Dev: <url/notes>
- Stage: <url/notes>
- Prod: <url/notes>

### Tech Stack
- Extension: VS Code API, TypeScript
- Webview: TypeScript, DOM, CSS
- Build: Webpack + ts-loader + copy-webpack-plugin

### Tooling & Scripts
- Package manager: npm
- Scripts: build, watch, dev, package

### Conventions
- Versioning: SemVer
- Commits: Conventional Commits (suggested)

### Constraints & Compliance
- Constraints: <performance/security/legal>
- Compliance: <licenses/PII/GDPR/etc>

### Commands
- designLab.open
- designLab.useCurrent
- designLab.importTheme
- designLab.export.json
- designLab.export.css
- designLab.export.vsix

- Palette row: all theme colors as large preview chips at top of Colors panel.
- Modernized live preview: VS Code-like frame, tabs, titlebar, and statusbar.
### Features Implemented
- Webview UI scaffolding with tabs, search, and toolbar actions (Use Current, Import, Export).
- Colors, Tokens, and Semantic editors with live preview plumbing and state persistence.
- Import (JSON/JSONC/VSIX), Use Current, Start Blank flows; Export (JSON, CSS vars, VSIX) stubs.
- Modernized live preview: VS Code-like frame (tabs, titlebar, statusbar) and token visualization.

- Refine Colors UI (alpha slider sync, better inputs, category performance).
- Tokens and Semantic editor enhancements (add/remove, validation, search).
- Navigation pulse mapping for more keys.
- Tests and improved docs.
### Outstanding Work
 - Refine Colors UI (alpha slider sync, better inputs, category performance).
 - Tokens and Semantic editor enhancements (add/remove, validation, search).
 - Navigation pulse mapping for more keys.
 - Tests and improved docs.

---

## 2025-08-18
- Synchronized README, CHANGELOG, and project memory to package.json version 1.6.0.
- Noted full UI/preview rewrite and subsequent minor polish.
- Outstanding work: refine Colors UI, improve Tokens/Semantic editors, navigation pulse mapping, tests and docs.

---

## Repository Visual

High-level view of the repo to speed up onboarding and navigation.

### Directory Tree (paste or generate)
```mermaid
flowchart LR
**VSCodeDesignLab** --- 1 & 2 & 3 & 4 & 5 & 6 & 7 & 8
1[node_modules/]
2[package.json]
3[tsconfig.json]
4[webpack.config.js]
5[CHANGELOG & README]
subgraph 6[**assets/**]
	colors-template.json
end
subgraph 7[**media/**]
	designLab.html
	previewDemos.ts	
	a[style.css]
	webview.ts
end
subgraph 8[**src/**]
	extension.ts
	messaging.ts
	preview.ts
end
8 ---- 9 & 10 & 11
	subgraph 9[exporters/]
		cssVars.ts
		jsonTheme.ts
		vsix.ts
	end
	subgraph 10[importers/]
		jsonc.ts
		b[jsonTheme.ts]
		c[vsix.ts]
	end
	subgraph 11[util/]
		categories.ts
		schema.ts
		vscodeConfig.ts
	end
```

---

## Active Context

- Today: 2025-08-18
- Workspace: E:/ravin/Projects/VSCodeDesignLab

### Now
- [x] Scaffold UI and messaging
- [x] Import/export wiring
- [x] Live preview writing
- [ ] Colors alpha slider and enhanced search

### Recent
- Added toolbar (Use Current, Blank, Import, Export) and Start Blank command.

### Next
1. End-to-end test imports/exports and toolbar actions (see README checklist).
2. Virtualize/optimize color list rendering if performance issues appear.
3. Add validation and better UX affordances.

### Blockers
- …

### Quick Links
- Issue/PR board: <url>
- Docs/Spec: <url>

### Notes
- Decisions go to Decision Log
- Update Progress weekly

---

## Decision Log

- Two-panel UI with left controls (Colors, Tokens, Semantic) and right live preview.
- Live preview writes to workbench.colorCustomizations, editor.tokenColorCustomizations (textMateRules), and editor.semanticTokenColorCustomizations (enabled + rules).
- JSON template loaded via require() and copied via webpack to out/assets.
- Scope target controlled by `designLab.preview.applyToWorkspace`.
- Palette row and VS Code-like frame added in August 2025 for maximum visual appeal.


### 2025-08-16 — Asset loading + build
- Context: TS complained about importing JSON and ensuring availability at runtime
- Decision: Use `require()` in extension code; copy asset via `copy-webpack-plugin`
- Consequences: Simple and robust; no ESM complications

### 2025-08-16 — Live preview scope
- Context: Users may want workspace vs user settings
- Decision: Add `designLab.preview.applyToWorkspace` (default true)

---

## Progress

### Weekly Summary
- Week of <YYYY-MM-DD>
  - Done: …
  - Next: …
  - Risks: …

### Metrics (optional)
- Build status: <badge/link>
- Test coverage: <%/link>
- Performance: <TTI/CLS/etc>

---

## System Patterns

### Architecture
- Overview: <diagram/description>
- Key components: <list>

### Data Contracts
- Schema: <links/files>
- APIs: <endpoints/methods>

### Standards & Conventions
- Code style: <linters/formatters>
- Error handling: <policy>
- Logging: <levels/structure>

### Testing Strategy
- Unit: <framework>
- Integration: <scope>
- E2E: <tool>

### Operations
- Environments: <dev/stage/prod>
- Deploy: <process>
- Monitoring: <dashboards/alerts>

---

## Architect Notes

Use this for deeper technical thinking, ADRs, and diagrams.

### Context
- Problem: …
- Constraints: …

### Options
- Option A — <name>
  - Pros: …
  - Cons: …
- Option B — <name>
  - Pros: …
  - Cons: …

### Decision
- Two-panel UI with left controls (Colors, Tokens, Semantic) and right live preview.
- Live preview writes to workbench.colorCustomizations, editor.tokenColorCustomizations (textMateRules), and editor.semanticTokenColorCustomizations (enabled + rules).
- JSON template loaded via require() and copied via webpack to out/assets.
- Scope target controlled by `designLab.preview.applyToWorkspace`.
- Palette row and VS Code-like frame added in August 2025 for maximum visual appeal.

### Diagram
```mermaid
flowchart LR
  A[Start] --> B{Decision}
  B -->|A| C[Path A]
  B -->|B| D[Path B]
```

### Follow-ups
- [ ] Task 1
- [ ] Task 2
