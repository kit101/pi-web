"use client";

import React, { useEffect, useRef, useCallback } from "react";

export interface SlashCommand {
  /** 命令名，不含 /，如 "compact" */
  name: string;
  /** 简短描述 */
  description: string;
  /** 可选图标 */
  icon?: React.ReactNode;
  /** 分组：builtin 或 skill */
  group?: "builtin" | "skill";
}

export interface SkillInfo {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  disableModelInvocation: boolean;
  sourceInfo?: { source?: string; scope?: string };
}

const DEFAULT_COMMANDS: SlashCommand[] = [
  {
    name: "compact",
    description: "压缩上下文，减少 token 消耗",
    group: "builtin",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
        <line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" />
      </svg>
    ),
  },
  {
    name: "export",
    description: "导出当前会话为 HTML 文件",
    group: "builtin",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
];

function skillToCommand(s: SkillInfo): SlashCommand {
  return {
    name: s.name,
    description: s.description || s.filePath,
    group: "skill",
  };
}

interface Props {
  open: boolean;
  filter: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  commands?: SlashCommand[];
  skills?: SkillInfo[];
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function SlashCommandPopup({
  open,
  filter,
  onSelect,
  onClose,
  commands = DEFAULT_COMMANDS,
  skills = [],
  anchorRef,
}: Props) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [selectedIdx, setSelectedIdx] = React.useState(0);

  // 合并内置命令和 skills
  const allItems: SlashCommand[] = [
    ...commands.map((c) => ({ ...c, group: (c.group ?? "builtin") as "builtin" | "skill" })),
    ...skills.map(skillToCommand),
  ];

  const filtered = allItems.filter(
    (c) => !filter || c.name.toLowerCase().startsWith(filter.toLowerCase())
  );

  // 按分组拆分：builtin 在前，skill 在后
  const builtins = filtered.filter((c) => c.group === "builtin");
  const skillItems = filtered.filter((c) => c.group === "skill");

  // 重置选中索引
  useEffect(() => {
    setSelectedIdx(0);
  }, [filter]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIdx((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIdx]) {
            onSelect(filtered[selectedIdx]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [open, filtered, selectedIdx, onSelect, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open || filtered.length === 0) return null;

  const renderItem = (cmd: SlashCommand, globalIdx: number) => (
    <div
      key={cmd.group + ":" + cmd.name}
      onClick={() => onSelect(cmd)}
      onMouseEnter={() => setSelectedIdx(globalIdx)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        cursor: "pointer",
        fontSize: 13,
        color: "var(--text)",
        background: globalIdx === selectedIdx ? "var(--bg-selected)" : "transparent",
        transition: "background 0.08s",
        borderBottom: globalIdx < filtered.length - 1 ? "1px solid var(--border)" : "none",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          borderRadius: 5,
          background: cmd.group === "skill" ? "rgba(99,102,241,0.12)" : "var(--bg-hover)",
          color: cmd.group === "skill" ? "rgba(99,102,241,0.8)" : "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        {cmd.icon ?? (
          <span style={{ fontSize: 12, fontWeight: 700 }}>/</span>
        )}
      </span>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 600, lineHeight: 1.3 }}>
            {cmd.group === "skill" ? `/skill:${cmd.name}` : `/${cmd.name}`}
          </span>
          {cmd.group === "skill" && (
            <span style={{
              fontSize: 9,
              padding: "1px 4px",
              borderRadius: 3,
              background: "rgba(99,102,241,0.12)",
              color: "rgba(99,102,241,0.7)",
              fontWeight: 500,
            }}>
              SKILL
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {cmd.description}
        </span>
      </div>
    </div>
  );

  let globalIdx = 0;

  return (
    <div
      ref={popupRef}
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: 8,
        minWidth: 280,
        maxWidth: 360,
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
        overflow: "hidden",
        zIndex: 1000,
        maxHeight: 360,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          padding: "6px 10px",
          fontSize: 11,
          color: "var(--text-dim)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        斜杠命令
      </div>

      {/* Builtin commands */}
      {builtins.map((cmd) => {
        const idx = globalIdx++;
        return renderItem(cmd, idx);
      })}

      {/* Skills section */}
      {skillItems.length > 0 && (
        <>
          <div
            style={{
              padding: "6px 10px",
              fontSize: 10,
              fontWeight: 600,
              color: "var(--text-dim)",
              borderBottom: "1px solid var(--border)",
              borderTop: builtins.length > 0 ? "1px solid var(--border)" : "none",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Skills
          </div>
          {skillItems.map((cmd) => {
            const idx = globalIdx++;
            return renderItem(cmd, idx);
          })}
        </>
      )}
    </div>
  );
}
