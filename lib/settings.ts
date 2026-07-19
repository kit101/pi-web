export type SettingsCategory =
  | "general"
  | "models"
  | "skills"
  | "plugins";

export const SETTINGS_CATEGORIES: readonly {
  key: SettingsCategory;
  label: string;
}[] = [
  { key: "general", label: "General" },
  { key: "models", label: "Model" },
  { key: "skills", label: "Skills" },
  { key: "plugins", label: "Plugins" },
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
