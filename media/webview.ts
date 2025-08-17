// Purpose: render left controls (Colors/Tokens/Semantic), wire inputs to extension via APPLY_PREVIEW, implement locate pulse, and build right demos.
declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

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
		model.colors = current.colors || {};
		model.tokenColors = current.tokenColors?.textMateRules || [];
		model.semanticTokens = current.semanticTokens?.rules || {};
		renderAll();
	}
	if (type === "LOAD_CURRENT") {
		model.colors = mergeColors(model.colors, payload.colors || {});
		model.tokenColors = mergeTokenRules(
			model.tokenColors,
			payload.tokenColors || []
		);
		model.semanticTokens = mergeSemanticRules(
			model.semanticTokens,
			payload.semanticTokens || {}
		);
		renderAll();
		pushPreview();
	}
	if (type === "LOAD_IMPORTED") {
		model.colors = payload.colors || {};
		model.tokenColors = payload.tokenColors || [];
		model.semanticTokens = payload.semanticTokens || {};
		renderAll();
		pushPreview();
	}
	if (type === "LOCATE") pulse(payload?.elementId);
});

function pulse(id?: string) {
	if (!id) return;
	const el = document.getElementById(id);
	if (!el) return;
	el.classList.add("locate-pulse");
	setTimeout(() => el.classList.remove("locate-pulse"), 1000);
}

function renderAll() {
	renderColors();
	renderTokens();
	renderSemantic();
	renderPreviewDemos();
}

function inputRow(label: string, key: string, description: string) {
	const id = `color-${key}`;
	const v = model.colors[key] || "";
	const alpha = alphaFromHex(v);
	return `
    <div class="row">
      <div class="row-head">
        <strong>${label}</strong>
        <button data-locate="${key}" title="Locate in Preview">Locate</button>
      </div>
      <div class="row-body">
        <input type="color" data-key="${key}" value="${coerceHex(v)}" />
		<input type="text" data-key="${key}" value="${v}" placeholder="#RRGGBB or #RRGGBBAA"/>
		<input type="range" min="0" max="100" step="1" data-alpha-key="${key}" value="${alpha}" title="Alpha ${alpha}%"/>
        <span class="desc">${description || ""}</span>
      </div>
    </div>`;
}
function coerceHex(s: string) {
	// fallback to #000000 if invalid
	return /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)
		? `#${s.replace("#", "").slice(0, 6)}`
		: "#000000";
}

function renderColors() {
	const root = document.getElementById("panel-colors")!;
	root.innerHTML = categories
		.map(
			(c) => `
    <section>
      <h4>${c.name}</h4>
      ${c.items
				.map((it) => inputRow(it.key, it.key, it.description || ""))
				.join("")}
    </section>
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
}

function handleColorInput(ev: Event) {
	const t = ev.target as HTMLInputElement;
	const key = t.dataset.key!;
	let val = t.value.trim();
	const parent = t.parentElement!;
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
		if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(val)) {
			colorInput.value = coerceHex(val);
			alphaInput.value = String(alphaFromHex(val));
		}
	}
	model.colors[key] = val;
	pushPreview();
	// auto-locate in preview when editing a color
	vscode.postMessage({
		type: "LOCATE",
		payload: { elementId: demoIdForKey(key) },
	});
}

function handleAlphaInput(ev: Event) {
	const t = ev.target as HTMLInputElement; // range
	const key = t.dataset.alphaKey!;
	const parent = t.parentElement!;
	const colorInput = parent.querySelector(
		'input[type="color"][data-key="' + key + '"]'
	) as HTMLInputElement;
	const textInput = parent.querySelector(
		'input[type="text"][data-key="' + key + '"]'
	) as HTMLInputElement;
	const aPct = clampPct(parseInt(t.value, 10));
	const merged = mergeHexWithAlpha(colorInput.value, aPct);
	textInput.value = merged;
	model.colors[key] = merged;
	pushPreview();
	// auto-locate in preview when changing alpha
	vscode.postMessage({
		type: "LOCATE",
		payload: { elementId: demoIdForKey(key) },
	});
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
	const rows = model.tokenColors.map((r, idx) => tokenRow(r, idx)).join("");
	root.innerHTML = `
		<button id="add-token">Add Rule</button>
    <div>${rows}</div>`;
	document.getElementById("add-token")!.addEventListener("click", () => {
		model.tokenColors.push({ scope: "", settings: {} });
		renderTokens();
		pushPreview();
	});
	root.querySelectorAll("[data-token-edit]").forEach((el) =>
		el.addEventListener("input", (e) => {
			const t = e.target as HTMLInputElement;
			const idx = Number(t.dataset.index);
			const field = t.dataset.field!;
			if (field === "scope") model.tokenColors[idx].scope = t.value;
			if (field === "fg") model.tokenColors[idx].settings.foreground = t.value;
			if (field === "fs") model.tokenColors[idx].settings.fontStyle = t.value;
			pushPreview();
			vscode.postMessage({
				type: "LOCATE",
				payload: { elementId: "demo-editor" },
			});
		})
	);
	root.querySelectorAll("[data-token-remove]").forEach((btn) =>
		btn.addEventListener("click", (e) => {
			const i = Number((e.currentTarget as HTMLElement).dataset.index);
			model.tokenColors.splice(i, 1);
			renderTokens();
			pushPreview();
			vscode.postMessage({
				type: "LOCATE",
				payload: { elementId: "demo-editor" },
			});
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
			if (t.checked) set.add(val);
			else set.delete(val);
			model.tokenColors[i].settings.fontStyle =
				Array.from(set).join(" ") || undefined;
			pushPreview();
			vscode.postMessage({
				type: "LOCATE",
				payload: { elementId: "demo-editor" },
			});
		})
	);
}

function tokenRow(r: Rule, idx: number) {
	const fs = (r.settings.fontStyle || "").split(/\s+/).filter(Boolean);
	const has = (k: string) => fs.includes(k);
	return `<div class="row">
		<label>scope</label><input data-token-edit data-index="${idx}" data-field="scope" value="${
		Array.isArray(r.scope) ? r.scope.join(", ") : r.scope || ""
	}" />
    <label>foreground</label><input data-token-edit data-index="${idx}" data-field="fg" value="${
		r.settings.foreground || ""
	}" />
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
		<button data-token-remove data-index="${idx}">Remove</button>
  </div>`;
}

function renderSemantic() {
	const root = document.getElementById("panel-semantic")!;
	const entries = Object.entries(model.semanticTokens);
	root.innerHTML = `
    <button id="add-sem">Add Semantic</button>
    <div>${entries.map(([sel, s], i) => semRow(sel, s, i)).join("")}</div>`;
	document.getElementById("add-sem")!.addEventListener("click", () => {
		model.semanticTokens["entity.name.new"] = {};
		renderSemantic();
		pushPreview();
	});
	root.querySelectorAll("[data-sem]").forEach((el) =>
		el.addEventListener("input", (e) => {
			const t = e.target as HTMLInputElement;
			const i = Number(t.dataset.index);
			const entries = Object.keys(model.semanticTokens);
			const sel = entries[i];
			if (t.dataset.field === "selector") {
				const val = t.value;
				const cur = model.semanticTokens[sel];
				delete model.semanticTokens[sel];
				model.semanticTokens[val] = cur;
			} else if (t.dataset.field === "fg") {
				model.semanticTokens[sel].foreground = t.value;
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
			if (t.checked) set.add(t.value);
			else set.delete(t.value);
			model.semanticTokens[sel].fontStyle =
				Array.from(set).join(" ") || undefined;
			pushPreview();
		})
	);
}

function semRow(sel: string, s: any, i: number) {
	const fs = (s.fontStyle || "").split(/\s+/).filter(Boolean);
	const has = (k: string) => fs.includes(k);
	return `<div class="row">
    <label>selector</label><input data-sem data-index="${i}" data-field="selector" value="${sel}"/>
    <label>foreground</label><input data-sem data-index="${i}" data-field="fg" value="${
		s.foreground || ""
	}"/>
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
		<button data-sem-remove data-index="${i}">Remove</button>
  </div>`;
}

function renderPreviewDemos() {
	const root = document.getElementById("preview")!;
	root.innerHTML = getDemosHtml();
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
		})
	);
}

function pushPreview() {
	vscode.postMessage({ type: "APPLY_PREVIEW", payload: model });
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
	return `
  <section class="demo" id="demo-editor" style="display:block">
    <div id="editor" contenteditable="true" style="min-height:220px;padding:8px;border:1px solid var(--vscode-editorWidget-border)">
      // active line, selections, cursor, hover, indent guides, etc.
      function demo() { console.log('Hello theme'); }
    </div>
  </section>
  <section class="demo" id="demo-panels" style="display:none"><div>Panels</div></section>
  <section class="demo" id="demo-problems" style="display:none"><div>Problems list</div></section>
  <section class="demo" id="demo-terminal" style="display:none"><div>Terminal</div></section>
  <section class="demo" id="demo-notifications" style="display:none"><div>Notifications</div></section>
  <section class="demo" id="demo-statusbar" style="display:none"><div>Status Bar</div></section>
  <section class="demo" id="demo-lists" style="display:none"><div>Lists/Tabs</div></section>`;
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
	byId("btn-export-json")?.addEventListener("click", () =>
		vscode.postMessage({ type: "REQUEST_EXPORT_JSON" })
	);
	byId("btn-export-css")?.addEventListener("click", () =>
		vscode.postMessage({ type: "REQUEST_EXPORT_CSS" })
	);
	byId("btn-export-vsix")?.addEventListener("click", () =>
		vscode.postMessage({ type: "REQUEST_EXPORT_VSIX" })
	);
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
		})
	);
	const search = document.getElementById("search") as HTMLInputElement;
	search.addEventListener("input", () => {
		const q = search.value.toLowerCase();
		document.querySelectorAll("#panel-colors section").forEach((section) => {
			let any = false;
			section.querySelectorAll(".row").forEach((row) => {
				const txt = row.textContent?.toLowerCase() || "";
				const show = txt.includes(q);
				(row as HTMLElement).style.display = show ? "" : "none";
				if (show) any = true;
			});
			(section as HTMLElement).style.display = any ? "" : "none";
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
	});
	vscode.postMessage({ type: "REQUEST_BOOT" });
});
