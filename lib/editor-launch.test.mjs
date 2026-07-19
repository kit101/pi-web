import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import {
  buildEditorCommand,
  parseEditorActionRequest,
  resolveAllowedEditorFile,
  validateCustomExecutable,
} from "./editor-launch.ts";

const fixtureRoot = mkdtempSync(path.join(tmpdir(), "pi-web-editor-launch-"));
const allowedRoot = path.join(fixtureRoot, "allowed");
const outsideRoot = path.join(fixtureRoot, "outside");
mkdirSync(allowedRoot);
mkdirSync(outsideRoot);

const realFile = path.join(allowedRoot, "source file.ts");
const outsideFile = path.join(outsideRoot, "secret.ts");
writeFileSync(realFile, "export {};\n");
writeFileSync(outsideFile, "secret\n");

const executableFixture = path.join(fixtureRoot, "editor-bin");
const nonExecutableFixture = path.join(fixtureRoot, "not-executable");
writeFileSync(executableFixture, "#!/bin/sh\nexit 0\n");
writeFileSync(nonExecutableFixture, "#!/bin/sh\nexit 0\n");
chmodSync(executableFixture, 0o755);
chmodSync(nonExecutableFixture, 0o644);

const escapingDirectoryLink = path.join(allowedRoot, "escape");
symlinkSync(outsideRoot, escapingDirectoryLink, "dir");
const pathThroughEscapingSymlink = path.join(escapingDirectoryLink, "secret.ts");
const directFileLink = path.join(allowedRoot, "linked-source.ts");
symlinkSync(realFile, directFileLink, "file");

after(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

test("known editors build a shell-free command", () => {
  assert.deepEqual(
    buildEditorCommand({ id: "cursor", executablePath: "" }, "/work/a b.ts"),
    { command: "cursor", args: ["/work/a b.ts"] },
  );
});

test("custom editors build a command with the target as a separate argument", () => {
  assert.deepEqual(
    buildEditorCommand(
      { id: "custom", executablePath: "/Applications/Editor Bin" },
      "/work/a b.ts",
    ),
    { command: "/Applications/Editor Bin", args: ["/work/a b.ts"] },
  );
});

test("custom editors require an absolute executable file", () => {
  assert.match(validateCustomExecutable("relative/editor") ?? "", /absolute/);
  assert.equal(validateCustomExecutable(executableFixture), null);
  assert.match(validateCustomExecutable(nonExecutableFixture) ?? "", /executable/);
  assert.match(validateCustomExecutable(allowedRoot) ?? "", /file/);
});

test("editor targets cannot escape an allowed root through symlinks", () => {
  assert.equal(resolveAllowedEditorFile(realFile, new Set([allowedRoot])), realFile);
  assert.throws(
    () => resolveAllowedEditorFile(pathThroughEscapingSymlink, new Set([allowedRoot])),
    /Access denied/,
  );
  assert.throws(
    () => resolveAllowedEditorFile(directFileLink, new Set([allowedRoot])),
    /symbolic link/,
  );
});

test("editor action requests accept only structured known editor selections", () => {
  assert.deepEqual(
    parseEditorActionRequest({
      action: "edit",
      filePath: "/work/a b.ts",
      editorId: "custom",
      customExecutable: "/Applications/Editor Bin",
    }),
    {
      filePath: "/work/a b.ts",
      editorId: "custom",
      customExecutable: "/Applications/Editor Bin",
    },
  );
  assert.deepEqual(
    parseEditorActionRequest({ filePath: "/work/a.ts", editorId: "vscode" }),
    { filePath: "/work/a.ts", editorId: "vscode" },
  );
});

test("malformed editor action requests and unknown editor ids are rejected", () => {
  assert.equal(parseEditorActionRequest(null), null);
  assert.equal(parseEditorActionRequest([]), null);
  assert.equal(parseEditorActionRequest({}), null);
  assert.equal(parseEditorActionRequest({ filePath: 1, editorId: "cursor" }), null);
  assert.equal(parseEditorActionRequest({ filePath: "/work/a.ts", editorId: "unknown" }), null);
  assert.equal(
    parseEditorActionRequest({
      filePath: "/work/a.ts",
      editorId: "custom",
      customExecutable: 42,
    }),
    null,
  );
});
