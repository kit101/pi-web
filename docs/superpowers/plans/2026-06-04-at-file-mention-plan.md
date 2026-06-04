# @ File Mention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to type `@` in the chat input to trigger a popup autocomplete panel for selecting files and folders, inserting them as `` `relative/path` `` markdown.

**Architecture:** New `useFileMention` hook (detection, search, data loading) + new `MentionPopup` component (UI, keyboard nav) integrated into existing `ChatInput.tsx`. No changes to backend APIs.

**Tech Stack:** React 19, TypeScript, plain `<textarea>`, hidden canvas caret positioning, `/api/files/[...path]?type=list` REST API.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/types.ts` | Modify | Add `FileMentionItem` type |
| `lib/file-paths.ts` | Modify | Add `getRelativeFolderPath` |
| `components/MentionPopup.tsx` | Create | Popup UI: list rendering, hover, keyboard nav, positioning |
| `hooks/useFileMention.ts` | Create | Core logic: @ detection, caret coords, hybrid file data loading, filtering |
| `hooks/useFileMentionCaret.ts` | Create | Caret coordinate calculation via hidden canvas |
| `components/ChatInput.tsx` | Modify | Integrate useFileMention hook, render MentionPopup, adjust key handling |

---

### Task 1: Add types and utilities

**Files:**
- Modify: `lib/types.ts` (append)
- Modify: `lib/file-paths.ts` (append)

- [ ] **Step 1: Add `FileMentionItem` type to `lib/types.ts`**

Append before the last export (after line 166, before `export type FileEntry`):

```typescript
export interface FileMentionItem {
  label: string;        // Display name (filename or folder name)
  type: "file" | "folder";
  fullPath: string;     // Absolute path for API calls
  relativePath: string; // Relative path for insertion
}
```

- [ ] **Step 2: Add `getRelativeFolderPath` to `lib/file-paths.ts`**

Append after the existing `joinFilePath` function:

```typescript
export function getRelativeFolderPath(folderPath: string, cwd?: string): string {
  if (!cwd) return folderPath;
  const normalizedFolder = normalizeFilePathSlashes(folderPath).replace(/\/+$/, "");
  const normalizedCwd = normalizeFilePathSlashes(cwd).replace(/\/+$/, "");
  if (normalizedFolder.startsWith(normalizedCwd + "/")) {
    return normalizedFolder.slice(normalizedCwd.length + 1) + "/";
  }
  return folderPath.endsWith("/") ? folderPath : folderPath + "/";
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors)

---

### Task 2: Create caret position hook

**Files:**
- Create: `hooks/useFileMentionCaret.ts`

- [ ] **Step 1: Create the hook file**

Create `hooks/useFileMentionCaret.ts`:

```typescript
import { useRef, useCallback } from "react";

interface CaretPosition {
  left: number;
  top: number;
}

interface Options {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Calculates the on-screen pixel position of the text cursor
 * in a <textarea> using a hidden canvas approximation.
 * Returns { left, top } relative to the viewport.
 */
export function useFileMentionCaret({ textareaRef }: Options) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getContext = useCallback(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    return canvasRef.current.getContext("2d");
  }, []);

  const getCaretPosition = useCallback((): CaretPosition | null => {
    const ta = textareaRef.current;
    if (!ta) return null;

    const ctx = getContext();
    if (!ctx) return null;

    const style = getComputedStyle(ta);
    ctx.font = style.font;

    const text = ta.value.substring(0, ta.selectionStart);
    const lines = text.split("\n");
    const currentLine = lines.length - 1;
    const currentText = lines[currentLine];

    // Measure line width up to cursor
    const lineWidth = ctx.measureText(currentText).width;

    // Calculate top offset: line height * line count
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    const paddingTop = parseFloat(style.paddingTop);
    const paddingLeft = parseFloat(style.paddingLeft);
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;

    // Get textarea position relative to viewport
    const rect = ta.getBoundingClientRect();

    const left = rect.left + paddingLeft + borderLeft + lineWidth + window.scrollX;
    const top = rect.top + borderTop + paddingTop + lineHeight * lines.length + window.scrollY;

    return { left, top };
  }, [textareaRef, getContext]);

  return { getCaretPosition };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: PASS

---

### Task 3: Create the `useFileMention` hook

**Files:**
- Create: `hooks/useFileMention.ts`

- [ ] **Step 1: Create the hook file**

Create `hooks/useFileMention.ts`:

```typescript
import { useState, useCallback, useEffect, useRef } from "react";
import { FileMentionItem } from "@/lib/types";
import { encodeFilePathForApi, getRelativeFilePath, getRelativeFolderPath, getFileName } from "@/lib/file-paths";
import { useFileMentionCaret } from "./useFileMentionCaret";

interface UseFileMentionOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  cwd: string;
}

interface UseFileMentionReturn {
  active: boolean;
  searchTerm: string;
  position: { left: number; top: number };
  matches: FileMentionItem[];
  loading: boolean;
  selectedIndex: number;
  selectItem: (item: FileMentionItem) => void;
  dismiss: () => void;
  onChange: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

interface CachedDirEntry {
  name: string;
  isDir: boolean;
}

const MENTION_REGEX = /@\S*$/;
const MAX_RESULTS = 20;

export function useFileMention({ textareaRef, cwd }: UseFileMentionOptions): UseFileMentionReturn {
  const [active, setActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [matches, setMatches] = useState<FileMentionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { getCaretPosition } = useFileMentionCaret({ textareaRef });
  const cacheRef = useRef<Map<string, CachedDirEntry[]>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flatten cached entries into FileMentionItem[] matching searchTerm
  const buildMatches = useCallback(
    (term: string): FileMentionItem[] => {
      const results: FileMentionItem[] = [];
      const query = term.toLowerCase();

      for (const [, entries] of cacheRef.current) {
        for (const entry of entries) {
          if (entry.name.toLowerCase().includes(query)) {
            const fullPath = entry.name; // already full path from cache
            const relativePath = entry.isDir
              ? getRelativeFolderPath(fullPath, cwd)
              : getRelativeFilePath(fullPath, cwd);
            results.push({
              label: getFileName(entry.name),
              type: entry.isDir ? "folder" : "file",
              fullPath,
              relativePath,
            });
          }
        }
      }

      return results.slice(0, MAX_RESULTS);
    },
    [cwd]
  );

  // Fetch a directory's entries and cache them
  const fetchDir = useCallback(async (dirPath: string) => {
    if (cacheRef.current.has(dirPath)) return;
    try {
      const encoded = encodeFilePathForApi(dirPath);
      const res = await fetch(`/api/files/${encoded}?type=list`);
      if (!res.ok) return;
      const data = (await res.json()) as { entries?: { name: string; isDir: boolean }[] };
      const entries: CachedDirEntry[] = (data.entries ?? []).map((e) => ({
        name: `${dirPath}/${e.name}`,
        isDir: e.isDir,
      }));
      cacheRef.current.set(dirPath, entries);
    } catch {
      // ignore
    }
  }, []);

  // Load initial directory tree (depth 2 from cwd)
  const loadInitialTree = useCallback(async () => {
    await fetchDir(cwd);
    // Fetch one level deeper
    const cwdEntries = cacheRef.current.get(cwd) ?? [];
    const dirs = cwdEntries.filter((e) => e.isDir).slice(0, 20); // limit to avoid huge requests
    await Promise.all(dirs.map((d) => fetchDir(d.name)));
  }, [cwd, fetchDir]);

  useEffect(() => {
    loadInitialTree();
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [loadInitialTree]);

  // Detect @ mention and update state
  const onChange = useCallback(
    (value: string) => {
      if (!textareaRef.current) {
        dismiss();
        return;
      }

      const cursorPos = textareaRef.current.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPos);
      const match = textBeforeCursor.match(MENTION_REGEX);

      if (match) {
        const term = match[0].slice(1); // remove @
        setSearchTerm(term);
        setActive(true);

        const caretPos = getCaretPosition();
        if (caretPos) {
          setPosition({ left: caretPos.left + 4, top: caretPos.top + 4 });
        }

        // Debounced search
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          setLoading(true);

          // Check if we need to fetch deeper directories
          if (term.includes("/")) {
            const pathParts = term.split("/");
            // Build the directory path up to the last separator
            const dirPath = `${cwd}/${pathParts.slice(0, -1).join("/")}`;
            fetchDir(dirPath).finally(() => {
              setMatches(buildMatches(term));
              setSelectedIndex(0);
              setLoading(false);
            });
          } else {
            // Search existing cache
            setMatches(buildMatches(term));
            setSelectedIndex(0);
            setLoading(false);
          }
        }, 150);
      } else {
        dismiss();
      }
    },
    [textareaRef, getCaretPosition, cwd, fetchDir, buildMatches]
  );

  const dismiss = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setActive(false);
    setSearchTerm("");
    setMatches([]);
    setSelectedIndex(0);
    setLoading(false);
  }, []);

  const selectItem = useCallback(
    (item: FileMentionItem) => {
      if (!textareaRef.current) return;

      const ta = textareaRef.current;
      const cursorPos = ta.selectionStart;
      const text = ta.value;

      // Find the @ mention start position
      const textBeforeCursor = text.substring(0, cursorPos);
      const match = textBeforeCursor.match(MENTION_REGEX);
      if (!match) return;

      const mentionStart = cursorPos - match[0].length;
      const insertText = "`" + item.relativePath + "` ";
      const newValue =
        text.substring(0, mentionStart) + insertText + text.substring(cursorPos);

      // Update via custom event so ChatInput's onChange picks it up
      ta.value = newValue;
      ta.dispatchEvent(new Event("input", { bubbles: true }));

      const newPos = mentionStart + insertText.length;
      requestAnimationFrame(() => {
        ta.setSelectionRange(newPos, newPos);
        ta.focus();
      });

      dismiss();
    },
    [textareaRef, dismiss]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!active || matches.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.min(i + 1, matches.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        selectItem(matches[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
      }
    },
    [active, matches, selectedIndex, selectItem, dismiss]
  );

  return {
    active,
    searchTerm,
    position,
    matches,
    loading,
    selectedIndex,
    selectItem,
    dismiss,
    onChange,
    handleKeyDown,
  };
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: PASS

---

### Task 4: Create the `MentionPopup` component

**Files:**
- Create: `components/MentionPopup.tsx`

- [ ] **Step 1: Create the component file**

Create `components/MentionPopup.tsx`:

```tsx
"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { FileMentionItem } from "@/lib/types";
import { getFileIcon, FolderIcon } from "./FileIcons";

interface Props {
  position: { left: number; top: number };
  items: FileMentionItem[];
  selectedIndex: number;
  loading: boolean;
  onSelect: (item: FileMentionItem) => void;
  onDismiss: () => void;
}

export function MentionPopup({ position, items, selectedIndex, loading, onSelect, onDismiss }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    // Use capture phase so it fires before other handlers
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onDismiss]);

  // Scroll selected item into view
  useEffect(() => {
    if (!panelRef.current) return;
    const selected = panelRef.current.querySelector("[data-selected=true]") as HTMLElement | null;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Clamp position to viewport
  const clampedPosition = (() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelWidth = 380;
    const panelHeight = Math.min(300, items.length * 36 + (loading ? 20 : 0));
    return {
      left: Math.min(position.left, vw - panelWidth - 8),
      top: Math.min(position.top, vh - panelHeight - 8),
    };
  })();

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        left: clampedPosition.left,
        top: clampedPosition.top,
        zIndex: 1000,
        minWidth: 200,
        maxWidth: 380,
        maxHeight: 300,
        overflowY: "auto",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        padding: 4,
      }}
    >
      {items.map((item, i) => (
        <div
          key={`${item.fullPath}-${i}`}
          data-selected={i === selectedIndex ? "true" : undefined}
          onClick={() => onSelect(item)}
          onMouseEnter={() => {
            // We rely on selectedIndex being updated by parent, so we emit a custom approach:
            // Since we can't change selectedIndex directly here, we use a hover highlight via CSS
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            borderRadius: 4,
            cursor: "pointer",
            background: i === selectedIndex ? "var(--bg-hover)" : "transparent",
            fontSize: 12,
            color: "var(--text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            {item.type === "folder" ? <FolderIcon size={14} /> : getFileIcon(item.label, 14)}
          </span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.label}
          </span>
          {item.type === "folder" && (
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>folder</span>
          )}
        </div>
      ))}
      {loading && items.length === 0 && (
        <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-dim)" }}>
          Loading...
        </div>
      )}
      {!loading && items.length === 0 && (
        <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-dim)" }}>
          No matching files
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: PASS

---

### Task 5: Integrate into ChatInput

**Files:**
- Modify: `components/ChatInput.tsx`

- [ ] **Step 1: Add imports**

At the top of `ChatInput.tsx`, add after the existing imports (line 3):

```typescript
import { MentionPopup } from "./MentionPopup";
import { useFileMention } from "@/hooks/useFileMention";
```

- [ ] **Step 2: Add `cwd` prop to ChatInput Props interface**

Modify the Props interface (around line 17) to add:

```typescript
  cwd?: string;
```

Full updated Props interface (add one line):
```typescript
interface Props {
  onSend: (message: string, images?: AttachedImage[]) => void;
  onAbort: () => void;
  onSteer?: (message: string, images?: AttachedImage[]) => void;
  onFollowUp?: (message: string, images?: AttachedImage[]) => void;
  isStreaming: boolean;
  model?: { provider: string; modelId: string } | null;
  modelNames?: Record<string, string>;
  modelList?: { id: string; name: string; provider: string }[];
  onModelChange?: (provider: string, modelId: string) => void;
  onCompact?: () => void;
  onAbortCompaction?: () => void;
  isCompacting?: boolean;
  compactError?: string | null;
  toolPreset?: "none" | "default" | "full";
  onToolPresetChange?: (preset: "none" | "default" | "full") => void;
  thinkingLevel?: "auto" | "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  onThinkingLevelChange?: (level: "auto" | "off" | "minimal" | "low" | "medium" | "high" | "xhigh") => void;
  availableThinkingLevels?: string[] | null;
  thinkingLevelMap?: Record<string, string | null> | null;
  retryInfo?: { attempt: number; maxAttempts: number; errorMessage?: string } | null;
  soundEnabled?: boolean;
  onSoundToggle?: () => void;
  cwd?: string;  // <-- new
}
```

- [ ] **Step 3: Destructure cwd in component**

Update the destructuring (line 63):
```typescript
export const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput({
  onSend, onAbort, onSteer, onFollowUp, isStreaming, model, modelNames, modelList, onModelChange,
  onCompact, onAbortCompaction, isCompacting, compactError, toolPreset, onToolPresetChange,
  thinkingLevel, onThinkingLevelChange, availableThinkingLevels, thinkingLevelMap,
  retryInfo,
  soundEnabled, onSoundToggle,
  cwd,
}: Props, ref) {
```

- [ ] **Step 4: Initialize useFileMention hook**

Add after the existing state declarations (around line 74, after `attachedImages`):

```typescript
  const mention = useFileMention({ textareaRef, cwd: cwd ?? "" });
```

- [ ] **Step 5: Wire onChange to mention detection**

Replace the existing onChange handler on the textarea (line 352):

```typescript
// FROM:
onChange={(e) => setValue(e.target.value)}
// TO:
onChange={(e) => {
  setValue(e.target.value);
  mention.onChange(e.target.value);
}}
```

- [ ] **Step 6: Wire handleKeyDown to mention navigation**

Replace the existing `handleKeyDown` function (lines 186-199):

```typescript
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Let mention handle navigation keys when popup is active
      mention.handleKeyDown(e);
      if (e.defaultPrevented) return;

      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (isStreaming && (onSteer || onFollowUp)) {
          sendQueued(onSteer ? "steer" : "followup");
        } else {
          handleSend();
        }
      }
    },
    [isStreaming, onSteer, onFollowUp, sendQueued, handleSend, mention]
  ),
```

- [ ] **Step 7: Render MentionPopup**

Add after the textarea closing tag and before the `{isStreaming ? (...) : (...)}` send button block (around line 378, right after the `</textarea>`):

```tsx
          {/* @ File Mention Popup */}
          {cwd && mention.active && mention.matches.length > 0 && (
            <MentionPopup
              position={mention.position}
              items={mention.matches}
              selectedIndex={mention.selectedIndex}
              loading={mention.loading}
              onSelect={mention.selectItem}
              onDismiss={mention.dismiss}
            />
          )}
```

- [ ] **Step 8: Pass cwd from ChatWindow to ChatInput**

In `components/ChatWindow.tsx`, compute the effective cwd for the chat input (around line 170, before `chatInputElement`):

```typescript
  const chatCwd = session?.cwd ?? newSessionCwd ?? null;
```

Then add `cwd={chatCwd ?? undefined}` to the ChatInput element (line 171-196):

```tsx
  const chatInputElement = (
    <ChatInput
      ref={chatInputRef}
      onSend={handleSend}
      onAbort={handleAbort}
      // ... all existing props ...
      onSoundToggle={onSoundToggle}
      cwd={chatCwd}
    />
  );
```

- [ ] **Step 9: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 10: Quick manual verification**

Run: `npx next dev` (or use the project's dev command)
Expected: App starts, typing `@` in chat input shows a popup with file suggestions (if cwd is set), selecting an item inserts `` `relative/path` `` into the textarea.
