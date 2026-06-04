"use client";

import { useState } from "react";
import { ModelsConfig } from "./ModelsConfig";
import { SkillsConfig } from "./SkillsConfig";
import { useTheme } from "@/hooks/useTheme";
import { useSendShortcut } from "@/hooks/useSendShortcut";
import { useEditor } from "@/hooks/useEditor";

type SettingsCategory = "models" | "editor" | "general" | "skill";

interface CategoryDef {
  key: SettingsCategory;
  label: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryDef[] = [
  {
    key: "models",
    label: "模型",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
        <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
      </svg>
    ),
  },
  {
    key: "skill",
    label: "Skill",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    key: "editor",
    label: "编辑器",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    key: "general",
    label: "其他",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const KNOWN_EDITORS = [
  { id: "vscode", label: "VS Code", executable: "code" },
  { id: "cursor", label: "Cursor", executable: "cursor" },
  { id: "sublime", label: "Sublime Text", executable: "subl" },
  { id: "vim", label: "Vim", executable: "vim" },
  { id: "neovim", label: "Neovim", executable: "nvim" },
  { id: "webstorm", label: "WebStorm", executable: "webstorm" },
  { id: "zed", label: "Zed", executable: "zed" },
  { id: "nova", label: "Nova", executable: "nova" },
  { id: "custom", label: "自定义...", executable: "" },
];

function EditorSettings() {
  const { editorId, editorPath, setEditor, setEditorPath } = useEditor();

  const current = editorId === "custom"
    ? (editorPath || "(未设置)")
    : (KNOWN_EDITORS.find(e => e.id === editorId)?.executable ?? "");

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>编辑器</div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          选择用于打开文件的外部编辑器。
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>编辑器</label>
          <select
            value={editorId}
            onChange={(e) => setEditor(e.target.value)}
            style={{
              padding: "7px 10px", fontSize: 13,
              background: "var(--bg-panel)", border: "1px solid var(--border)",
              borderRadius: 6, color: "var(--text)", outline: "none",
            }}
          >
            {KNOWN_EDITORS.map(e => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </div>

        {editorId === "custom" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>自定义编辑器路径</label>
            <input
              value={editorPath}
              onChange={(e) => setEditorPath(e.target.value)}
              placeholder="/path/to/editor"
              style={{
                padding: "7px 10px", fontSize: 13,
                background: "var(--bg-panel)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--text)", outline: "none",
                fontFamily: "var(--font-mono)",
              }}
            />
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>编辑器可执行文件的完整路径</span>
          </div>
        )}

        <div style={{
          marginTop: 12, padding: "10px 14px",
          background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 6,
          fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6,
        }}>
          当前: <code style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{current}</code>
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const { isDark, toggleTheme } = useTheme();
  const { sendShortcut, setSendShortcut } = useSendShortcut();

  const userAgentData = typeof navigator !== "undefined"
    ? (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
    : undefined;
  const isMac = typeof navigator !== "undefined" &&
    (userAgentData?.platform === "macOS" || /Mac/i.test(navigator.userAgent));
  const modKey = isMac ? "Cmd" : "Ctrl";

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* ── Theme ── */}
        <section>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>主题</div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px",
            background: "var(--bg-panel)", border: "1px solid var(--border)",
            borderRadius: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {isDark ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  {isDark ? "深色模式" : "浅色模式"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {isDark ? "当前使用深色主题" : "当前使用浅色主题"}
                </div>
              </div>
            </div>
            <button
              onClick={() => toggleTheme()}
              style={{
                padding: "6px 14px", background: "none",
                border: "1px solid var(--border)", borderRadius: 6,
                color: "var(--text-muted)", cursor: "pointer", fontSize: 12,
              }}
            >
              {isDark ? "切换浅色" : "切换深色"}
            </button>
          </div>
        </section>

        {/* ── Send shortcut ── */}
        <section>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>发送快捷键</div>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            选择发送消息和换行的快捷键组合。
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px",
              background: sendShortcut === "mod-enter-send" ? "var(--bg-selected)" : "var(--bg-panel)",
              border: `1px solid ${sendShortcut === "mod-enter-send" ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8, cursor: "pointer",
            }}>
              <input
                type="radio"
                name="send-shortcut"
                value="mod-enter-send"
                checked={sendShortcut === "mod-enter-send"}
                onChange={() => setSendShortcut("mod-enter-send")}
                style={{ accentColor: "var(--accent)" }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  {modKey}+Enter 发送，Enter 换行
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  按 {modKey}+Enter 发送消息，按 Enter 插入换行
                </div>
              </div>
            </label>

            <label style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px",
              background: sendShortcut === "enter-send" ? "var(--bg-selected)" : "var(--bg-panel)",
              border: `1px solid ${sendShortcut === "enter-send" ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8, cursor: "pointer",
            }}>
              <input
                type="radio"
                name="send-shortcut"
                value="enter-send"
                checked={sendShortcut === "enter-send"}
                onChange={() => setSendShortcut("enter-send")}
                style={{ accentColor: "var(--accent)" }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  Enter 发送，{modKey}+Enter 换行
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  按 Enter 发送消息，按 {modKey}+Enter 插入换行
                </div>
              </div>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}

export function SettingsConfig({
  onClose,
  cwd,
}: {
  onClose: () => void;
  cwd: string | null;
}) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("models");

  const activeCwd = cwd || "";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 900, height: "78vh", background: "var(--bg)",
        border: "1px solid var(--border)", borderRadius: 10,
        display: "flex", flexDirection: "column",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 18px", borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>系统设置</span>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--text-muted)",
            cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 6px",
          }}>×</button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left navigation */}
          <div style={{
            width: 180, borderRight: "1px solid var(--border)",
            display: "flex", flexDirection: "column", flexShrink: 0,
            background: "var(--bg-panel)", padding: "8px 6px",
          }}>
            {CATEGORIES.map(({ key, label, icon }) => {
              const isActive = activeCategory === key;
              return (
                <div
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                    background: isActive ? "var(--bg-selected)" : "none",
                    color: isActive ? "var(--text)" : "var(--text-muted)",
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    transition: "background 0.12s, color 0.12s",
                    marginBottom: 2,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text)"; }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-muted)"; }
                  }}
                >
                  {icon}
                  {label}
                </div>
              );
            })}
          </div>

          {/* Right content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {activeCategory === "editor" ? (
              <div style={{ flex: 1, overflowY: "auto" }}><EditorSettings /></div>
            ) : activeCategory === "general" ? (
              <div style={{ flex: 1, overflowY: "auto" }}><GeneralSettings /></div>
            ) : activeCategory === "models" && activeCwd ? (
              <ModelsConfig onClose={() => {}} embedded />
            ) : activeCategory === "models" ? (
              <div style={{ padding: 24, fontSize: 12, color: "var(--text-muted)" }}>请先在侧边栏选择一个项目目录</div>
            ) : activeCategory === "skill" && activeCwd ? (
              <SkillsConfig cwd={activeCwd} onClose={() => {}} embedded />
            ) : activeCategory === "skill" ? (
              <div style={{ padding: 24, fontSize: 12, color: "var(--text-muted)" }}>请先在侧边栏选择一个项目目录</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
