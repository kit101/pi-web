import assert from "node:assert/strict";
import test from "node:test";
import {
  SETTINGS_CATEGORIES,
  getSettingsEmptyState,
} from "./settings.ts";

test("settings categories use the requested order", () => {
  assert.deepEqual(SETTINGS_CATEGORIES.map((item) => item.key), [
    "general",
    "models",
    "skills",
    "plugins",
  ]);
  assert.deepEqual(SETTINGS_CATEGORIES.map((item) => item.label), [
    "General",
    "Model",
    "Skills",
    "Plugins",
  ]);
});

test("only workspace-scoped categories show an empty state without cwd", () => {
  assert.equal(getSettingsEmptyState("models", null), null);
  assert.match(getSettingsEmptyState("skills", null) ?? "", /workspace/i);
  assert.match(getSettingsEmptyState("plugins", null) ?? "", /workspace/i);
  assert.equal(getSettingsEmptyState("general", null), null);
});
