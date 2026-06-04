"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getEditorSnapshot(): string {
  if (typeof window === "undefined") return "vscode";
  try {
    return localStorage.getItem("pi-editor") || "vscode";
  } catch {
    return "vscode";
  }
}

function getEditorPathSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("pi-editor-path") || "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

export function useEditor() {
  const editorId = useSyncExternalStore(subscribe, getEditorSnapshot, () => "vscode");
  const editorPath = useSyncExternalStore(subscribe, getEditorPathSnapshot, getServerSnapshot);

  const setEditor = useCallback((id: string) => {
    try {
      localStorage.setItem("pi-editor", id);
    } catch {
      // ignore storage errors
    }
    listeners.forEach((cb) => cb());
  }, []);

  const setEditorPath = useCallback((path: string) => {
    try {
      localStorage.setItem("pi-editor-path", path);
    } catch {
      // ignore storage errors
    }
    listeners.forEach((cb) => cb());
  }, []);

  return { editorId, editorPath, setEditor, setEditorPath };
}
