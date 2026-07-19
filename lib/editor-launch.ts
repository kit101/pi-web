import { spawn } from "node:child_process";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
// @ts-expect-error Node's direct TypeScript tests require an explicit extension.
import { KNOWN_EDITORS, type EditorId, type EditorSelection } from "./editor-config.ts";

export interface EditorActionRequest {
  filePath: string;
  editorId: EditorId;
  customExecutable?: string;
}

export interface EditorCommand {
  command: string;
  args: string[];
}

type FilePathAllowedChecker = (target: string, allowedRoots: Set<string>) => boolean;

const EDITOR_IDS = new Set<string>([
  ...KNOWN_EDITORS.map((editor) => editor.id),
  "custom",
]);

export function parseEditorActionRequest(value: unknown): EditorActionRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (typeof record.filePath !== "string") return null;
  if (typeof record.editorId !== "string" || !EDITOR_IDS.has(record.editorId)) return null;
  if (record.customExecutable !== undefined && typeof record.customExecutable !== "string") {
    return null;
  }

  const request: EditorActionRequest = {
    filePath: record.filePath,
    editorId: record.editorId as EditorId,
  };
  if (typeof record.customExecutable === "string") {
    request.customExecutable = record.customExecutable;
  }
  return request;
}

export function buildEditorCommand(
  selection: EditorSelection,
  filePath: string,
): EditorCommand {
  if (selection.id === "custom") {
    return { command: selection.executablePath, args: [filePath] };
  }

  const editor = KNOWN_EDITORS.find((candidate) => candidate.id === selection.id);
  if (!editor) throw new Error("Unknown editor");
  return { command: editor.command, args: [filePath] };
}

export function validateCustomExecutable(executablePath: string): string | null {
  if (!path.isAbsolute(executablePath)) {
    return "Custom executable path must be absolute";
  }

  let stat;
  try {
    stat = lstatSync(executablePath);
  } catch {
    return "Custom executable must be an existing executable file";
  }

  if (stat.isSymbolicLink() || !stat.isFile()) {
    return "Custom executable must be a regular file; symbolic links are not allowed";
  }

  try {
    accessSync(executablePath, constants.X_OK);
  } catch {
    return "Custom executable file must be executable";
  }
  return null;
}

/**
 * Dependency-free equivalent of file-access.ts's containment check. Node's
 * direct TypeScript test runner cannot load that module's extensionless
 * dependency graph, so production callers pass isFilePathAllowed explicitly.
 */
function defaultIsFilePathAllowed(target: string, allowedRoots: Set<string>): boolean {
  const normalizedTarget = path.resolve(target);
  for (const root of allowedRoots) {
    const normalizedRoot = path.resolve(root);
    const relative = path.relative(normalizedRoot, normalizedTarget);
    if (relative === "") return true;
    if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
      return true;
    }
  }
  return false;
}

function resolveCanonicalCandidate(filePath: string): string {
  let ancestor = path.resolve(filePath);
  const suffix: string[] = [];

  while (true) {
    try {
      return path.resolve(realpathSync(ancestor), ...suffix);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;

      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      suffix.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
}

export function resolveAllowedEditorFile(
  filePath: string,
  roots: Set<string>,
  isAllowed: FilePathAllowedChecker = defaultIsFilePathAllowed,
): string {
  if (!isAllowed(filePath, roots)) throw new Error("Access denied");

  const realRoots = new Set<string>();
  for (const root of roots) {
    try {
      realRoots.add(realpathSync(root));
    } catch {
      // Stale session roots are ignored; they cannot authorize a real target.
    }
  }

  const canonicalCandidate = resolveCanonicalCandidate(filePath);
  if (!isAllowed(canonicalCandidate, realRoots)) throw new Error("Access denied");

  const stat = lstatSync(filePath);
  if (stat.isSymbolicLink()) {
    throw new Error("Editor target must not be a symbolic link");
  }
  if (!stat.isFile()) throw new Error("Editor target is not a file");

  const realFilePath = realpathSync(filePath);
  if (!isAllowed(realFilePath, realRoots)) throw new Error("Access denied");
  return realFilePath;
}

export function launchEditor(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      detached: true,
      stdio: "ignore",
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
    child.once("error", reject);
  });
}
