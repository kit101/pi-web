"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { FolderIcon } from "@/components/FileIcons";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getDirectoryBrowserKeyAction } from "@/lib/directory-browser";

interface WorkspaceDirectoryBrowserProps {
  onClose: () => void;
  onSelect: (cwd: string) => void;
}

interface DirectoryEntry {
  name: string;
  path: string;
}

interface DirectoryResponse {
  path: string;
  root: string;
  parent: string | null;
  entries: DirectoryEntry[];
  error?: string;
}

interface ValidationResponse {
  cwd?: string;
  error?: string;
}

interface Breadcrumb {
  label: string;
  path: string;
}

function errorMessage(payload: { error?: string }, fallback: string): string {
  return typeof payload.error === "string" && payload.error.trim()
    ? payload.error
    : fallback;
}

function breadcrumbsFor(location: DirectoryResponse): Breadcrumb[] {
  const separator = location.path.includes("\\") || location.root.includes("\\")
    ? "\\"
    : "/";
  const rootParts = location.root.split(/[\\/]/).filter(Boolean);
  const rootLabel = location.root === "/"
    ? "/"
    : rootParts.at(-1) ?? location.root;
  const breadcrumbs: Breadcrumb[] = [{ label: rootLabel, path: location.root }];

  const relativePath = location.path === location.root
    ? ""
    : location.path.slice(location.root.length).replace(/^[\\/]+/, "");
  let currentPath = location.root;

  for (const segment of relativePath.split(/[\\/]/).filter(Boolean)) {
    currentPath = currentPath.endsWith(separator)
      ? `${currentPath}${segment}`
      : `${currentPath}${separator}${segment}`;
    breadcrumbs.push({ label: segment, path: currentPath });
  }

  return breadcrumbs;
}

export function WorkspaceDirectoryBrowser({
  onClose,
  onSelect,
}: WorkspaceDirectoryBrowserProps) {
  const isMobile = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);
  const activeEntryRef = useRef<HTMLButtonElement>(null);
  const requestSequence = useRef(0);
  const [location, setLocation] = useState<DirectoryResponse | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (requestedPath?: string) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);

    try {
      const query = requestedPath
        ? `?path=${encodeURIComponent(requestedPath)}`
        : "";
      const response = await fetch(`/api/directories${query}`);
      const payload = await response.json() as DirectoryResponse;
      if (!response.ok) {
        throw new Error(errorMessage(payload, `Unable to open directory (HTTP ${response.status})`));
      }
      if (
        typeof payload.path !== "string"
        || typeof payload.root !== "string"
        || !Array.isArray(payload.entries)
      ) {
        throw new Error("Directory response is invalid");
      }
      if (requestId !== requestSequence.current) return;

      setLocation(payload);
      setPathInput(payload.path);
      setSelectedIndex(-1);
    } catch (requestError) {
      if (requestId !== requestSequence.current) return;
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory();
    dialogRef.current?.focus();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadDirectory]);

  useEffect(() => {
    activeEntryRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const breadcrumbs = useMemo(
    () => location ? breadcrumbsFor(location) : [],
    [location],
  );

  const confirmCurrentDirectory = useCallback(async () => {
    if (!location || confirming) return;
    setConfirming(true);
    setError(null);

    try {
      const response = await fetch("/api/cwd/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: location.path }),
      });
      const payload = await response.json() as ValidationResponse;
      if (!response.ok) {
        throw new Error(errorMessage(payload, `Unable to select directory (HTTP ${response.status})`));
      }

      const normalizedCwd = typeof payload.cwd === "string" ? payload.cwd : "";
      if (!normalizedCwd) throw new Error("Workspace validation response is invalid");
      onSelect(normalizedCwd);
    } catch (validationError) {
      setError(validationError instanceof Error
        ? validationError.message
        : String(validationError));
    } finally {
      setConfirming(false);
    }
  }, [confirming, location, onSelect]);

  const moveSelection = useCallback((delta: -1 | 1) => {
    const entryCount = location?.entries.length ?? 0;
    if (!entryCount) return;
    setSelectedIndex((current) => {
      if (current < 0) return delta > 0 ? 0 : entryCount - 1;
      return Math.max(0, Math.min(entryCount - 1, current + delta));
    });
  }, [location]);

  const handleDialogKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const action = getDirectoryBrowserKeyAction({
      key: event.key,
      modifier: event.metaKey || event.ctrlKey,
    });
    if (!action) return;

    const target = event.target as HTMLElement;
    const isPathInput = target === pathInputRef.current;
    if (isPathInput && action.type !== "close" && action.type !== "focus-path") return;
    if (action.type === "activate" && target.closest("button")) return;

    event.preventDefault();
    event.stopPropagation();

    if (action.type === "close") {
      onClose();
      return;
    }
    if (action.type === "focus-path") {
      pathInputRef.current?.focus();
      pathInputRef.current?.select();
      return;
    }
    if (action.type === "move") {
      moveSelection(action.delta);
      return;
    }
    if (action.type === "parent") {
      if (location?.parent) void loadDirectory(location.parent);
      return;
    }

    const selectedEntry = location?.entries[selectedIndex];
    if (selectedEntry) {
      void loadDirectory(selectedEntry.path);
    } else {
      void confirmCurrentDirectory();
    }
  }, [confirmCurrentDirectory, loadDirectory, location, moveSelection, onClose, selectedIndex]);

  const retryPath = pathInput.trim() || undefined;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? 8 : 20,
        background: "rgba(0,0,0,0.42)",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choose workspace folder"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        style={{
          width: isMobile ? "calc(100vw - 16px)" : 720,
          maxWidth: "calc(100vw - 16px)",
          height: isMobile ? "calc(100dvh - 16px)" : "min(680px, 78vh)",
          maxHeight: "calc(100dvh - 16px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--border)",
          borderRadius: isMobile ? 8 : 10,
          background: "var(--bg)",
          boxShadow: "0 20px 64px rgba(0,0,0,0.32)",
          outline: "none",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: isMobile ? "11px 12px" : "12px 16px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              Choose workspace folder
            </div>
            <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-dim)" }}>
              Arrow keys navigate · Enter opens or selects · {"⌘/Ctrl K"} focuses path
            </div>
          </div>
          <button
            type="button"
            aria-label="Close directory browser"
            onClick={onClose}
            style={{
              flexShrink: 0,
              padding: "2px 6px",
              border: "none",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 9,
            padding: isMobile ? "10px 10px 9px" : "12px 14px 10px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-panel)",
            flexShrink: 0,
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const nextPath = pathInput.trim();
              if (nextPath) void loadDirectory(nextPath);
            }}
            style={{ display: "flex", gap: 7, width: "100%" }}
          >
            <input
              ref={pathInputRef}
              aria-label="Directory path"
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              placeholder="Enter an absolute directory path"
              spellCheck={false}
              style={{
                flex: 1,
                minWidth: 0,
                height: 34,
                padding: "0 10px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--bg)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading || !pathInput.trim()}
              style={{
                height: 34,
                padding: "0 13px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--bg)",
                color: "var(--text-muted)",
                cursor: loading ? "wait" : "pointer",
                fontSize: 12,
              }}
            >
              Go
            </button>
          </form>

          <div
            aria-label="Directory breadcrumbs"
            style={{
              minHeight: 28,
              display: "flex",
              alignItems: "center",
              gap: 3,
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            <button
              type="button"
              disabled={!location?.parent || loading}
              title="Parent directory (Backspace)"
              onClick={() => {
                if (location?.parent) void loadDirectory(location.parent);
              }}
              style={{
                flexShrink: 0,
                width: 28,
                height: 26,
                border: "1px solid var(--border)",
                borderRadius: 5,
                background: "var(--bg)",
                color: location?.parent ? "var(--text-muted)" : "var(--text-dim)",
                cursor: location?.parent && !loading ? "pointer" : "default",
                fontSize: 15,
              }}
            >
              ↑
            </button>
            {breadcrumbs.map((breadcrumb, index) => (
              <div key={breadcrumb.path} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                {index > 0 && <span style={{ color: "var(--text-dim)" }}>/</span>}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void loadDirectory(breadcrumb.path)}
                  title={breadcrumb.path}
                  style={{
                    maxWidth: isMobile ? 128 : 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    padding: "4px 6px",
                    border: "none",
                    borderRadius: 4,
                    background: index === breadcrumbs.length - 1
                      ? "var(--bg-selected)"
                      : "transparent",
                    color: index === breadcrumbs.length - 1
                      ? "var(--text)"
                      : "var(--text-muted)",
                    cursor: loading ? "wait" : "pointer",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    whiteSpace: "nowrap",
                  }}
                >
                  {breadcrumb.label}
                </button>
              </div>
            ))}
          </div>
        </div>

        <main
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: isMobile ? 6 : 8,
            background: "var(--bg)",
          }}
        >
          {loading && !location ? (
            <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 12 }}>
              Loading directories…
            </div>
          ) : location?.entries.length ? (
            <div role="list" aria-label="Directories" style={{ display: "grid", gap: 2 }}>
              {location.entries.map((entry, index) => {
                const selected = index === selectedIndex;
                return (
                  <button
                    key={entry.path}
                    ref={selected ? activeEntryRef : undefined}
                    type="button"
                    role="listitem"
                    aria-current={selected ? "true" : undefined}
                    onFocus={() => setSelectedIndex(index)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => void loadDirectory(entry.path)}
                    style={{
                      width: "100%",
                      minHeight: isMobile ? 42 : 36,
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: isMobile ? "9px 10px" : "7px 9px",
                      border: "1px solid",
                      borderColor: selected
                        ? "color-mix(in srgb, var(--accent) 40%, var(--border))"
                        : "transparent",
                      borderRadius: 6,
                      background: selected ? "var(--bg-selected)" : "transparent",
                      color: "var(--text)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ flexShrink: 0, display: "inline-flex" }}>
                      <FolderIcon size={16} />
                    </span>
                    <span
                      style={{
                        minWidth: 0,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 13,
                      }}
                    >
                      {entry.name}
                    </span>
                    <span aria-hidden="true" style={{ color: "var(--text-dim)", fontSize: 14 }}>
                      ›
                    </span>
                  </button>
                );
              })}
            </div>
          ) : location ? (
            <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 12 }}>
              This folder has no browsable subdirectories.
            </div>
          ) : null}

          {loading && location && (
            <div
              aria-label="Loading directory"
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background: "color-mix(in srgb, var(--bg) 78%, transparent)",
                color: "var(--text-muted)",
                fontSize: 12,
              }}
            >
              Loading…
            </div>
          )}
        </main>

        <footer
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            gap: isMobile ? 8 : 12,
            padding: isMobile ? 10 : "10px 14px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-panel)",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            {error ? (
              <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  title={error}
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#f87171",
                    fontSize: 11,
                  }}
                >
                  {error}
                </span>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void loadDirectory(retryPath)}
                  style={{
                    flexShrink: 0,
                    padding: "2px 6px",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    background: "var(--bg)",
                    color: "var(--text-muted)",
                    cursor: loading ? "wait" : "pointer",
                    fontSize: 10,
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <code
                title={location?.path}
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--text-dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                }}
              >
                {location?.path ?? "Loading…"}
              </code>
            )}
          </div>
          <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                minHeight: 34,
                padding: "0 13px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--bg)",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!location || loading || confirming}
              onClick={() => void confirmCurrentDirectory()}
              style={{
                minHeight: 34,
                padding: "0 15px",
                border: "1px solid var(--accent)",
                borderRadius: 6,
                background: "var(--accent)",
                color: "white",
                cursor: !location || loading || confirming ? "wait" : "pointer",
                opacity: !location || loading || confirming ? 0.6 : 1,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {confirming ? "Selecting…" : "Select folder"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
