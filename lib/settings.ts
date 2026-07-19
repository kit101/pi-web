export type SettingsCategory =
  | "models"
  | "skills"
  | "plugins"
  | "editor"
  | "general";

export const SETTINGS_CATEGORIES: readonly {
  key: SettingsCategory;
  label: string;
}[] = [
  { key: "models", label: "Models" },
  { key: "skills", label: "Skills" },
  { key: "plugins", label: "Plugins" },
  { key: "editor", label: "Editor" },
  { key: "general", label: "General" },
];

export function getSettingsEmptyState(
  category: SettingsCategory,
  cwd: string | null,
): string | null {
  if (cwd || (category !== "skills" && category !== "plugins")) return null;
  return category === "skills"
    ? "Select a workspace to manage skills."
    : "Select a workspace to manage plugins.";
}
