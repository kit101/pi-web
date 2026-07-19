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
  buildDirectoryBrowserRoots,
  DirectoryBrowserError,
  getBrowsableParent,
  listBrowsableDirectories,
  resolveBrowsableDirectory,
} from "./directory-browser.ts";
import { getDirectoryBrowserKeyAction } from "./directory-browser-keyboard.ts";

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
  const selfLoop = join(homeRoot, "self-loop");
  const twoNodeLoopA = join(homeRoot, "loop-a");
  const twoNodeLoopB = join(homeRoot, "loop-b");
  const directoryLinkType = process.platform === "win32" ? "junction" : "dir";
  symlinkSync(outsideRoot, escapingSymlink, directoryLinkType);
  symlinkSync(outsideRoot, intermediateSymlink, directoryLinkType);
  symlinkSync(homeChild, internalSymlink, directoryLinkType);
  symlinkSync(
    join(outsideRoot, "not-created"),
    danglingEscapeSymlink,
    directoryLinkType,
  );
  symlinkSync(selfLoop, selfLoop, directoryLinkType);
  symlinkSync(twoNodeLoopB, twoNodeLoopA, directoryLinkType);
  symlinkSync(twoNodeLoopA, twoNodeLoopB, directoryLinkType);

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
    selfLoop,
    twoNodeLoopA,
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

test("home remains the browser root for workspaces nested inside it", () => {
  const fixture = createFixture();
  try {
    const roots = buildDirectoryBrowserRoots(
      fixture.homeRoot,
      [fixture.homeChild, fixture.externalRoot],
    );
    assert.deepEqual(roots, [fixture.homeRoot, fixture.externalRoot]);

    const location = resolveBrowsableDirectory(fixture.homeChild, roots);
    assert.equal(location.root, realpathSync(fixture.homeRoot));
    assert.equal(
      getBrowsableParent(location.directory, location.root),
      realpathSync(fixture.homeRoot),
    );
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

test("direct and intermediate symbolic-link loops are invalid directory requests", () => {
  const fixture = createFixture();
  try {
    for (const candidate of [
      fixture.selfLoop,
      fixture.twoNodeLoopA,
      join(fixture.twoNodeLoopA, "child"),
    ]) {
      assert.throws(
        () => resolveBrowsableDirectory(candidate, [fixture.homeRoot]),
        (error) => (
          error instanceof DirectoryBrowserError
          && error.status === 400
          && /symbolic link loop/i.test(error.message)
        ),
      );
    }
  } finally {
    rmSync(fixture.base, { recursive: true, force: true });
  }
});

test("paths containing NUL are rejected before filesystem access", () => {
  const fixture = createFixture();
  try {
    assert.throws(
      () => resolveBrowsableDirectory(`${fixture.homeRoot}/\0child`, [fixture.homeRoot]),
      (error) => (
        error instanceof DirectoryBrowserError
        && error.status === 400
        && /invalid character/i.test(error.message)
      ),
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

test("directory browser keyboard actions map navigation keys", () => {
  assert.deepEqual(
    getDirectoryBrowserKeyAction({ key: "ArrowDown", modifier: false }),
    { type: "move", delta: 1 },
  );
  assert.deepEqual(
    getDirectoryBrowserKeyAction({ key: "ArrowUp", modifier: false }),
    { type: "move", delta: -1 },
  );
  assert.deepEqual(
    getDirectoryBrowserKeyAction({ key: "Backspace", modifier: false }),
    { type: "parent" },
  );
  assert.deepEqual(
    getDirectoryBrowserKeyAction({ key: "Escape", modifier: false }),
    { type: "close" },
  );
  assert.deepEqual(
    getDirectoryBrowserKeyAction({ key: "k", modifier: true }),
    { type: "focus-path" },
  );
  assert.deepEqual(
    getDirectoryBrowserKeyAction({ key: "Enter", modifier: false }),
    { type: "activate" },
  );
  assert.equal(
    getDirectoryBrowserKeyAction({ key: "K", modifier: true }),
    null,
  );
});
