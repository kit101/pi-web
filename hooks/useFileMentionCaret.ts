"use client";

import { useRef, useCallback, useEffect } from "react";

interface CaretPosition {
  left: number;
  top: number;
}

interface Options {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Calculates the on-screen pixel position of the text cursor
 * in a <textarea> using a hidden canvas approximation.
 * Returns { left, top } relative to the viewport.
 */
export function useFileMentionCaret({ textareaRef }: Options) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getContext = useCallback((): CanvasRenderingContext2D | null => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    return canvasRef.current.getContext("2d");
  }, []);

  const getCaretPosition = useCallback((): CaretPosition | null => {
    const ta = textareaRef.current;
    if (!ta) return null;

    const ctx = getContext();
    if (!ctx) return null;

    const style = getComputedStyle(ta);
    ctx.font = style.font;

    const text = ta.value.substring(0, ta.selectionStart);
    const lines = text.split("\n");
    const currentLine = lines.length - 1;
    const currentText = lines[currentLine];

    // Measure line width up to cursor
    const lineWidth = ctx.measureText(currentText).width;

    // Calculate top offset: line height * line count
    const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) || 16) * 1.2;
    const paddingTop = parseFloat(style.paddingTop);
    const paddingLeft = parseFloat(style.paddingLeft);
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;

    // Get textarea position relative to viewport
    const rect = ta.getBoundingClientRect();

    const left = rect.left + paddingLeft + borderLeft + lineWidth;
    const top = rect.top + borderTop + paddingTop + lineHeight * currentLine;

    return { left, top };
  }, [textareaRef, getContext]);

  useEffect(() => {
    return () => {
      if (canvasRef.current) {
        canvasRef.current.remove();
      }
      canvasRef.current = null;
    };
  }, []);

  return { getCaretPosition };
}
