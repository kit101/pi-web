"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  normalizeEditorPath,
  parseEditorId,
  type EditorId,
} from "@/lib/editor-config";

const EDITOR_KEY = "pi-editor";
const EDITOR_PATH_KEY = "pi-editor-path";
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getEditorSnapshot(): EditorId {
  if (typeof window === "undefined") return "vscode";
  try {
    return parseEditorId(localStorage.getItem(EDITOR_KEY));
  } catch {
    return "vscode";
  }
}

function getEditorServerSnapshot(): EditorId {
  return "vscode";
}

function getEditorPathSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizeEditorPath(localStorage.getItem(EDITOR_PATH_KEY));
  } catch {
    return "";
  }
}

function getEditorPathServerSnapshot(): string {
  return "";
}

function notifyListeners(): void {
  listeners.forEach((cb) => cb());
}

export function useEditor() {
  const editorId = useSyncExternalStore(
    subscribe,
    getEditorSnapshot,
    getEditorServerSnapshot,
  );
  const editorPath = useSyncExternalStore(
    subscribe,
    getEditorPathSnapshot,
    getEditorPathServerSnapshot,
  );

  const setEditor = useCallback((next: EditorId) => {
    try {
      localStorage.setItem(EDITOR_KEY, next);
    } catch {
      // ignore storage errors
    }
    notifyListeners();
  }, []);

  const setEditorPath = useCallback((next: string) => {
    try {
      localStorage.setItem(EDITOR_PATH_KEY, next);
    } catch {
      // ignore storage errors
    }
    notifyListeners();
  }, []);

  return {
    editorId,
    editorPath,
    editorSelection: { id: editorId, executablePath: editorPath },
    setEditor,
    setEditorPath,
  };
}
