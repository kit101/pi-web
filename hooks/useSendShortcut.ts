"use client";

import { useCallback, useSyncExternalStore } from "react";

export type SendShortcut = "enter-send" | "mod-enter-send";

export function shouldSendOnEnter(
  shortcut: SendShortcut,
  modifierPressed: boolean,
  shiftPressed: boolean,
): boolean {
  if (shiftPressed) return false;
  return shortcut === "mod-enter-send" ? modifierPressed : !modifierPressed;
}

export function getNextSendShortcut(shortcut: SendShortcut): SendShortcut {
  return shortcut === "mod-enter-send" ? "enter-send" : "mod-enter-send";
}

export function parseSendShortcut(value: string | null): SendShortcut {
  return value === "enter-send" || value === "mod-enter-send"
    ? value
    : "mod-enter-send";
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): SendShortcut {
  if (typeof window === "undefined") return "mod-enter-send";
  try {
    return parseSendShortcut(localStorage.getItem("pi-send-shortcut"));
  } catch {
    return "mod-enter-send";
  }
}

function getServerSnapshot(): SendShortcut {
  return "mod-enter-send";
}

export function useSendShortcut() {
  const sendShortcut = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setSendShortcut = useCallback((next: SendShortcut) => {
    try {
      localStorage.setItem("pi-send-shortcut", next);
    } catch {
      // ignore storage errors
    }
    listeners.forEach((cb) => cb());
  }, []);

  return { sendShortcut, setSendShortcut };
}
