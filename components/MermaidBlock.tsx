"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

interface Props {
  code: string;
  isDark?: boolean;
}

export default function MermaidBlock({ code, isDark }: Props) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg("");
    setError("");

    const trimmed = code.trim();
    if (!trimmed) {
      setError("空图表代码");
      return;
    }

    let initDone = false;
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        securityLevel: "loose",
        suppressErrorRendering: true,
      });
      initDone = true;
    } catch (err) {
      console.error("[MermaidBlock] init error:", err);
      setError("图表初始化失败");
      return;
    }

    if (!initDone) return;

    const id = `mm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Use a separate async IIFE to ensure all errors are caught
    (async () => {
      try {
        const { svg: renderedSvg } = await mermaid.render(id, trimmed);
        if (!cancelled) setSvg(renderedSvg);
      } catch (err) {
        if (!cancelled) {
          console.error("[MermaidBlock] render error:", err);
          const msg =
            err instanceof Error
              ? err.message
              : typeof err === "object" && err !== null && "str" in err
                ? String((err as { str: unknown }).str)
                : String(err);
          setError(`图表渲染失败: ${msg}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, isDark]);

  if (error) {
    return (
      <div
        ref={containerRef}
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
        <div style={{ marginBottom: 4, fontWeight: 600 }}>⚠ Mermaid 渲染错误</div>
        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{error}</div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        ref={containerRef}
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
      ref={containerRef}
      style={{ display: "flex", justifyContent: "center" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
