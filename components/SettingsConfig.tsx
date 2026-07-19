"use client";

import { useState } from "react";
import { useEditor } from "@/hooks/useEditor";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSendShortcut, type SendShortcut } from "@/hooks/useSendShortcut";
import { useTheme } from "@/hooks/useTheme";
import {
  KNOWN_EDITORS,
  isAbsoluteEditorExecutable,
  type EditorId,
} from "@/lib/editor-config";
import {
  SETTINGS_CATEGORIES,
  getSettingsEmptyState,
  type SettingsCategory,
} from "@/lib/settings";
import { ModelsConfig } from "./ModelsConfig";
import { PluginsConfig } from "./PluginsConfig";
import { SkillsConfig } from "./SkillsConfig";

interface SettingsConfigProps {
  cwd: string | null;
  sessionId: string | null;
  onClose: () => void;
  onPluginReloaded: () => void;
}

const controlStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg-panel)",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        color: "var(--text-dim)",
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}

function EditorSettings() {
  const { editorId, editorPath, setEditor, setEditorPath } = useEditor();
  const knownEditor = KNOWN_EDITORS.find((editor) => editor.id === editorId);
  const customPathValid = isAbsoluteEditorExecutable(editorPath);
  const executable = knownEditor?.command ?? editorPath;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>External editor</h2>
        <p style={{ margin: "6px 0 0", color: "var(--text-muted)", lineHeight: 1.5 }}>
          Choose the application used by file actions in the workspace browser.
        </p>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 7, color: "var(--text-muted)", fontSize: 12 }}>
        Editor
        <select
          value={editorId}
          onChange={(event) => setEditor(event.target.value as EditorId)}
          style={controlStyle}
        >
          {KNOWN_EDITORS.map((editor) => (
            <option key={editor.id} value={editor.id}>{editor.label}</option>
          ))}
          <option value="custom">Custom executable</option>
        </select>
      </label>

      {editorId === "custom" && (
        <label style={{ display: "flex", flexDirection: "column", gap: 7, color: "var(--text-muted)", fontSize: 12 }}>
          Absolute executable path
          <input
            value={editorPath}
            onChange={(event) => setEditorPath(event.target.value)}
            placeholder="/Applications/Editor.app/Contents/MacOS/editor"
            spellCheck={false}
            style={{ ...controlStyle, fontFamily: "var(--font-mono)" }}
          />
          <span style={{ color: customPathValid ? "var(--text-dim)" : "#ef4444", lineHeight: 1.5 }}>
            {customPathValid
              ? "The selected file is passed as a separate argument."
              : "Custom editors require an absolute executable path; shell commands and arguments are not accepted."}
          </span>
        </label>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Current executable</span>
        <code
          style={{
            padding: "9px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg-panel)",
            color: executable ? "var(--text)" : "var(--text-dim)",
            fontFamily: "var(--font-mono)",
            overflowWrap: "anywhere",
          }}
        >
          {executable || "Not configured"}
        </code>
      </div>
    </section>
  );
}

function GeneralSettings() {
  const { isDark, toggleTheme } = useTheme();
  const { sendShortcut, setSendShortcut } = useSendShortcut();
  const shortcuts: { value: SendShortcut; label: string; description: string }[] = [
    { value: "mod-enter-send", label: "⌘/Ctrl + Enter", description: "Enter inserts a new line." },
    { value: "enter-send", label: "Enter", description: "Shift + Enter inserts a new line." },
  ];

  return (
    <div style={{ maxWidth: 620, padding: 24, display: "flex", flexDirection: "column", gap: 28 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>Appearance</h2>
        <button
          type="button"
          onClick={(event) => toggleTheme({ x: event.clientX, y: event.clientY })}
          style={{
            width: "fit-content",
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg-panel)",
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          Switch to {isDark ? "light" : "dark"} theme
        </button>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>Send shortcut</h2>
        {shortcuts.map((shortcut) => (
          <label
            key={shortcut.value}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 9,
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 7,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="send-shortcut"
              value={shortcut.value}
              checked={sendShortcut === shortcut.value}
              onChange={() => setSendShortcut(shortcut.value)}
              style={{ marginTop: 2, accentColor: "var(--accent)" }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{shortcut.label}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{shortcut.description}</span>
            </span>
          </label>
        ))}
      </section>

      <EditorSettings />
    </div>
  );
}

export function SettingsConfig({
  cwd,
  sessionId,
  onClose,
  onPluginReloaded,
}: SettingsConfigProps) {
  const isMobile = useIsMobile();
  const [category, setCategory] = useState<SettingsCategory>("general");
  const emptyState = getSettingsEmptyState(category, cwd);

  const content = (() => {
    if (emptyState) return <EmptyState message={emptyState} />;
    switch (category) {
      case "models":
        return <ModelsConfig embedded onClose={() => {}} />;
      case "skills":
        return <SkillsConfig embedded cwd={cwd!} onClose={() => {}} />;
      case "plugins":
        return (
          <PluginsConfig
            embedded
            cwd={cwd!}
            sessionId={sessionId}
            onClose={() => {}}
            onReloaded={onPluginReloaded}
          />
        );
      case "general":
        return <GeneralSettings />;
    }
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: isMobile ? "calc(100vw - 16px)" : 960,
          maxWidth: "calc(100vw - 16px)",
          height: isMobile ? "calc(100dvh - 16px)" : "82vh",
          maxHeight: "calc(100dvh - 16px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--bg)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Settings</span>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 6px" }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: isMobile ? "column" : "row" }}>
          <nav
            aria-label="Settings categories"
            style={{
              width: isMobile ? "100%" : 180,
              flexShrink: 0,
              display: "flex",
              flexDirection: isMobile ? "row" : "column",
              gap: 4,
              padding: 8,
              overflowX: isMobile ? "auto" : undefined,
              borderRight: isMobile ? "none" : "1px solid var(--border)",
              borderBottom: isMobile ? "1px solid var(--border)" : "none",
              background: "var(--bg-panel)",
            }}
          >
            {SETTINGS_CATEGORIES.map((item) => {
              const active = item.key === category;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCategory(item.key)}
                  style={{
                    flexShrink: 0,
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: 6,
                    background: active ? "var(--bg-selected)" : "transparent",
                    color: active ? "var(--text)" : "var(--text-muted)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <main style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto" }}>
            {content}
          </main>
        </div>
      </div>
    </div>
  );
}
