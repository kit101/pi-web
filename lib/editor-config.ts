export const KNOWN_EDITORS = [
  { id: "vscode", label: "VS Code", command: "code" },
  { id: "cursor", label: "Cursor", command: "cursor" },
  { id: "sublime", label: "Sublime Text", command: "subl" },
  { id: "webstorm", label: "WebStorm", command: "webstorm" },
  { id: "zed", label: "Zed", command: "zed" },
  { id: "nova", label: "Nova", command: "nova" },
] as const;

export type KnownEditorId = typeof KNOWN_EDITORS[number]["id"];
export type EditorId = KnownEditorId | "custom";

export interface EditorSelection {
  id: EditorId;
  executablePath: string;
}

export interface EditorActionBody {
  action: "edit";
  filePath: string;
  editorId: EditorId;
  customExecutable: string;
}

const EDITOR_IDS = new Set<string>([
  ...KNOWN_EDITORS.map((editor) => editor.id),
  "custom",
]);

export function parseEditorId(value: string | null): EditorId {
  return value && EDITOR_IDS.has(value) ? value as EditorId : "vscode";
}

export function normalizeEditorPath(value: string | null): string {
  return value?.trim() ?? "";
}

export function isAbsoluteEditorExecutable(value: string): boolean {
  return value.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

export function isEditorSelectionReady(selection: EditorSelection): boolean {
  return selection.id !== "custom" || isAbsoluteEditorExecutable(selection.executablePath);
}

export function buildEditorActionBody(
  filePath: string,
  selection: EditorSelection,
): EditorActionBody {
  return {
    action: "edit",
    filePath,
    editorId: selection.id,
    customExecutable: selection.executablePath,
  };
}
