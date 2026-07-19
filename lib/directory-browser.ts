import { lstatSync, readdirSync, readlinkSync, realpathSync } from "fs";
import path from "path";

const IGNORED_NAMES = new Set([
  "node_modules", ".git", ".next", "dist", "build", "__pycache__",
  ".turbo", ".cache", "coverage", ".pytest_cache", ".mypy_cache",
  "target", "vendor", ".DS_Store",
]);

const IGNORED_SUFFIXES = [".pyc"];
const WINDOWS_ABSOLUTE_RE = /^[a-zA-Z]:[\\/]/;

type FilePathAllowedChecker = (target: string, allowedRoots: Set<string>) => boolean;

export interface DirectoryBrowserEntry {
  name: string;
  path: string;
}

export interface DirectoryBrowserLocation {
  directory: string;
  root: string;
}

export class DirectoryBrowserError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DirectoryBrowserError";
    this.status = status;
  }
}

/**
 * Dependency-free equivalent of file-access.ts's containment check. Node's
 * direct TypeScript test runner cannot load that module's dependency graph;
 * production callers pass isFilePathAllowed explicitly.
 */
function defaultIsFilePathAllowed(target: string, allowedRoots: Set<string>): boolean {
  for (const root of allowedRoots) {
    const useWindowsRules = WINDOWS_ABSOLUTE_RE.test(target)
      || target.startsWith("\\\\")
      || target.startsWith("//")
      || WINDOWS_ABSOLUTE_RE.test(root)
      || root.startsWith("\\\\")
      || root.startsWith("//");
    const resolver = useWindowsRules ? path.win32 : path;
    const separator = useWindowsRules ? "\\" : path.sep;
    const normalizedTarget = resolver.resolve(target);
    const normalizedRoot = resolver.resolve(root);
    const comparableTarget = useWindowsRules ? normalizedTarget.toLowerCase() : normalizedTarget;
    const comparableRoot = useWindowsRules ? normalizedRoot.toLowerCase() : normalizedRoot;
    const rootWithSeparator = comparableRoot.endsWith(separator)
      ? comparableRoot
      : comparableRoot + separator;
    if (comparableTarget === comparableRoot || comparableTarget.startsWith(rootWithSeparator)) {
      return true;
    }
  }
  return false;
}

function normalizeCandidate(candidate: string): string {
  if (!candidate) {
    throw new DirectoryBrowserError("Path is required", 400);
  }
  if (candidate.includes("\0")) {
    throw new DirectoryBrowserError("Path contains an invalid character", 400);
  }
  if (!path.isAbsolute(candidate)) {
    throw new DirectoryBrowserError("Path must be absolute", 400);
  }

  return path.resolve(candidate);
}

function resolveCanonicalCandidate(candidate: string): string {
  let ancestor = candidate;
  const suffix: string[] = [];
  const visitedSymlinks = new Set<string>();

  while (true) {
    try {
      return path.resolve(realpathSync(ancestor), ...suffix);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR" && code !== "ELOOP") throw error;

      let stat;
      try {
        stat = lstatSync(ancestor);
      } catch (lstatError) {
        const lstatCode = (lstatError as NodeJS.ErrnoException).code;
        if (lstatCode !== "ENOENT" && lstatCode !== "ENOTDIR" && lstatCode !== "ELOOP") {
          throw lstatError;
        }

        const parent = path.dirname(ancestor);
        if (parent === ancestor) throw error;
        suffix.unshift(path.basename(ancestor));
        ancestor = parent;
        continue;
      }

      if (!stat.isSymbolicLink()) throw error;
      if (visitedSymlinks.has(ancestor)) {
        const loopError = new Error("Too many symbolic links") as NodeJS.ErrnoException;
        loopError.code = "ELOOP";
        throw loopError;
      }
      visitedSymlinks.add(ancestor);

      const linkTarget = readlinkSync(ancestor);
      const resolvedTarget = path.isAbsolute(linkTarget)
        ? linkTarget
        : path.resolve(path.dirname(ancestor), linkTarget);
      ancestor = path.resolve(resolvedTarget, ...suffix);
      suffix.length = 0;
    }
  }
}

export function resolveBrowsableDirectory(
  candidate: string,
  roots: Iterable<string>,
  isAllowed: FilePathAllowedChecker = defaultIsFilePathAllowed,
): DirectoryBrowserLocation {
  const normalizedCandidate = normalizeCandidate(candidate);
  const lexicalRoots = new Set<string>();
  const realRoots = new Set<string>();

  for (const root of roots) {
    if (!root) continue;
    const normalizedRoot = path.resolve(root);
    lexicalRoots.add(normalizedRoot);
    try {
      const realRoot = realpathSync(normalizedRoot);
      lexicalRoots.add(realRoot);
      realRoots.add(realRoot);
    } catch {
      // Stale or unreadable roots cannot authorize a directory.
    }
  }

  if (!isAllowed(normalizedCandidate, lexicalRoots)) {
    throw new DirectoryBrowserError("Access denied", 403);
  }

  let canonicalCandidate: string;
  try {
    canonicalCandidate = resolveCanonicalCandidate(normalizedCandidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new DirectoryBrowserError("Invalid directory path: symbolic link loop", 400);
    }
    throw error;
  }
  if (!isAllowed(canonicalCandidate, realRoots)) {
    throw new DirectoryBrowserError("Access denied", 403);
  }

  let stat;
  try {
    stat = lstatSync(normalizedCandidate);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new DirectoryBrowserError("Directory not found", 404);
    }
    if (code === "ENOTDIR") {
      throw new DirectoryBrowserError("Path is not a directory", 400);
    }
    throw error;
  }
  if (stat.isSymbolicLink()) {
    throw new DirectoryBrowserError("Directory must not be a symbolic link", 400);
  }
  if (!stat.isDirectory()) {
    throw new DirectoryBrowserError("Path is not a directory", 400);
  }

  const directory = realpathSync(normalizedCandidate);
  const containingRoots = new Set<string>();

  for (const realRoot of realRoots) {
    if (isAllowed(directory, new Set([realRoot]))) {
      containingRoots.add(realRoot);
    }
  }

  const selectedRoot = [...containingRoots].sort((a, b) => b.length - a.length)[0];
  if (!selectedRoot) {
    throw new DirectoryBrowserError("Access denied", 403);
  }

  return { directory, root: selectedRoot };
}

export function listBrowsableDirectories(directory: string): DirectoryBrowserEntry[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => (
      entry.isDirectory()
      && !IGNORED_NAMES.has(entry.name)
      && !IGNORED_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))
    ))
    .map((entry) => ({
      name: entry.name,
      path: path.join(directory, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getBrowsableParent(
  directory: string,
  root: string,
  isAllowed: FilePathAllowedChecker = defaultIsFilePathAllowed,
): string | null {
  const allowedRoot = new Set([root]);
  if (!isAllowed(directory, allowedRoot)) return null;

  const normalizedDirectory = path.resolve(directory);
  const normalizedRoot = path.resolve(root);
  if (normalizedDirectory === normalizedRoot) return null;

  const parent = path.dirname(normalizedDirectory);
  return isAllowed(parent, allowedRoot) ? parent : null;
}
