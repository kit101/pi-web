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
  const lastRenderedCodeRef = useRef<string>("");
  const lastRenderedDarkRef = useRef(isDark);

  useEffect(() => {
    let cancelled = false;

    const trimmed = code.trim();
    if (!trimmed) {
      setSvg("");
      setError("空图表代码");
      lastRenderedCodeRef.current = "";
      return;
    }

    // Already rendered this code — keep the SVG, don't re-render.
    // This is critical during streaming: the parent may remount MermaidBlock
    // instances for historical messages on every tick. Without this guard,
    // the debounce resets endlessly and previously rendered diagrams never
    // become visible.
    if (trimmed === lastRenderedCodeRef.current && isDark === lastRenderedDarkRef.current) {
      return;
    }

    setSvg("");
    setError("");

    // Debounce: wait for streaming code to stabilize before rendering
    const timer = setTimeout(() => {
      if (cancelled) return;

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

      (async () => {
        try {
          const { svg: renderedSvg } = await mermaid.render(id, trimmed);
          if (!cancelled) {
            setSvg(renderedSvg);
            lastRenderedCodeRef.current = trimmed;
            lastRenderedDarkRef.current = isDark;
          }
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
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
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

  // SVG not yet rendered — show raw code so the user always sees something useful,
  // even during scroll-driven remounts while the debounce timer is pending.
  if (!svg) {
    return (
      <div
        ref={containerRef}
        style={{
          padding: 12,
          background: "var(--bg-selected)",
          borderRadius: 6,
          overflow: "auto",
          border: "1px solid var(--border)",
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "0.8em",
            color: "var(--text-dim)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {code}
        </pre>
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
