import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ensureDefaultWorkspaceDirectory,
  getDefaultWorkspacePath,
  getDefaultWorkspaceRoot,
  isDefaultWorkspaceDirectoryName,
  listDefaultWorkspaceDirectories,
} from "./default-workspace.ts";

test("默认工作区位于 ~/.pi/default-workspace", () => {
  assert.equal(
    getDefaultWorkspaceRoot("/home/test"),
    "/home/test/.pi/default-workspace",
  );
});

test("默认工作区使用 UTC 日期目录", () => {
  assert.equal(
    getDefaultWorkspacePath("/home/test", new Date("2026-07-19T23:59:59Z")),
    "/home/test/.pi/default-workspace/20260719",
  );
});

test("仅识别八位数字日期目录", () => {
  assert.equal(isDefaultWorkspaceDirectoryName("20260719"), true);
  assert.equal(isDefaultWorkspaceDirectoryName("pi-cwd-20260719"), false);
  assert.equal(isDefaultWorkspaceDirectoryName("2026-07-19"), false);
  assert.equal(isDefaultWorkspaceDirectoryName("2026071a"), false);
});

test("持久扫描排除普通文件和符号链接", () => {
  const home = mkdtempSync(join(tmpdir(), "pi-web-default-workspace-"));
  try {
    const root = getDefaultWorkspaceRoot(home);
    mkdirSync(join(root, "20260719"), { recursive: true });
    writeFileSync(join(root, "20260720"), "not a directory");
    symlinkSync(home, join(root, "20260721"), process.platform === "win32" ? "junction" : "dir");

    assert.deepEqual(listDefaultWorkspaceDirectories(home), [
      join(root, "20260719"),
    ]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("创建默认工作区时拒绝日期名符号链接", () => {
  const home = mkdtempSync(join(tmpdir(), "pi-web-default-workspace-"));
  try {
    const dir = getDefaultWorkspacePath(home, new Date("2026-07-19T00:00:00Z"));
    mkdirSync(getDefaultWorkspaceRoot(home), { recursive: true });
    symlinkSync(home, dir, process.platform === "win32" ? "junction" : "dir");

    assert.throws(
      () => ensureDefaultWorkspaceDirectory(home, new Date("2026-07-19T00:00:00Z")),
      /real directory/,
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
