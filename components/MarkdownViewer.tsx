"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useTheme } from "@/hooks/useTheme";
import MermaidBlock from "./MermaidBlock";
import { normalizeBlockMathDelimiters } from "@/lib/normalize-math";

interface Props {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

export function MarkdownViewer({ content, className, style }: Props) {
  const { isDark } = useTheme();

  return (
    <div
      className={`markdown-body ${className ?? ""}`}
      style={style}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre({ children }) {
            return <pre style={{ background: "var(--bg-selected)", padding: 12, borderRadius: 6, overflow: "auto" }}>{children}</pre>;
          },
          code({ className, children }) {
            const lang = className?.replace("language-", "") ?? "";
            const raw = String(children);
            if (lang === "mermaid") {
              return <MermaidBlock code={raw.replace(/\n$/, "")} isDark={isDark} />;
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
