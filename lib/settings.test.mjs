import assert from "node:assert/strict";
import test from "node:test";
import {
  SETTINGS_CATEGORIES,
  getSettingsEmptyState,
} from "./settings.ts";

test("all five settings categories are available", () => {
  assert.deepEqual(SETTINGS_CATEGORIES.map((item) => item.key), [
    "models",
    "skills",
    "plugins",
    "editor",
    "general",
  ]);
});

test("only workspace-scoped categories show an empty state without cwd", () => {
  assert.equal(getSettingsEmptyState("models", null), null);
  assert.match(getSettingsEmptyState("skills", null) ?? "", /workspace/i);
  assert.match(getSettingsEmptyState("plugins", null) ?? "", /workspace/i);
  assert.equal(getSettingsEmptyState("editor", null), null);
  assert.equal(getSettingsEmptyState("general", null), null);
});
