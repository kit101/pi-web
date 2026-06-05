/**
 * normalizeBlockMathDelimiters: Pre-processes markdown source to ensure $$ delimiters
 * are on their own lines, as required by remark-math for block-level math parsing.
 *
 * Handles cases like:
 *   $$f(x) = ... \end{cases}$$   →   $$\nf(x) = ... \end{cases}\n$$
 *   $$f(x) = ...                 →   $$\nf(x) = ...
 *   ...\end{cases}$$             →   ...\end{cases}\n$$
 */
export function normalizeBlockMathDelimiters(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Case 1: Line is exactly "$$" — already correct
    if (trimmed === "$$") {
      result.push(line);
      continue;
    }

    // Case 2: Line starts with $$ and ends with $$ (single-line block math)
    // e.g., "$$f(x) = ... \end{cases}$$"
    if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
      const content = trimmed.slice(2, -2).trim();
      if (content.length > 0) {
        result.push("$$");
        result.push(content);
        result.push("$$");
        continue;
      }
    }

    // Case 3: Line starts with $$ but doesn't end with $$
    // e.g., "$$f(x) = \begin{cases}"
    if (trimmed.startsWith("$$") && !trimmed.endsWith("$$")) {
      const content = trimmed.slice(2).trim();
      if (content.length > 0) {
        result.push("$$");
        result.push(content);
        continue;
      }
    }

    // Case 4: Line ends with $$ but doesn't start with $$
    // e.g., "\end{cases}$$"
    if (!trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 2) {
      const content = trimmed.slice(0, -2).trim();
      if (content.length > 0) {
        result.push(content);
        result.push("$$");
        continue;
      }
    }

    // Case 5: Normal line, no change
    result.push(line);
  }

  return result.join("\n");
}
