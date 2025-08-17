// Purpose: robust JSONC parsing for theme files.
import { parse } from "jsonc-parser";
export function parseJSONC(text: string) {
	return parse(text);
}
