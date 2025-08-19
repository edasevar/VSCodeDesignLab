// Purpose: render left controls (Colors/Tokens/Semantic), wire inputs to extension via APPLY_PREVIEW, implement locate pulse, and build right demos.
declare const acquireVsCodeApi: any;
// restored state placeholder
let restoredModel: any | undefined;
let restoredUI:
	| {
			leftTab?: string;
			previewTab?: string;
			search?: string;
			openCats?: Record<string, boolean>;
			leftScroll?: number;
	  }
	| undefined;
const vscode = acquireVsCodeApi();
// try restore
try {
	const saved = vscode.getState && vscode.getState();
	if (saved && saved.model) {
		restoredModel = saved.model;
	}
	if (saved && saved.ui) {
		restoredUI = saved.ui;
	}
} catch {}

type Rule = {
	scope: string | string[];
	settings: { foreground?: string; fontStyle?: string };
};
type Semantic = { [k: string]: { foreground?: string; fontStyle?: string } };

let model = {
	colors: {} as Record<string, string>,
	tokenColors: [] as Rule[],
	semanticTokens: {} as Semantic,
};

// Coercion helpers for payloads coming from settings
function coerceTokenRules(x: any): Rule[] {
	if (Array.isArray(x)) return x as Rule[];
	if (x && Array.isArray(x.textMateRules)) return x.textMateRules as Rule[];
	return [];
}
function coerceSemanticRules(
	x: any
): Record<string, { foreground?: string; fontStyle?: string }> {
	if (x && typeof x === "object" && !Array.isArray(x)) {
		if (x.rules && typeof x.rules === "object") return x.rules;
		// if it's the plain rules map already
		const { enabled, ...rest } = x as any;
		return rest && Object.keys(rest).length ? (rest as any) : {};
	}
	return {};
}
// Debounce state for preview updates
let previewTimer: number | undefined;
const PREVIEW_DEBOUNCE_MS = 120;
let lastPreviewSnapshot: string | undefined;

// Simple history for undo/redo
type Model = typeof model;
const historyStack: Model[] = [];
const redoStack: Model[] = [];
let lastHistoryTs = 0;
const HISTORY_MIN_INTERVAL_MS = 500;
let baselineSnapshot: string | undefined;

const deepClone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const recordHistory = () => {
	const now = Date.now();
	if (now - lastHistoryTs < HISTORY_MIN_INTERVAL_MS) return;
	historyStack.push(deepClone(model));
	// cap history to 50 entries
	if (historyStack.length > 50) historyStack.shift();
	// new edits invalidate redo
	redoStack.length = 0;
	lastHistoryTs = now;
	updateUndoRedoButtons();
};

const undo = () => {
	if (!historyStack.length) return;
	redoStack.push(deepClone(model));
	const prev = historyStack.pop()!;
	model = deepClone(prev);
	renderAll();
	pushPreview();
	updateUndoRedoButtons();
};

const redo = () => {
	if (!redoStack.length) return;
	historyStack.push(deepClone(model));
	const next = redoStack.pop()!;
	model = deepClone(next);
	renderAll();
	pushPreview();
	updateUndoRedoButtons();
};

function updateUndoRedoButtons() {
	const undoBtn = document.getElementById(
		"btn-undo"
	) as HTMLButtonElement | null;
	const redoBtn = document.getElementById(
		"btn-redo"
	) as HTMLButtonElement | null;
	if (undoBtn) undoBtn.disabled = historyStack.length === 0;
	if (redoBtn) redoBtn.disabled = redoStack.length === 0;
	const status = document.getElementById("status");
	if (status) {
		const dirty = JSON.stringify(model) !== (baselineSnapshot || "");
		(status as HTMLElement).textContent = `${dirty ? "● " : ""}Undo:${
			historyStack.length
		} Redo:${redoStack.length}`;
	}
}

function resetHistory() {
	historyStack.length = 0;
	redoStack.length = 0;
	lastHistoryTs = 0;
	baselineSnapshot = JSON.stringify(model);
	updateUndoRedoButtons();
}
let categories: {
	name: string;
	items: { key: string; description: string }[];
}[] = [];

window.addEventListener("message", (e) => {
	const { type, payload } = e.data;
	if (type === "BOOT") {
		categories = payload.categories || [];
		const current = payload.settings || {};
		// If user wants to start from current
		if (restoredModel) {
			model = deepClone(restoredModel);
		} else {
			model.colors = current.colors || {};
			model.tokenColors = current.tokenColors?.textMateRules || [];
			model.semanticTokens = current.semanticTokens?.rules || {};
		}
		renderAll();
		resetHistory();
		// restore UI state
		if (restoredUI) {
			const left = restoredUI.leftTab || "colors";
			document
				.querySelectorAll(".tab")
				.forEach((t) => t.classList.remove("active"));
			document.querySelector(`[data-tab="${left}"]`)?.classList.add("active");
			document
				.querySelectorAll(".panel")
				.forEach((x) => x.classList.remove("active"));
			document.getElementById("panel-" + left)?.classList.add("active");

			const p = restoredUI.previewTab || "editor";
			document
				.querySelectorAll(".ptab")
				.forEach((t) => t.classList.remove("active"));
			document.querySelector(`[data-demo="${p}"]`)?.classList.add("active");
			document
				.querySelectorAll(".demo")
				.forEach((x) => ((x as HTMLElement).style.display = "none"));
			document.getElementById("demo-" + p)!.style.display = "block";

			if (typeof restoredUI.search === "string") {
				const search = document.getElementById("search") as HTMLInputElement;
				search.value = restoredUI.search;
				const event = new Event("input");
				search.dispatchEvent(event);
			}

			// restore category open state and left scroll
			if (restoredUI.openCats) {
				document
					.querySelectorAll("#panel-colors details.category")
					.forEach((d) => {
						const det = d as HTMLDetailsElement;
						const title =
							det.querySelector("summary")?.textContent?.trim() || "";
						if (title && restoredUI!.openCats![title] !== undefined)
							det.open = !!restoredUI!.openCats![title];
					});
			}
			if (typeof restoredUI.leftScroll === "number") {
				const panel = document.getElementById("panel-colors");
				if (panel) (panel as HTMLElement).scrollTop = restoredUI.leftScroll;
			}
		}
	}
	if (type === "LOAD_CURRENT") {
		// For "Use Current", let current settings override existing values.
		model.colors = mergeColors(payload.colors || {}, model.colors);
		const incomingRules = coerceTokenRules(payload.tokenColors);
		model.tokenColors = mergeTokenRules(incomingRules, model.tokenColors);
		const incomingSem = coerceSemanticRules(payload.semanticTokens);
		model.semanticTokens = mergeSemanticRules(
			incomingSem,
			model.semanticTokens
		);
		renderAll();
		resetHistory();
		pushPreview();
	}
	if (type === "LOAD_IMPORTED") {
		model.colors = payload.colors || {};
		model.tokenColors = payload.tokenColors || [];
		model.semanticTokens = payload.semanticTokens || {};
		renderAll();
		resetHistory();
		pushPreview();
	}
	if (type === "LOCATE") pulse(payload?.elementId);
	if (type === "UI_UNDO") undo();
	if (type === "UI_REDO") redo();
});

function pulse(id?: string) {
	if (!id) return;
	// Try preview area first
	const el = document.getElementById(id);
	if (el) {
		el.classList.add("locate-pulse");
		setTimeout(() => el.classList.remove("locate-pulse"), 1000);
	}
	// Also scroll and pulse the left panel row if it's a color key
	if (id.startsWith("demo-")) {
		// When called for preview areas, only pulse the preview; do not scroll the left list.
		// Scrolling all matching rows causes the panel to jump to the bottom on each edit.
	} else if (id.startsWith("row-")) {
		// Direct row pulse (for future use)
		const row = document.getElementById(id);
		if (row) {
			row.classList.add("locate-pulse");
			row.scrollIntoView({ behavior: "smooth", block: "center" });
			setTimeout(() => row.classList.remove("locate-pulse"), 1000);
		}
	}
}

function renderAll() {
	renderColors();
	renderTokens();
	renderSemantic();
	renderPreviewDemos();
}

function inputRow(label: string, key: string, description: string) {
	const v = model.colors[key] || "";
	const alpha = alphaFromHex(v);
	// Pick an icon based on key/category (simple heuristic)
	let icon = "";
	if (key.includes("background")) icon = "🖼️";
	else if (key.includes("foreground")) icon = "🔤";
	else if (key.includes("border")) icon = "⬛";
	else if (key.includes("badge")) icon = "🏷️";
	else if (key.includes("error")) icon = "❌";
	else if (key.includes("warning")) icon = "⚠️";
	else if (key.includes("info")) icon = "ℹ️";
	else if (key.includes("active")) icon = "⭐";
	else if (key.includes("inactive")) icon = "⏸️";
	else if (key.includes("focus")) icon = "🎯";
	else if (key.includes("selection")) icon = "🖱️";
	else if (key.includes("highlight")) icon = "💡";
	else if (key.includes("tab")) icon = "📑";
	else if (key.includes("list")) icon = "📋";
	else if (key.includes("status")) icon = "📶";
	else if (key.includes("panel")) icon = "🗂️";
	else if (key.includes("terminal")) icon = "⌨️";
	else if (key.includes("editor")) icon = "📝";
	else if (key.includes("action")) icon = "⚡";
	else if (key.includes("find")) icon = "🔍";
	else if (key.includes("notification")) icon = "🔔";
	else if (key.includes("problems")) icon = "🐞";
	else if (key.includes("title")) icon = "🏷️";
	else icon = "🎨";
	const { short, full, truncated } = summarizeDescription(description || "");
	const descAttrs = `data-full="${escapeHtml(full)}"`;
	const toggle = truncated
		? `<button class="desc-toggle" type="button" aria-label="Expand description" data-toggle-desc>More</button>`
		: "";
	return `
				<div class="row" id="row-${key}">
						<div class="row-head">
							<div class="row-label">${icon} ${label}</div>
							<button class="locate-btn" type="button" data-locate="${key}" title="Locate in preview">Locate</button>
						</div>
						<div class="row-body">
								<span class="chip" aria-hidden="true" title="${v.toUpperCase()} (${alpha}%)"><span class="chip-fill" style="background:${
		isValidHex(v) ? normalizeHex(v) : "#000000"
	}"></span></span>
								<input type="color" data-key="${key}" value="${coerceHex(
		v
	)}" aria-label="Color value for ${key}" />
								<input type="text" data-key="${key}" value="${v}" placeholder="#RRGGBB or #RRGGBBAA" aria-label="Hex color for ${key}" />
								<input type="range" min="0" max="100" step="1" data-alpha-key="${key}" value="${alpha}" title="Alpha ${alpha}%" aria-label="Alpha for ${key}" />
						</div>
						<div class="row-desc">
							<span class="desc" ${descAttrs}>${short}</span> ${toggle}
						</div>
				</div>
		`;
}

function escapeHtml(s: string) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function renderDescription(s: string) {
	if (!s) return "";
	const clean = s.replace(/\s+/g, " ").trim();
	if (clean.length > 140) return escapeHtml(clean.slice(0, 137)) + "...";
	return escapeHtml(clean);
}

function summarizeDescription(s: string) {
	const clean = (s || "").replace(/\s+/g, " ").trim();
	const truncated = clean.length > 160;
	const short = truncated
		? escapeHtml(clean.slice(0, 157)) + "..."
		: escapeHtml(clean);
	return { short, full: clean, truncated };
}
function coerceHex(s: string) {
	// fallback to #000000 if invalid
	return /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)
		? `#${s.replace("#", "").slice(0, 6)}`
		: "#000000";
}

function isValidHex(s: string) {
	return /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s.trim());
}

function normalizeHex(s: string) {
	// Uppercase and ensure leading '#'
	let v = s.trim();
	if (!v.startsWith("#")) v = "#" + v;
	return v.toUpperCase();
}

function renderColors() {
	const root = document.getElementById("panel-colors")!;
	// Preserve current open state and scroll before rerender
	const prevOpen: Record<string, boolean> = {};
	root.querySelectorAll("details.category").forEach((d) => {
		const det = d as HTMLDetailsElement;
		const title = det.querySelector("summary")?.textContent?.trim() || "";
		if (title) prevOpen[title] = det.open;
	});
	const prevScroll = (root as HTMLElement).scrollTop;
	// Render categories only (palette row removed per user request)
	root.innerHTML = categories
		.map(
			(c) => `
			<details class="category" ${prevOpen[c.name] ? "open" : ""}>
				<summary><span class="cat-icon">${categoryIcon(c.name)}</span> ${
				c.name
			}</summary>
				<div class="cat-list">
					${c.items.map((it) => inputRow(it.key, it.key, it.description || "")).join("")}
				</div>
			</details>
		`
		)
		.join("");
	root
		.querySelectorAll('input[type="color"], input[type="text"]')
		.forEach((el) => {
			el.addEventListener("input", handleColorInput);
		});
	root
		.querySelectorAll('input[type="range"][data-alpha-key]')
		.forEach((el) => el.addEventListener("input", handleAlphaInput));
	root.querySelectorAll("button[data-locate]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const key = (btn as HTMLButtonElement).dataset.locate!;
			vscode.postMessage({
				type: "LOCATE",
				payload: { elementId: demoIdForKey(key) },
			});
		});
	});
	// Restore previous scroll position
	(root as HTMLElement).scrollTop = prevScroll;
}

function categoryIcon(name: string) {
	const n = (name || "").toLowerCase();
	if (n.includes("editor")) return "📝";
	if (n.includes("tab")) return "📑";
	if (n.includes("status")) return "📶";
	if (n.includes("panel")) return "🗂️";
	if (n.includes("terminal")) return "⌨️";
	if (n.includes("debug") || n.includes("problems")) return "🐞";
	if (n.includes("list") || n.includes("explorer")) return "📋";
	if (n.includes("activity") || n.includes("sidebar")) return "🧭";
	if (n.includes("title")) return "🏷️";
	if (n.includes("git") || n.includes("scm")) return "🌿";
	if (n.includes("ansi")) return "🎨";
	if (n.includes("notification")) return "🔔";
	return "🎯";
}

function handleColorInput(ev: Event) {
	const t = ev.target as HTMLInputElement;
	const key = t.dataset.key!;
	let val = t.value.trim();
	const parent = t.parentElement!;
	const chip = parent.querySelector(".chip-fill") as HTMLSpanElement | null;
	const textInput = parent.querySelector(
		'input[type="text"][data-key="' + key + '"]'
	) as HTMLInputElement;
	const colorInput = parent.querySelector(
		'input[type="color"][data-key="' + key + '"]'
	) as HTMLInputElement;
	const alphaInput = parent.querySelector(
		'input[type="range"][data-alpha-key="' + key + '"]'
	) as HTMLInputElement;
	if (t.type === "color") {
		// preserve existing alpha from text input if present
		const base6 = val; // #RRGGBB
		const aPct = alphaFromHex(textInput?.value || "");
		const merged = mergeHexWithAlpha(base6, aPct);
		textInput.value = merged;
		alphaInput.value = String(aPct);
		val = merged;
	} else if (t.type === "text") {
		// sync color and alpha controls from text
		if (isValidHex(val)) {
			colorInput.value = coerceHex(val);
			alphaInput.value = String(alphaFromHex(val));
			textInput.classList.remove("invalid");
			textInput.setAttribute("aria-invalid", "false");
		}
	}
	// Guard against invalid hex; do not apply until valid
	if (!isValidHex(val)) {
		textInput.classList.add("invalid");
		textInput.setAttribute("aria-invalid", "true");
		if (chip) chip.style.background = "#000000";
		return;
	}
	textInput.classList.remove("invalid");
	textInput.setAttribute("aria-invalid", "false");
	recordHistory();
	model.colors[key] = normalizeHex(val);
	if (chip) chip.style.background = model.colors[key];
	pushPreview();
	// Do not auto-locate on each edit to avoid scrolling the list
}

function handleAlphaInput(ev: Event) {
	const t = ev.target as HTMLInputElement; // range
	const key = t.dataset.alphaKey!;
	const parent = t.parentElement!;
	const chip = parent.querySelector(".chip-fill") as HTMLSpanElement | null;
	const colorInput = parent.querySelector(
		'input[type="color"][data-key="' + key + '"]'
	) as HTMLInputElement;
	const textInput = parent.querySelector(
		'input[type="text"][data-key="' + key + '"]'
	) as HTMLInputElement;
	const aPct = clampPct(parseInt(t.value, 10));
	const merged = mergeHexWithAlpha(colorInput.value, aPct);
	textInput.value = merged;
	recordHistory();
	model.colors[key] = merged;
	if (chip) chip.style.background = merged;
	pushPreview();
	// Avoid auto-locate to prevent scroll jumps
}

function clampPct(n: number) {
	return isFinite(n) ? Math.min(100, Math.max(0, n)) : 100;
}

function alphaFromHex(v: string): number {
	const m = /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(v);
	if (!m) return 100;
	const aa = parseInt(m[1], 16);
	return Math.round((aa / 255) * 100);
}

function mergeHexWithAlpha(base6: string, alphaPct: number): string {
	const hex6 = coerceHex(base6).replace("#", "");
	const a = clampPct(alphaPct);
	const aa = Math.round((a / 100) * 255)
		.toString(16)
		.padStart(2, "0");
	return `#${hex6}${aa}`;
}

function renderTokens() {
	const root = document.getElementById("panel-tokens")!;
	// Preserve scroll position and advanced open states per index
	const prevScroll = (root as HTMLElement).scrollTop;
	const expanded = new Set<number>();
	root.querySelectorAll(".row").forEach((row, i) => {
		const btn = (row as HTMLElement).querySelector(
			"[data-toggle-adv]"
		) as HTMLButtonElement | null;
		if (btn && btn.getAttribute("aria-expanded") === "true") expanded.add(i);
	});
	const rows = model.tokenColors.map((r, idx) => tokenRow(r, idx)).join("");
	root.innerHTML = `
		<button id="add-token" aria-label="Add token rule">Add Rule</button>
		<div>${rows}</div>`;
	document.getElementById("add-token")!.addEventListener("click", () => {
		recordHistory();
		model.tokenColors.push({ scope: "", settings: {} });
		renderTokens();
		pushPreview();
	});
	root.querySelectorAll("[data-token-edit]").forEach((el) =>
		el.addEventListener("input", (e) => {
			const t = e.target as HTMLInputElement;
			const idx = Number(t.dataset.index);
			const field = t.dataset.field!;
			recordHistory();
			if (field === "scope") model.tokenColors[idx].scope = t.value;
			if (field === "fg") {
				const v = t.value.trim();
				if (!isValidHex(v)) {
					t.classList.add("invalid");
					t.setAttribute("aria-invalid", "true");
					return;
				}
				t.classList.remove("invalid");
				t.setAttribute("aria-invalid", "false");
				model.tokenColors[idx].settings.foreground = normalizeHex(v);
			}
			if (field === "fs") model.tokenColors[idx].settings.fontStyle = t.value;
			pushPreview();
		})
	);
	root.querySelectorAll("[data-token-remove]").forEach((btn) =>
		btn.addEventListener("click", (e) => {
			const i = Number((e.currentTarget as HTMLElement).dataset.index);
			recordHistory();
			model.tokenColors.splice(i, 1);
			renderTokens();
			pushPreview();
		})
	);
	root.querySelectorAll("[data-fs]").forEach((cb) =>
		cb.addEventListener("change", (e) => {
			const t = e.target as HTMLInputElement;
			const i = Number(t.dataset.index);
			const val = t.value;
			const cur = (model.tokenColors[i].settings.fontStyle || "")
				.split(/\s+/)
				.filter(Boolean);
			const set = new Set(cur);
			recordHistory();
			if (t.checked) set.add(val);
			else set.delete(val);
			model.tokenColors[i].settings.fontStyle =
				Array.from(set).join(" ") || undefined;
			pushPreview();
		})
	);
	// Locate buttons
	root.querySelectorAll(".locate-btn").forEach((btn) =>
		btn.addEventListener("click", () => {
			vscode.postMessage({
				type: "LOCATE",
				payload: { elementId: "demo-editor" },
			});
		})
	);
	// Advanced toggles
	root.querySelectorAll("[data-toggle-adv]").forEach((btn) =>
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			const b = btn as HTMLButtonElement;
			const row = b.closest(".row");
			if (!row) return;
			const adv = row.querySelector(".advanced") as HTMLElement | null;
			if (!adv) return;
			const expanded = b.getAttribute("aria-expanded") === "true";
			if (expanded) {
				adv.classList.add("collapsed");
				b.textContent = "Advanced";
				b.setAttribute("aria-expanded", "false");
			} else {
				adv.classList.remove("collapsed");
				b.textContent = "Less";
				b.setAttribute("aria-expanded", "true");
			}
		})
	);
	// Re-open advanced sections that were previously expanded
	root.querySelectorAll(".row").forEach((row, i) => {
		if (!expanded.has(i)) return;
		const adv = (row as HTMLElement).querySelector(
			".advanced"
		) as HTMLElement | null;
		const btn = (row as HTMLElement).querySelector(
			"[data-toggle-adv]"
		) as HTMLButtonElement | null;
		if (adv && btn) {
			adv.classList.remove("collapsed");
			btn.textContent = "Less";
			btn.setAttribute("aria-expanded", "true");
		}
	});
	// Restore scroll
	(root as HTMLElement).scrollTop = prevScroll;
}

function tokenRow(r: Rule, idx: number) {
	const fs = (r.settings.fontStyle || "").split(/\s+/).filter(Boolean);
	const has = (k: string) => fs.includes(k);
	return `<div class="row">
			<div class="row-head">
				<div class="row-label">🎯 Token Rule ${idx + 1}</div>
				<button class="locate-btn" type="button" title="Locate editor preview">Locate</button>
			</div>
			<div class="row-body">
				<label>scope</label><input data-token-edit aria-label="Token scope" data-index="${idx}" data-field="scope" value="${
		Array.isArray(r.scope) ? r.scope.join(", ") : r.scope || ""
	}" />
				<label>foreground</label>
				<span class="chip" aria-hidden="true"><span class="chip-fill" style="background:${
					isValidHex(r.settings.foreground || "")
						? normalizeHex(r.settings.foreground!)
						: "#000000"
				}"></span></span>
				<input data-token-edit aria-label="Token foreground color" data-index="${idx}" data-field="fg" value="${
		r.settings.foreground || ""
	}" />
			</div>
			<div class="row-desc">
				<button class="desc-toggle" type="button" data-toggle-adv aria-expanded="false">Advanced</button>
				<div class="advanced collapsed">
					<fieldset style="display:inline-flex;gap:6px;border:none;padding:0;margin:0">
						<label><input type="checkbox" data-fs data-index="${idx}" value="bold" ${
		has("bold") ? "checked" : ""
	}/> bold</label>
						<label><input type="checkbox" data-fs data-index="${idx}" value="italic" ${
		has("italic") ? "checked" : ""
	}/> italic</label>
						<label><input type="checkbox" data-fs data-index="${idx}" value="underline" ${
		has("underline") ? "checked" : ""
	}/> underline</label>
						<label><input type="checkbox" data-fs data-index="${idx}" value="strikethrough" ${
		has("strikethrough") ? "checked" : ""
	}/> strikethrough</label>
					</fieldset>
					<button data-token-remove data-index="${idx}" aria-label="Remove token rule ${
		idx + 1
	}">Remove</button>
				</div>
			</div>
		</div>`;
}

function renderSemantic() {
	const root = document.getElementById("panel-semantic")!;
	// Preserve scroll and expanded states
	const prevScroll = (root as HTMLElement).scrollTop;
	const expanded = new Set<number>();
	root.querySelectorAll(".row").forEach((row, i) => {
		const btn = (row as HTMLElement).querySelector(
			"[data-toggle-adv]"
		) as HTMLButtonElement | null;
		if (btn && btn.getAttribute("aria-expanded") === "true") expanded.add(i);
	});
	const entries = Object.entries(model.semanticTokens);
	root.innerHTML = `
		<button id="add-sem" aria-label="Add semantic rule">Add Semantic</button>
	<div>${entries.map(([sel, s], i) => semRow(sel, s, i)).join("")}</div>`;
	document.getElementById("add-sem")!.addEventListener("click", () => {
		recordHistory();
		model.semanticTokens["entity.name.new"] = {};
		renderSemantic();
		pushPreview();
	});
	root.querySelectorAll("[data-sem]").forEach((el) =>
		el.addEventListener("input", (e) => {
			const t = e.target as HTMLInputElement;
			const i = Number(t.dataset.index);
			const keys = Object.keys(model.semanticTokens);
			const sel = keys[i];
			recordHistory();
			if (t.dataset.field === "selector") {
				const val = t.value;
				const cur = model.semanticTokens[sel];
				delete model.semanticTokens[sel];
				model.semanticTokens[val] = cur;
			} else if (t.dataset.field === "fg") {
				const v = t.value.trim();
				const chip = (
					t.previousElementSibling &&
					(t.previousElementSibling as HTMLElement).classList.contains("chip")
						? (t.previousElementSibling as HTMLElement).querySelector(
								".chip-fill"
						  )
						: null
				) as HTMLSpanElement | null;
				if (!isValidHex(v)) {
					t.classList.add("invalid");
					t.setAttribute("aria-invalid", "true");
					if (chip) chip.style.background = "#000000";
					return;
				}
				t.classList.remove("invalid");
				t.setAttribute("aria-invalid", "false");
				model.semanticTokens[sel].foreground = normalizeHex(v);
				if (chip) chip.style.background = model.semanticTokens[sel].foreground!;
			} else if (t.dataset.field === "fs") {
				model.semanticTokens[sel].fontStyle = t.value;
			}
			pushPreview();
		})
	);
	root.querySelectorAll("[data-sem-remove]").forEach((btn) =>
		btn.addEventListener("click", (e) => {
			const i = Number((e.currentTarget as HTMLElement).dataset.index);
			const entries = Object.keys(model.semanticTokens);
			const sel = entries[i];
			recordHistory();
			delete model.semanticTokens[sel];
			renderSemantic();
			pushPreview();
		})
	);
	root.querySelectorAll("[data-sem-fs]").forEach((cb) =>
		cb.addEventListener("change", (e) => {
			const t = e.target as HTMLInputElement;
			const i = Number(t.dataset.index);
			const entries = Object.keys(model.semanticTokens);
			const sel = entries[i];
			const cur = (model.semanticTokens[sel].fontStyle || "")
				.split(/\s+/)
				.filter(Boolean);
			const set = new Set(cur);
			recordHistory();
			if (t.checked) set.add(t.value);
			else set.delete(t.value);
			model.semanticTokens[sel].fontStyle =
				Array.from(set).join(" ") || undefined;
			pushPreview();
		})
	);
	// Locate buttons
	root.querySelectorAll(".locate-btn").forEach((btn) =>
		btn.addEventListener("click", () => {
			vscode.postMessage({
				type: "LOCATE",
				payload: { elementId: "demo-editor" },
			});
		})
	);
	// Advanced toggles
	root.querySelectorAll("[data-toggle-adv]").forEach((btn) =>
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			const b = btn as HTMLButtonElement;
			const row = b.closest(".row");
			if (!row) return;
			const adv = row.querySelector(".advanced") as HTMLElement | null;
			if (!adv) return;
			const expanded = b.getAttribute("aria-expanded") === "true";
			if (expanded) {
				adv.classList.add("collapsed");
				b.textContent = "Advanced";
				b.setAttribute("aria-expanded", "false");
			} else {
				adv.classList.remove("collapsed");
				b.textContent = "Less";
				b.setAttribute("aria-expanded", "true");
			}
		})
	);
	// Re-open advanced sections that were previously expanded
	root.querySelectorAll(".row").forEach((row, i) => {
		if (!expanded.has(i)) return;
		const adv = (row as HTMLElement).querySelector(
			".advanced"
		) as HTMLElement | null;
		const btn = (row as HTMLElement).querySelector(
			"[data-toggle-adv]"
		) as HTMLButtonElement | null;
		if (adv && btn) {
			adv.classList.remove("collapsed");
			btn.textContent = "Less";
			btn.setAttribute("aria-expanded", "true");
		}
	});
	// Restore scroll
	(root as HTMLElement).scrollTop = prevScroll;
}

function semRow(sel: string, s: any, i: number) {
	const fs = (s.fontStyle || "").split(/\s+/).filter(Boolean);
	const has = (k: string) => fs.includes(k);
	return `<div class="row">
			<div class="row-head">
				<div class="row-label">🧠 Semantic ${i + 1}</div>
				<button class="locate-btn" type="button" title="Locate editor preview">Locate</button>
			</div>
			<div class="row-body">
				<label>selector</label><input data-sem aria-label="Semantic selector" data-index="${i}" data-field="selector" value="${sel}"/>
				<label>foreground</label>
				<span class="chip" aria-hidden="true"><span class="chip-fill" style="background:${
					isValidHex(s.foreground || "")
						? normalizeHex(s.foreground)
						: "#000000"
				}"></span></span>
				<input data-sem aria-label="Semantic foreground color" data-index="${i}" data-field="fg" value="${
		s.foreground || ""
	}"/>
			</div>
			<div class="row-desc">
				<button class="desc-toggle" type="button" data-toggle-adv aria-expanded="false">Advanced</button>
				<div class="advanced collapsed">
					<fieldset style="display:inline-flex;gap:6px;border:none;padding:0;margin:0">
						<label><input type="checkbox" data-sem-fs data-index="${i}" value="bold" ${
		has("bold") ? "checked" : ""
	}/> bold</label>
						<label><input type="checkbox" data-sem-fs data-index="${i}" value="italic" ${
		has("italic") ? "checked" : ""
	}/> italic</label>
						<label><input type="checkbox" data-sem-fs data-index="${i}" value="underline" ${
		has("underline") ? "checked" : ""
	}/> underline</label>
					</fieldset>
					<button data-sem-remove data-index="${i}" aria-label="Remove semantic rule ${
		i + 1
	}">Remove</button>
				</div>
			</div>
		</div>`;
}

function renderPreviewDemos() {
	const root = document.getElementById("preview")!;
	// Preserve currently active demo tab
	const activeDemo =
		(document.querySelector(".ptab.active") as HTMLElement | null)?.dataset
			.demo || "editor";
	root.innerHTML = getDemosHtml();
	applyTokenStyles();
	// clicking preview tabs
	document.querySelectorAll(".ptab").forEach((b) =>
		b.addEventListener("click", () => {
			document
				.querySelectorAll(".ptab")
				.forEach((x) => x.classList.remove("active"));
			b.classList.add("active");
			const id = (b as HTMLButtonElement).dataset.demo!;
			document
				.querySelectorAll(".demo")
				.forEach((x) => ((x as HTMLElement).style.display = "none"));
			document.getElementById("demo-" + id)!.style.display = "block";
			saveState();
		})
	);
	// Ensure the previously active demo is visible after rerender
	document
		.querySelectorAll(".demo")
		.forEach((x) => ((x as HTMLElement).style.display = "none"));
	const activeEl = document.getElementById("demo-" + activeDemo);
	if (activeEl) (activeEl as HTMLElement).style.display = "block";
}

function pushPreview() {
	if (previewTimer) (window as any).clearTimeout(previewTimer);
	previewTimer = (window as any).setTimeout(() => {
		const snap = JSON.stringify(model);
		if (snap !== lastPreviewSnapshot) {
			lastPreviewSnapshot = snap;
			vscode.postMessage({ type: "APPLY_PREVIEW", payload: model });
			try {
				vscode.setState && vscode.setState({ model, ui: collectUI() });
			} catch {}
			// also update token styles in preview
			applyTokenStyles();
		}
	}, PREVIEW_DEBOUNCE_MS);
}

// Inject simple token color styles for the editor demo
function applyTokenStyles() {
	const styleId = "token-style";
	let style = document.getElementById(styleId) as HTMLStyleElement | null;
	if (!style) {
		style = document.createElement("style");
		style.id = styleId;
		document.head.appendChild(style);
	}
	const rules = model.tokenColors
		.filter((r) => r.settings && r.settings.foreground)
		.map((r, i) => {
			const color = r.settings.foreground!;
			const cls = `#code-sample .tok-${i}`;
			return `${cls}{color:${color};}`;
		})
		.join("\n");
	style.textContent = rules;
	// sample HTML is static in getDemosHtml(); nothing to rewrite here
}

function collectUI() {
	const leftBtn = document.querySelector(".tab.active") as HTMLElement | null;
	const left = leftBtn?.dataset.tab || "colors";
	const ptab = document.querySelector(".ptab.active") as HTMLElement | null;
	const previewTab = ptab?.dataset.demo || "editor";
	const search =
		(document.getElementById("search") as HTMLInputElement)?.value || "";
	const openCats: Record<string, boolean> = {};
	document.querySelectorAll("#panel-colors details.category").forEach((d) => {
		const det = d as HTMLDetailsElement;
		const title = det.querySelector("summary")?.textContent?.trim() || "";
		if (title) openCats[title] = det.open;
	});
	const leftScroll =
		(document.getElementById("panel-colors") as HTMLElement)?.scrollTop || 0;
	return { leftTab: left, previewTab, search, openCats, leftScroll };
}

function saveState() {
	try {
		vscode.setState && vscode.setState({ model, ui: collectUI() });
	} catch {}
}

// Map color key to demo element id
function demoIdForKey(key: string): string {
	if (key.startsWith("statusBar")) return "demo-statusbar";
	if (key.startsWith("panel") || key.startsWith("panelSection"))
		return "demo-panels";
	if (key.startsWith("terminal")) return "demo-terminal";
	if (key.startsWith("problems")) return "demo-problems";
	if (key.startsWith("tab.") || key.startsWith("editorGroupHeader"))
		return "demo-lists";
	return "demo-editor";
}

// Minimal demos
function getDemosHtml() {
	// VS Code-like frame with sidebar, file tree, and your preview tabs/logic
	return `
			 <section class="demo" id="demo-editor" style="display:block">
				 <div class="vsc-frame vsc-frame-preview">
					 <div class="vsc-titlebar">
						 VS Code Design Lab — Editor Preview
						 <button id="btn-save-theme" class="save-theme-btn" title="Save Theme">
							 <span class="icon">💾</span> Save Theme
						 </button>
					 </div>
					 <div class="vsc-main">
						 <aside class="vsc-sidebar">
							 <div class="vsc-sidebar-icon active" title="Explorer">📂</div>
							 <div class="vsc-sidebar-icon" title="Search">🔍</div>
							 <div class="vsc-sidebar-icon" title="Source Control">🔀</div>
							 <div class="vsc-sidebar-icon" title="Run &amp; Debug">🐞</div>
							 <div class="vsc-sidebar-icon" title="Extensions">🧩</div>
						 </aside>
						 <div class="vsc-content">
							 <div class="vsc-filetree">
								 <div class="filetree-title">EXPLORER</div>
								 <div class="filetree-folder"><span class="filetree-folder-icon">📁</span> src
									 <div class="filetree-file"><span class="filetree-file-icon">📄</span> app.ts</div>
									 <div class="filetree-file"><span class="filetree-file-icon">📄</span> utils.ts</div>
									 <div class="filetree-file"><span class="filetree-file-icon">📄</span> index.ts</div>
								 </div>
							 </div>
													 <div class="vsc-tabs">
															 <div class="vsc-tab active"><span class="tab-dot" aria-hidden="true"></span><span class="tab-title">app.ts</span><span class="tab-close" aria-hidden="true">×</span></div>
															 <div class="vsc-tab"><span class="tab-title">utils.ts</span><span class="tab-close" aria-hidden="true">×</span></div>
															 <div class="vsc-tab"><span class="tab-title">index.ts</span><span class="tab-close" aria-hidden="true">×</span></div>
													 </div>
													 <div class="vsc-breadcrumbs">
															 <span class="crumb">workspace</span>
															 <span class="crumb-sep">›</span>
															 <span class="crumb">src</span>
															 <span class="crumb-sep">›</span>
															 <span class="crumb active">app.ts</span>
													 </div>
							 <div id="editor" class="editor-area">
								 <div class="gutter">1<br>2<br>3<br>4<br>5</div>
								 <div class="code-area">
									 <div class="active-line"></div>
									 <div class="selection"></div>
									 <div class="cursor"></div>
									 <pre id="code-sample"><code>
<span class="tok-0">function</span> <span class="tok-1">demo</span>() { <span class="tok-2">console</span>.<span class="tok-3">log</span>(<span class="tok-4">'Hello theme'</span>); }
									 </code></pre>
								 </div>
															 <div class="minimap">
																 <div class="minimap-track">
																	 <div class="minimap-viewport"></div>
																 </div>
															 </div>
							 </div>
													 <div class="vsc-notification animate-in">🔔 Build completed successfully.</div>
													 <div class="vsc-bottom-panel">
														 <div class="vsc-bottom-tabs">
															 <div class="vsc-bottom-tab active">PROBLEMS</div>
															 <div class="vsc-bottom-tab">OUTPUT</div>
															 <div class="vsc-bottom-tab">TERMINAL</div>
														 </div>
														 <div class="vsc-bottom-content">
															 <div class="vsc-problem-item">src/app.ts(12,5): Missing semicolon.</div>
															 <div class="vsc-problem-item">src/utils.ts(3,10): Unused variable.</div>
														 </div>
													 </div>
						 </div>
					 </div>
					 <div class="vsc-statusbar"><span>Ln 12, Col 8</span><span>UTF-8</span><span>LF</span><span>TypeScript</span></div>
				 </div>
			 </section>
	<section class="demo" id="demo-panels" style="display:none">
		<div class="panel-surface">
			<div style="font-weight:600;margin-bottom:6px">Panel Title</div>
			<div>Some content inside a VS Code panel area.</div>
		</div>
	</section>
	<section class="demo" id="demo-problems" style="display:none">
		<div class="problems-list">
			<div style="padding:6px;border-bottom:1px solid var(--vscode-editorWidget-border)">src/app.ts:12:5 Missing semicolon</div>
			<div style="padding:6px;border-bottom:1px solid var(--vscode-editorWidget-border)">src/utils.ts:3:10 Unused variable</div>
			<div style="padding:6px">src/index.ts:1:1 Unexpected any</div>
		</div>
	</section>
	<section class="demo" id="demo-terminal" style="display:none">
		<div class="terminal">PS E:&gt; npm run build<br>webpack 5 compiling... done</div>
	</section>
	<section class="demo" id="demo-notifications" style="display:none">
		<div class="notification animate-in">Build completed successfully.</div>
	</section>
	<section class="demo" id="demo-statusbar" style="display:none">
		<div class="statusbar"><span>Ln 12, Col 8</span><span>UTF-8</span><span>LF</span><span>TypeScript</span></div>
	</section>
	<section class="demo" id="demo-lists" style="display:none">
			<div class="list">
				<div style="display:flex;border-bottom:1px solid var(--vscode-editorGroupHeader-tabsBorder)">
					<div style="padding:6px 10px;background:var(--vscode-tab-activeBackground);color:var(--vscode-tab-activeForeground);border-right:1px solid var(--vscode-editorGroupHeader-tabsBorder)">app.ts</div>
					<div style="padding:6px 10px;background:var(--vscode-tab-inactiveBackground);color:var(--vscode-tab-inactiveForeground);border-right:1px solid var(--vscode-editorGroupHeader-tabsBorder)">utils.ts</div>
					<div style="padding:6px 10px;background:var(--vscode-tab-inactiveBackground);color:var(--vscode-tab-inactiveForeground)">index.ts</div>
				</div>
				<div style="padding:8px">Content area under tabs</div>
			</div>
	</section>`;
}

// Merge helpers: base retains precedence; add contributes missing keys/rules
function mergeColors(
	base: Record<string, string>,
	add: Record<string, string>
) {
	return { ...add, ...base }; // base wins
}

function normScopeKey(scope: string | string[]): string {
	if (Array.isArray(scope)) return scope.map((s) => s.trim()).join(",");
	return String(scope || "").trim();
}

function mergeTokenRules(base: Rule[], add: Rule[]): Rule[] {
	const map = new Map<string, Rule>();
	// base first so it wins
	for (const r of base) map.set(normScopeKey(r.scope), r);
	for (const r of add) {
		const k = normScopeKey(r.scope);
		if (!map.has(k)) map.set(k, r);
	}
	return Array.from(map.values());
}

function mergeSemanticRules(
	base: Record<string, { foreground?: string; fontStyle?: string }>,
	add: Record<string, { foreground?: string; fontStyle?: string }>
) {
	return { ...add, ...base }; // base wins
}

// boot
document.addEventListener("DOMContentLoaded", () => {
	// Save Theme button wiring
	document.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest("#btn-save-theme");
		if (btn) {
			vscode.postMessage({ type: "REQUEST_SAVE_THEME", payload: model });
		}
	});
	// Toolbar wiring
	const byId = (id: string) =>
		document.getElementById(id) as HTMLButtonElement | null;
	byId("btn-import")?.addEventListener("click", () =>
		vscode.postMessage({ type: "REQUEST_IMPORT" })
	);
	byId("btn-use")?.addEventListener("click", () =>
		vscode.postMessage({ type: "REQUEST_USE_CURRENT" })
	);
	byId("btn-blank")?.addEventListener("click", () =>
		vscode.postMessage({ type: "REQUEST_START_BLANK" })
	);
	byId("btn-undo")?.addEventListener("click", () => {
		undo();
	});
	byId("btn-redo")?.addEventListener("click", () => {
		redo();
	});
	byId("btn-export-json")?.addEventListener("click", () =>
		vscode.postMessage({ type: "REQUEST_EXPORT_JSON" })
	);
	byId("btn-export-css")?.addEventListener("click", () =>
		vscode.postMessage({ type: "REQUEST_EXPORT_CSS" })
	);
	byId("btn-export-vsix")?.addEventListener("click", () =>
		vscode.postMessage({ type: "REQUEST_EXPORT_VSIX" })
	);
	// Expand/collapse description toggles
	document.addEventListener("click", (e) => {
		const t = (e.target as HTMLElement).closest("[data-toggle-desc]");
		if (!t) return;
		e.preventDefault();
		const btn = t as HTMLButtonElement;
		const row = btn.closest(".row");
		if (!row) return;
		const desc = row.querySelector(".desc") as HTMLElement | null;
		if (!desc) return;
		const full = desc.getAttribute("data-full") || "";
		const isExpanded = btn.getAttribute("aria-expanded") === "true";
		if (isExpanded) {
			// collapse
			desc.textContent = renderDescription(full);
			btn.textContent = "More";
			btn.setAttribute("aria-expanded", "false");
		} else {
			// expand
			desc.textContent = full;
			btn.textContent = "Less";
			btn.setAttribute("aria-expanded", "true");
		}
	});
	document.querySelectorAll(".tab").forEach((t) =>
		t.addEventListener("click", () => {
			document
				.querySelectorAll(".tab")
				.forEach((x) => x.classList.remove("active"));
			t.classList.add("active");
			const id = (t as HTMLButtonElement).dataset.tab!;
			document
				.querySelectorAll(".panel")
				.forEach((x) => x.classList.remove("active"));
			document.getElementById("panel-" + id)!.classList.add("active");
			saveState();
		})
	);
	// track category open/close
	document.addEventListener(
		"toggle",
		(e) => {
			const target = e.target as HTMLElement;
			if (target && target.matches && target.matches("details.category")) {
				saveState();
			}
		},
		true
	);
	// track left scroll
	const leftPanel = document.getElementById("panel-colors");
	if (leftPanel) {
		leftPanel.addEventListener("scroll", () => {
			// throttle via microtask to avoid excessive setState
			window.requestAnimationFrame(() => saveState());
		});
	}
	const search = document.getElementById("search") as HTMLInputElement;
	search.addEventListener("input", () => {
		const q = search.value.toLowerCase();
		document
			.querySelectorAll("#panel-colors details.category")
			.forEach((detailsEl) => {
				let any = false;
				detailsEl.querySelectorAll(".row").forEach((row) => {
					const txt = row.textContent?.toLowerCase() || "";
					const show = txt.includes(q);
					(row as HTMLElement).style.display = show ? "" : "none";
					if (show) any = true;
				});
				(detailsEl as HTMLDetailsElement).style.display =
					any || q === "" ? "" : "none";
				if (q) (detailsEl as HTMLDetailsElement).open = any;
			});
		// tokens filter
		document.querySelectorAll("#panel-tokens .row").forEach((row) => {
			const txt = row.textContent?.toLowerCase() || "";
			(row as HTMLElement).style.display = txt.includes(q) ? "" : "none";
		});
		// semantic filter
		document.querySelectorAll("#panel-semantic .row").forEach((row) => {
			const txt = row.textContent?.toLowerCase() || "";
			(row as HTMLElement).style.display = txt.includes(q) ? "" : "none";
		});
		saveState();
	});
	const clearBtn = document.getElementById(
		"clear-search"
	) as HTMLButtonElement | null;
	if (clearBtn) {
		clearBtn.addEventListener("click", () => {
			search.value = "";
			const event = new Event("input");
			search.dispatchEvent(event);
			saveState();
		});
	}

	// Keyboard shortcuts: Undo/Redo
	window.addEventListener("keydown", (e) => {
		const ctrlOrMeta = e.ctrlKey || e.metaKey;
		if (!ctrlOrMeta) return;
		const key = e.key.toLowerCase();
		if (key === "z") {
			e.preventDefault();
			if (e.shiftKey) redo();
			else undo();
		} else if (key === "y") {
			e.preventDefault();
			redo();
		}
	});
	updateUndoRedoButtons();
	vscode.postMessage({ type: "REQUEST_BOOT" });
});
