"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FileMentionItem } from "@/lib/types";
import { encodeFilePathForApi, getRelativeFilePath, getRelativeFolderPath, getFileName, joinFilePath } from "@/lib/file-paths";
import { useFileMentionCaret } from "./useFileMentionCaret";

interface UseFileMentionOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  cwd: string;
  onInsertMention: (value: string, cursorPos: number) => void;
  onSyncValue: (value: string, cursorPos: number) => void;
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

export function useFileMention({ textareaRef, cwd, onInsertMention, onSyncValue }: UseFileMentionOptions): UseFileMentionReturn {
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

  // Shared search logic: fetch deeper dirs if needed, then build matches
  const performSearch = useCallback(
    async (term: string) => {
      if (term.includes("/")) {
        const pathParts = term.split("/");
        const dirPath = joinFilePath(cwd, pathParts.slice(0, -1).join("/"));
        await fetchDir(dirPath);
      }
      setMatches(buildMatches(term));
      setSelectedIndex(0);
      setLoading(false);
    },
    [cwd, fetchDir, buildMatches]
  );

  const dismiss = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setActive(false);
    setSearchTerm("");
    setMatches([]);
    setSelectedIndex(0);
    setLoading(false);
  }, []);

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
        let term = match[0].slice(1); // remove @
        // Strip opening quote from @"path" format so search matches file paths
        if (term.startsWith("\"")) term = term.slice(1);
        setSearchTerm(term);
        setMatches([]); // clear stale results from previous search
        setActive(true);

        const caretPos = getCaretPosition();
        if (caretPos) {
          setPosition({ left: caretPos.left + 4, top: caretPos.top + 4 });
        }

        // Debounced search
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          setLoading(true);
          performSearch(term);
        }, 150);
      } else {
        dismiss();
      }
    },
    [textareaRef, getCaretPosition, performSearch, dismiss]
  );

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
      // Include trailing closing quote in replacement if cursor is inside @"..."
      const endPos = text.charAt(cursorPos) === "\"" ? cursorPos + 1 : cursorPos;
      const insertText = "@\"" + item.relativePath + "\" ";
      const newValue =
        text.substring(0, mentionStart) + insertText + text.substring(endPos);

      const newPos = mentionStart + insertText.length;
      onInsertMention(newValue, newPos);

      dismiss();
    },
    [textareaRef, dismiss, onInsertMention]
  );

  // Drill down into a folder on Tab: expand the @ token and show folder contents
  const drillDown = useCallback(
    async (item: FileMentionItem) => {
      if (item.type !== "folder") return;
      if (!textareaRef.current) return;

      const ta = textareaRef.current;
      const cursorPos = ta.selectionStart;
      const textBeforeCursor = ta.value.substring(0, cursorPos);
      const match = textBeforeCursor.match(MENTION_REGEX);
      if (!match) return;

      const mentionStart = cursorPos - match[0].length;
      const endPos = ta.value.charAt(cursorPos) === "\"" ? cursorPos + 1 : cursorPos;
      const newPrefix = "@" + item.relativePath;
      const newValue =
        ta.value.substring(0, mentionStart) + newPrefix + ta.value.substring(endPos);
      const newCursorPos = mentionStart + newPrefix.length;

      // Sync textarea value to React state and reposition cursor
      onSyncValue(newValue, newCursorPos);

      // Run search immediately for the new prefix (no debounce)
      const term = item.relativePath;
      setSearchTerm(term);
      setMatches([]);
      setLoading(true);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      await performSearch(term);
    },
    [textareaRef, onSyncValue, performSearch]
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
      } else if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const item = matches[selectedIndex];
        if (item.type === "folder") {
          drillDown(item);
        }
        // files: no action, just prevent default focus jump
      }
    },
    [active, matches, selectedIndex, selectItem, dismiss, drillDown]
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
