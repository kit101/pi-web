"use client";

import { useCallback, useSyncExternalStore } from "react";

type SendShortcut = "enter-send" | "mod-enter-send";

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
    return (localStorage.getItem("pi-send-shortcut") as SendShortcut) || "mod-enter-send";
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
