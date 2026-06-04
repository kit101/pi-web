"use client";

import React, { useEffect, useRef } from "react";
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
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onDismissRef.current();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
      left: Math.max(0, Math.min(position.left, vw - panelWidth - 8)),
      top: Math.max(0, Math.min(position.top, vh - panelHeight - 8)),
    };
  })();

  return (
    <div
      ref={panelRef}
      role="listbox"
      aria-busy={loading}
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
          key={item.fullPath}
          role="option"
          aria-selected={i === selectedIndex}
          data-selected={i === selectedIndex ? "true" : undefined}
          onClick={() => onSelect(item)}
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
