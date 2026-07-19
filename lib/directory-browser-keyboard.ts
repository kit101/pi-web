export type DirectoryBrowserKeyAction =
  | { type: "move"; delta: -1 | 1 }
  | { type: "parent" }
  | { type: "close" }
  | { type: "focus-path" }
  | { type: "activate" };

export function getDirectoryBrowserKeyAction(input: {
  key: string;
  modifier: boolean;
}): DirectoryBrowserKeyAction | null {
  if (!input.modifier) {
    if (input.key === "ArrowDown") return { type: "move", delta: 1 };
    if (input.key === "ArrowUp") return { type: "move", delta: -1 };
    if (input.key === "Backspace") return { type: "parent" };
    if (input.key === "Escape") return { type: "close" };
    if (input.key === "Enter") return { type: "activate" };
  }
  if (input.modifier && input.key === "k") {
    return { type: "focus-path" };
  }
  return null;
}
