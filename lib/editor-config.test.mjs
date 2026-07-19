import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEditorActionBody,
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

test("editor action bodies preserve paths without building shell commands", () => {
  assert.deepEqual(
    buildEditorActionBody("/work/a b.ts", {
      id: "custom",
      executablePath: "/Applications/Editor Bin",
    }),
    {
      action: "edit",
      filePath: "/work/a b.ts",
      editorId: "custom",
      customExecutable: "/Applications/Editor Bin",
    },
  );
});
