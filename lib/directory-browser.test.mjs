import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  getBrowsableParent,
  listBrowsableDirectories,
  resolveBrowsableDirectory,
} from "./directory-browser.ts";

function createFixture() {
  const base = mkdtempSync(join(tmpdir(), "pi-web-directory-browser-"));
  const homeRoot = join(base, "home");
  const externalRoot = join(base, "external");
  const outsideRoot = join(base, "outside");
  const homeChild = join(homeRoot, "project");
  const nestedExternalRoot = join(externalRoot, "nested-workspace");
  const nestedExternalChild = join(nestedExternalRoot, "src");

  mkdirSync(homeChild, { recursive: true });
  mkdirSync(nestedExternalChild, { recursive: true });
  mkdirSync(join(outsideRoot, "secret"), { recursive: true });
  writeFileSync(join(homeRoot, "notes.txt"), "not a directory");

  const escapingSymlink = join(homeRoot, "escape-link");
  const intermediateSymlink = join(homeRoot, "tunnel");
  const internalSymlink = join(homeRoot, "project-link");
  const danglingEscapeSymlink = join(homeRoot, "dangling-escape");
  symlinkSync(outsideRoot, escapingSymlink, process.platform === "win32" ? "junction" : "dir");
  symlinkSync(outsideRoot, intermediateSymlink, process.platform === "win32" ? "junction" : "dir");
  symlinkSync(homeChild, internalSymlink, process.platform === "win32" ? "junction" : "dir");
  symlinkSync(
    join(outsideRoot, "not-created"),
    danglingEscapeSymlink,
    process.platform === "win32" ? "junction" : "dir",
  );

  return {
    base,
    homeRoot,
    externalRoot,
    outsideRoot,
    homeChild,
    nestedExternalRoot,
    nestedExternalChild,
    escapingSymlink,
    intermediateSymlink,
    internalSymlink,
    danglingEscapeSymlink,
  };
}

test("directory browsing stays inside the selected real root", () => {
  const fixture = createFixture();
  try {
    const location = resolveBrowsableDirectory(
      fixture.homeChild,
      [fixture.homeRoot, fixture.externalRoot],
    );
    assert.deepEqual(location, {
      directory: realpathSync(fixture.homeChild),
      root: realpathSync(fixture.homeRoot),
    });

    assert.throws(
      () => resolveBrowsableDirectory(
        fixture.escapingSymlink,
        [fixture.homeRoot, fixture.externalRoot],
      ),
      /Access denied/,
    );
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("directory browsing rejects traversal and intermediate symlink escapes", () => {
  const fixture = createFixture();
  try {
    assert.throws(
      () => resolveBrowsableDirectory(fixture.outsideRoot, [fixture.homeRoot]),
      /Access denied/,
    );
    assert.throws(
      () => resolveBrowsableDirectory(
        join(fixture.intermediateSymlink, "secret"),
        [fixture.homeRoot],
      ),
      /Access denied/,
    );
    assert.throws(
      () => resolveBrowsableDirectory(
        join(fixture.danglingEscapeSymlink, "target"),
        [fixture.homeRoot],
      ),
      /Access denied/,
    );
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("overlapping roots select the longest containing real root", () => {
  const fixture = createFixture();
  try {
    const location = resolveBrowsableDirectory(
      fixture.nestedExternalChild,
      [fixture.externalRoot, fixture.nestedExternalRoot],
    );
    assert.equal(location.root, realpathSync(fixture.nestedExternalRoot));
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("directory browsing rejects missing paths, files, and direct symlinks", () => {
  const fixture = createFixture();
  try {
    assert.throws(
      () => resolveBrowsableDirectory(join(fixture.homeRoot, "missing"), [fixture.homeRoot]),
      /not found/i,
    );
    assert.throws(
      () => resolveBrowsableDirectory(join(fixture.homeRoot, "notes.txt"), [fixture.homeRoot]),
      /not a directory/i,
    );
    assert.throws(
      () => resolveBrowsableDirectory(
        join(fixture.homeRoot, "notes.txt", "child"),
        [fixture.homeRoot],
      ),
      (error) => error?.message === "Path is not a directory" && error?.status === 400,
    );
    assert.throws(
      () => resolveBrowsableDirectory(fixture.internalSymlink, [fixture.homeRoot]),
      /symbolic link/i,
    );
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("outside existing and missing paths share the same access-denied response", () => {
  const fixture = createFixture();
  try {
    for (const candidate of [fixture.outsideRoot, join(fixture.outsideRoot, "missing")]) {
      assert.throws(
        () => resolveBrowsableDirectory(candidate, [fixture.homeRoot]),
        (error) => error?.message === "Access denied" && error?.status === 403,
      );
    }

    assert.throws(
      () => resolveBrowsableDirectory(join(fixture.homeRoot, "missing"), [fixture.homeRoot]),
      (error) => error?.message === "Directory not found" && error?.status === 404,
    );
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("directory listings exclude files, symbolic links, and ignored build directories", () => {
  const fixture = createFixture();
  try {
    mkdirSync(join(fixture.homeRoot, "alpha"));
    mkdirSync(join(fixture.homeRoot, "node_modules"));
    mkdirSync(join(fixture.homeRoot, "coverage"));

    assert.deepEqual(
      listBrowsableDirectories(realpathSync(fixture.homeRoot)).map((entry) => entry.name),
      ["alpha", "project"],
    );
    assert.deepEqual(
      listBrowsableDirectories(realpathSync(fixture.homeRoot)).map((entry) => entry.path),
      [join(realpathSync(fixture.homeRoot), "alpha"), realpathSync(fixture.homeChild)],
    );
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("parent navigation is clamped at the authorized root", () => {
  const fixture = createFixture();
  try {
    const realHomeRoot = realpathSync(fixture.homeRoot);
    const realHomeChild = realpathSync(fixture.homeChild);
    assert.equal(getBrowsableParent(realHomeRoot, realHomeRoot), null);
    assert.equal(getBrowsableParent(realHomeChild, realHomeRoot), realHomeRoot);
    assert.equal(getBrowsableParent(fixture.outsideRoot, realHomeRoot), null);
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});
