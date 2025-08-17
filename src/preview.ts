// Purpose: write live preview to VS Code settings, respecting workspace/user target.
import * as vscode from 'vscode';

export type PreviewPayload = {
  colors?: Record<string,string>;
  tokenColors?: any[]; // TextMate rules
  semanticTokens?: { [selector: string]: { foreground?: string; fontStyle?: string } };
};

export async function readCurrentThemeCustomizations() {
  const color = vscode.workspace.getConfiguration().get('workbench.colorCustomizations') || {};
  const token = vscode.workspace.getConfiguration().get('editor.tokenColorCustomizations') || {};
  const sem   = vscode.workspace.getConfiguration().get('editor.semanticTokenColorCustomizations') || {};
  return { colors: color, tokenColors: token, semanticTokens: sem };
}

export async function applyPreview(payload: PreviewPayload) {
  const workspace = vscode.workspace.getConfiguration('designLab').get<boolean>('preview.applyToWorkspace', true);
  const target = workspace ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;

  if (payload.colors) {
    await vscode.workspace.getConfiguration().update('workbench.colorCustomizations', payload.colors, target);
  }
  if (payload.tokenColors) {
    // Merge into { textMateRules: [...] } form
    await vscode.workspace.getConfiguration().update('editor.tokenColorCustomizations', { textMateRules: payload.tokenColors }, target);
  }
  if (payload.semanticTokens) {
    await vscode.workspace.getConfiguration().update('editor.semanticTokenColorCustomizations', { enabled: true, rules: payload.semanticTokens }, target);
  }
}

export function clearPreview() {
  // Keep user’s settings; no automatic cleanup here.
}
