"use client";

import { useEffect, useState } from "react";
import mermaid from "mermaid";

interface Props {
  code: string;
  isDark?: boolean;
}

export default function MermaidBlock({ code, isDark }: Props) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setSvg("");
    setError("");

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
      });
      const id = `mm-${Math.random().toString(36).slice(2, 9)}`;
      mermaid
        .render(id, code)
        .then(({ svg }) => {
          if (!cancelled) setSvg(svg);
        })
        .catch((err) => {
          if (!cancelled) {
            console.error("[MermaidBlock] render error:", err);
            setError("图表渲染失败，请检查语法");
          }
        });
    } catch (err) {
      console.error("[MermaidBlock] init error:", err);
      setError("图表初始化失败");
    }

    return () => {
      cancelled = true;
    };
  }, [code, isDark]);

  if (error) {
    return (
      <pre
        style={{
          padding: 12,
          background: "var(--bg-selected)",
          borderRadius: 6,
          color: "var(--text-error)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.85em",
          overflow: "auto",
        }}
      >
        {error}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div
        style={{
          padding: 24,
          background: "var(--bg-selected)",
          borderRadius: 6,
          color: "var(--text-dim)",
          fontSize: "0.9em",
          textAlign: "center",
        }}
      >
        正在渲染图表…
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", justifyContent: "center" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
