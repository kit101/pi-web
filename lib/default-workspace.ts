import { lstatSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

export function getDefaultWorkspaceRoot(home: string): string {
  return join(home, ".pi", "default-workspace");
}

export function getDefaultWorkspacePath(home: string, date: Date): string {
  const dateDirectory = date.toISOString().slice(0, 10).replace(/-/g, "");
  return join(getDefaultWorkspaceRoot(home), dateDirectory);
}

export function isDefaultWorkspaceDirectoryName(name: string): boolean {
  return /^\d{8}$/.test(name);
}

export function listDefaultWorkspaceDirectories(home: string): string[] {
  const root = getDefaultWorkspaceRoot(home);
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isDefaultWorkspaceDirectoryName(entry.name))
      .map((entry) => join(root, entry.name));
  } catch {
    return [];
  }
}

export function ensureDefaultWorkspaceDirectory(home: string, date: Date): string {
  const dir = getDefaultWorkspacePath(home, date);
  mkdirSync(dir, { recursive: true });
  const stat = lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Default workspace path must be a real directory");
  }
  return dir;
}
