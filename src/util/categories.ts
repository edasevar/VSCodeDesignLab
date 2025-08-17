// Purpose: group color keys using your template categories + descriptions.
// Use require to load JSON at runtime for compatibility with Node/webpack
// eslint-disable-next-line @typescript-eslint/no-var-requires
const template = require("../../assets/colors-template.json");
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

type Cat = { name: string; items: { key: string; description: string }[] };
export const categories: Cat[] = (() => {
	const cats: Cat[] = [];
	for (const [groupName, entries] of Object.entries<any>(template.colors)) {
		const items = Object.entries<any>(entries).map(([key, info]) => ({
			key,
			description: (info as any).description || "",
		}));
		cats.push({ name: String(groupName), items });
	}
	return cats;
})();
