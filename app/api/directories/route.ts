import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { listAllSessions } from "@/lib/session-reader";

/**
 * Server-side directory browser. Returns subdirectories at a given path.
 * GET /api/directories?path=/some/path  → { entries: [{ name, path, modified }] }
 * GET /api/directories?root=1           → { root: "/home/user", entries: [...] }  (top-level dirs from home)
 */

const IGNORED_NAMES = new Set([
  "node_modules", ".git", ".next", "dist", "build", "__pycache__",
  ".turbo", ".cache", ".DS_Store", "vendor",
]);

// Short-TTL cache for the allowed-roots set.
declare global {
  var __piAllowedRootsCache: { roots: Set<string>; expiresAt: number } | undefined;
}

const ALLOWED_ROOTS_TTL_MS = 5_000;
const WINDOWS_ABSOLUTE_RE = /^[a-zA-Z]:[\\/]/;

function isWindowsAbsolutePath(filePath: string): boolean {
  return WINDOWS_ABSOLUTE_RE.test(filePath) || filePath.startsWith("\\\\") || filePath.startsWith("//");
}

async function getAllowedRoots(): Promise<Set<string>> {
  const now = Date.now();
  const cached = globalThis.__piAllowedRootsCache;
  if (cached && cached.expiresAt > now) return cached.roots;

  const sessions = await listAllSessions();
  const roots = new Set<string>();
  for (const s of sessions) {
    if (s.cwd) roots.add(s.cwd);
  }
  // Also allow ~/.pi/default-workspace/<YYYYMMDD> created by the default-cwd endpoint
  const home = (await import("os")).homedir();
  const { readdirSync } = await import("fs");
  try {
    const wsDir = path.join(home, ".pi", "default-workspace");
    for (const name of readdirSync(wsDir)) {
      if (/^\d{8}$/.test(name)) {
        roots.add(path.join(wsDir, name));
      }
    }
  } catch {
    // ignore if dir doesn't exist or is unreadable
  }

  // Include home so the directory browser can navigate through it
  roots.add(home);

  globalThis.__piAllowedRootsCache = { roots, expiresAt: now + ALLOWED_ROOTS_TTL_MS };
  return roots;
}

function isPathAllowed(target: string, allowedRoots: Set<string>): boolean {
  for (const root of allowedRoots) {
    const useWindowsRules = isWindowsAbsolutePath(target) || isWindowsAbsolutePath(root);
    const resolver = useWindowsRules ? path.win32 : path;
    const sep = useWindowsRules ? "\\" : path.sep;
    const normalized = resolver.resolve(target);
    const normalizedRoot = resolver.resolve(root);
    const comparable = useWindowsRules ? normalized.toLowerCase() : normalized;
    const comparableRoot = useWindowsRules ? normalizedRoot.toLowerCase() : normalizedRoot;
    const rootWithSep = comparableRoot.endsWith(sep) ? comparableRoot : comparableRoot + sep;
    if (comparable === comparableRoot || comparable.startsWith(rootWithSep)) {
      return true;
    }
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const rootParam = url.searchParams.get("root");
    const dirParam = url.searchParams.get("path");
    const allowedRoots = await getAllowedRoots();

    if (rootParam) {
      // Return top-level directories from the user's home directory
      const home = (await import("os")).homedir();
      const entries = readDirectories(home);
      return NextResponse.json({ root: home, entries });
    }

    if (!dirParam) {
      // Default: show home directory roots
      const home = (await import("os")).homedir();
      const entries = readDirectories(home);
      return NextResponse.json({ root: home, entries });
    }

    const targetDir = dirParam;
    if (!isPathAllowed(targetDir, allowedRoots)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!fs.existsSync(targetDir)) {
      return NextResponse.json({ error: "Directory not found" }, { status: 404 });
    }

    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const entries = readDirectories(targetDir);
    const parentPath = path.dirname(targetDir);
    return NextResponse.json({
      root: targetDir,
      parent: parentPath !== targetDir ? parentPath : null,
      entries,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function readDirectories(dirPath: string): Array<{ name: string; path: string; modified: string }> {
  try {
    const names = fs.readdirSync(dirPath);
    return names
      .filter((name) => !IGNORED_NAMES.has(name))
      .map((name) => {
        const full = path.join(dirPath, name);
        try {
          const s = fs.statSync(full);
          if (!s.isDirectory()) return null;
          return { name, path: full, modified: s.mtime.toISOString() };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name)) as Array<{ name: string; path: string; modified: string }>;
  } catch {
    return [];
  }
}
