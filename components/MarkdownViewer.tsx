"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useTheme } from "@/hooks/useTheme";
import MermaidBlock from "./MermaidBlock";
import { normalizeBlockMathDelimiters } from "@/lib/normalize-math";

class MermaidErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || "图表渲染出错" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[MermaidErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 12,
            background: "var(--bg-selected)",
            borderRadius: 6,
            color: "var(--text-dim)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.85em",
            overflow: "auto",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ marginBottom: 4, fontWeight: 600 }}>
            ⚠ Mermaid 渲染错误
          </div>
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {this.state.error}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Props {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export function MarkdownViewer({ content, className, style }: Props) {
  const { isDark } = useTheme();

  return (
    <div className={`markdown-body ${className ?? ""}`} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre({ children }) {
            return (
              <pre
                style={{
                  background: "var(--bg-selected)",
                  padding: 12,
                  borderRadius: 6,
                  overflow: "auto",
                }}
              >
                {children}
              </pre>
            );
          },
          code({ className, children }) {
            const lang = className?.replace("language-", "") ?? "";
            const raw = children != null ? String(children) : "";
            if (lang === "mermaid") {
              return (
                <MermaidErrorBoundary>
                  <MermaidBlock
                    code={raw.replace(/\n$/, "")}
                    isDark={isDark}
                  />
                </MermaidErrorBoundary>
              );
            }
            return <code>{children}</code>;
          },
        }}
      >
        {normalizeBlockMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
