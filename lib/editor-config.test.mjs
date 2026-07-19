import assert from "node:assert/strict";
import test from "node:test";
import {
  isEditorSelectionReady,
  isAbsoluteEditorExecutable,
  normalizeEditorPath,
  parseEditorId,
} from "./editor-config.ts";

test("invalid stored editor ids fall back to vscode", () => {
  assert.equal(parseEditorId("cursor"), "cursor");
  assert.equal(parseEditorId("unknown-editor"), "vscode");
  assert.equal(parseEditorId(null), "vscode");
});

test("custom editor paths are trimmed and required", () => {
  assert.equal(normalizeEditorPath("  /Applications/editor  "), "/Applications/editor");
  assert.equal(isAbsoluteEditorExecutable("relative/editor"), false);
  assert.equal(isAbsoluteEditorExecutable("/opt/editor"), true);
  assert.equal(isAbsoluteEditorExecutable("C:\\Tools\\editor.exe"), true);
  assert.equal(isEditorSelectionReady({ id: "custom", executablePath: "" }), false);
  assert.equal(isEditorSelectionReady({ id: "custom", executablePath: "relative/editor" }), false);
  assert.equal(isEditorSelectionReady({ id: "custom", executablePath: "/opt/editor" }), true);
  assert.equal(isEditorSelectionReady({ id: "vscode", executablePath: "" }), true);
});
