# Unified Settings, Directory Browser, and External Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the three sidebar configuration buttons with one unified Settings modal, restore a secure workspace directory browser, and make file-tree entries open in a configured external editor.

**Architecture:** Keep upstream Models, Skills, and Plugins logic intact and add presentation-only embedded modes for the Settings shell. Put editor and directory security rules in testable library modules, expose dedicated API routes, and keep `SessionSidebar` as integration glue while the directory browser lives in its own component.

**Tech Stack:** Next.js 16.2.9, React 19, TypeScript, Node test runner, ESLint, Node filesystem and child-process APIs.

## Global Constraints

- Preserve every pre-existing untracked file; never use `git add .`.
- Do not run `next build`.
- Do not add the home directory to `getAllowedFileRoots()` or the file-content allow-list.
- Directory browsing may list directory names under home, but file reads remain restricted to explicitly authorized roots.
- Reject directory-browser traversal and symbolic-link escapes with real-path containment checks.
- Custom editors accept only absolute executable file paths; never accept shell command templates or arbitrary argument strings.
- Launch editors with `shell: false` and pass the target file as a separate argument.
- Keep localStorage configuration on `useSyncExternalStore` plus module-level listeners.
- Preserve upstream Models, Skills, Plugins, file upload, file mention, mobile, worktree, and desktop directory-picker behavior.
- Use `apply_patch` for repository edits and exact-path staging for commits.

---

### Task 0: Restore a clean lint baseline

**Files:**
- Modify: `components/ChatInput.tsx`
- Modify: `components/ChatMinimap.tsx`

**Constraints:**
- Fix the nine existing `react-hooks/preserve-manual-memoization` errors without disabling the rule.
- Preserve runtime behavior; this task is limited to callback placement and dependency stability.
- Do not modify ESLint configuration or unrelated files.

- [x] **Step 1: Verify the focused lint failures**

Run:

```bash
node_modules/.bin/eslint components/ChatInput.tsx components/ChatMinimap.tsx
```

Expected: nine `react-hooks/preserve-manual-memoization` errors. In `ChatInput`, inspect the callback referenced before declaration and unstable derived slash-command values. In `ChatMinimap`, inspect callbacks that capture mutable ref objects while reading `.current`.

- [x] **Step 2: Make the smallest behavior-preserving fixes**

Move the imperative-handle registration after the image-processing callback is declared, memoize only derived slash-command state that is used by memoized callbacks, and make minimap callback inputs explicit without changing scroll or measurement behavior.

- [x] **Step 3: Verify focused and full lint are GREEN**

Run:

```bash
node_modules/.bin/eslint components/ChatInput.tsx components/ChatMinimap.tsx
npm run lint
```

Expected: both commands pass with no errors.

- [x] **Step 4: Verify the regression suite**

Run:

```bash
test_files=($(rg --files -g '*.test.mjs'))
node --test "$test_files[@]"
```

Expected: all 92 baseline tests pass.

- [x] **Step 5: Commit**

```bash
git add components/ChatInput.tsx components/ChatMinimap.tsx
git commit -m "fix: restore hooks lint baseline"
```

---

### Task 1: Add validated editor configuration and shared hook

**Files:**
- Create: `lib/editor-config.ts`
- Create: `lib/editor-config.test.mjs`
- Create: `hooks/useEditor.ts`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: `EditorId`, `EditorSelection`, `KNOWN_EDITORS`, `parseEditorId(value)`, `normalizeEditorPath(value)`, `isAbsoluteEditorExecutable(value)`, `isEditorSelectionReady(selection)`, and `useEditor()`.
- Consumers: Settings Editor page, SessionSidebar file action, and server editor launcher.

- [x] **Step 1: Write failing editor configuration tests**

Create `lib/editor-config.test.mjs` with assertions for valid known IDs, invalid-value fallback, path trimming, and custom-editor readiness:

```js
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
```

- [x] **Step 2: Run the test and verify RED**

Run:

```bash
node --test lib/editor-config.test.mjs
```

Expected: FAIL because `lib/editor-config.ts` does not exist.

- [x] **Step 3: Implement the editor domain**

Create `lib/editor-config.ts` with this public shape:

```ts
export const KNOWN_EDITORS = [
  { id: "vscode", label: "VS Code", command: "code" },
  { id: "cursor", label: "Cursor", command: "cursor" },
  { id: "sublime", label: "Sublime Text", command: "subl" },
  { id: "webstorm", label: "WebStorm", command: "webstorm" },
  { id: "zed", label: "Zed", command: "zed" },
  { id: "nova", label: "Nova", command: "nova" },
] as const;

export type KnownEditorId = typeof KNOWN_EDITORS[number]["id"];
export type EditorId = KnownEditorId | "custom";

export interface EditorSelection {
  id: EditorId;
  executablePath: string;
}

const EDITOR_IDS = new Set<string>([
  ...KNOWN_EDITORS.map((editor) => editor.id),
  "custom",
]);

export function parseEditorId(value: string | null): EditorId {
  return value && EDITOR_IDS.has(value) ? value as EditorId : "vscode";
}

export function normalizeEditorPath(value: string | null): string {
  return value?.trim() ?? "";
}

export function isAbsoluteEditorExecutable(value: string): boolean {
  return value.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

export function isEditorSelectionReady(selection: EditorSelection): boolean {
  return selection.id !== "custom" || isAbsoluteEditorExecutable(selection.executablePath);
}
```

- [x] **Step 4: Add the shared localStorage hook**

Create `hooks/useEditor.ts` following `hooks/useSendShortcut.ts`. Use keys `pi-editor` and `pi-editor-path`; both snapshots call `parseEditorId` or `normalizeEditorPath`, and both setters notify one module-level listener set. Return:

```ts
{
  editorId,
  editorPath,
  editorSelection: { id: editorId, executablePath: editorPath },
  setEditor,
  setEditorPath,
}
```

Update the Shared Config Pattern examples in `AGENTS.md` to include `hooks/useEditor.ts`.

- [x] **Step 5: Verify GREEN and commit**

Run:

```bash
node --test lib/editor-config.test.mjs hooks/useSendShortcut.test.mjs
npm run lint
```

Expected: all tests pass and lint exits 0.

Commit only the four task files:

```bash
git add lib/editor-config.ts lib/editor-config.test.mjs hooks/useEditor.ts AGENTS.md
git commit -m "feat: add external editor configuration"
```

---

### Task 2: Add a secure external-editor action API

**Files:**
- Create: `lib/editor-launch.ts`
- Create: `lib/editor-launch.test.mjs`
- Create: `app/api/file-actions/route.ts`

**Interfaces:**
- Consumes: `EditorSelection`, `KNOWN_EDITORS`, `getAllowedFileRoots()`, and `isFilePathAllowed()`.
- Produces: `parseEditorActionRequest(value)`, `buildEditorCommand(selection, filePath)`, `resolveAllowedEditorFile(filePath, roots)`, `validateCustomExecutable(path)`, and POST `/api/file-actions`.

- [x] **Step 1: Write failing command and security tests**

Create `lib/editor-launch.test.mjs`. Use `mkdtempSync`, `mkdirSync`, `writeFileSync`, `chmodSync`, and `symlinkSync` to assert:

```js
test("known editors build a shell-free command", () => {
  assert.deepEqual(
    buildEditorCommand({ id: "cursor", executablePath: "" }, "/work/a b.ts"),
    { command: "cursor", args: ["/work/a b.ts"] },
  );
});

test("custom editors require an absolute executable file", () => {
  assert.match(validateCustomExecutable("relative/editor") ?? "", /absolute/);
  assert.equal(validateCustomExecutable(executableFixture), null);
  assert.match(validateCustomExecutable(nonExecutableFixture) ?? "", /executable/);
});

test("editor targets cannot escape an allowed root through symlinks", () => {
  assert.equal(resolveAllowedEditorFile(realFile, new Set([allowedRoot])), realFile);
  assert.throws(
    () => resolveAllowedEditorFile(pathThroughEscapingSymlink, new Set([allowedRoot])),
    /Access denied/,
  );
});
```

Also test that malformed bodies and unknown editor IDs return `null` from `parseEditorActionRequest`.

- [x] **Step 2: Run the test and verify RED**

Run `node --test lib/editor-launch.test.mjs`.

Expected: FAIL because the launcher module is missing.

- [x] **Step 3: Implement validation and command construction**

In `lib/editor-launch.ts`:

- parse only `{ filePath: string, editorId: EditorId, customExecutable?: string }`;
- map known IDs through `KNOWN_EDITORS`;
- require `path.isAbsolute()` for custom executables;
- use `lstatSync()` to reject symbolic links and non-files;
- use `accessSync(path, constants.X_OK)` to require executability;
- canonicalize target and allowed roots with `realpathSync()` before the final `isFilePathAllowed()` check;
- reject non-files and direct file symlinks;
- return `{ command, args: [filePath] }` without a shell string.

Export a launcher that resolves on the child `spawn` event and rejects on `error`:

```ts
export function launchEditor(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      detached: true,
      stdio: "ignore",
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
    child.once("error", reject);
  });
}
```

- [x] **Step 4: Add the dedicated route**

Create `app/api/file-actions/route.ts`. POST accepts only action `edit`, parses the request with `parseEditorActionRequest`, resolves the target against current allowed roots, validates a custom executable when selected, builds the command, launches it, and returns `{ success: true }`.

Use these statuses:

- 400: malformed body, unsupported action, or invalid editor configuration;
- 403: target outside allowed real roots;
- 404: missing target;
- 500: spawn failure.

Do not modify `app/api/files/[...path]/route.ts`; its POST remains upload-only.

- [x] **Step 5: Verify GREEN and commit**

Run:

```bash
node --test lib/editor-config.test.mjs lib/editor-launch.test.mjs
npm run lint
```

Expected: all tests pass and lint exits 0.

Commit:

```bash
git add lib/editor-launch.ts lib/editor-launch.test.mjs app/api/file-actions/route.ts
git commit -m "feat: add secure editor launch API"
```

---

### Task 3: Connect external-editor actions to the file tree

**Files:**
- Modify: `components/FileExplorer.tsx`
- Modify: `components/SessionSidebar.tsx`
- Modify: `lib/editor-config.test.mjs`
- Modify: `lib/editor-config.ts`

**Interfaces:**
- Consumes: `useEditor()`, POST `/api/file-actions`, and the existing file tree.
- Produces: `buildEditorActionBody(filePath, selection)` and `FileExplorer` props `onEditFile`, `actionError`, and `onDismissActionError`.

- [x] **Step 1: Add a failing request-body test**

Extend `lib/editor-config.test.mjs`:

```js
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
```

Run the test and verify it fails because `buildEditorActionBody` is missing.

- [x] **Step 2: Implement the request builder**

Add `buildEditorActionBody()` to `lib/editor-config.ts`. It returns the exact JSON object in the test and omits shell commands and argument arrays.

- [x] **Step 3: Add the file-row action**

Extend `FileExplorer` and recursive `TreeNode` props with:

```ts
onEditFile?: (filePath: string) => void;
actionError?: string | null;
onDismissActionError?: () => void;
```

For hovered files, render an `Open in editor` button before the existing download button. Pass `onEditFile` through every recursive `TreeNode`. Move the existing mention button far enough left that mention, edit, and download controls never overlap. Do not show editor actions on directories.

Render `actionError` above the tree with `role="alert"` and a dismiss button, independently of upload progress/errors.

- [x] **Step 4: Wire the action in SessionSidebar**

Use `useEditor()` in `SessionSidebar`. Keep `editorActionError` state and implement an async callback that:

1. clears the previous error;
2. posts `buildEditorActionBody(filePath, editorSelection)` to `/api/file-actions`;
3. parses `{ error?: string }`;
4. stores the server error when the response is not OK.

Pass `onEditFile` only when `isEditorSelectionReady(editorSelection)` is true. Pass the error and dismiss callback to `FileExplorer`. Preserve upload refs, at-mention callbacks, refresh keys, and worktree behavior.

- [x] **Step 5: Verify and commit**

Run:

```bash
node --test lib/editor-config.test.mjs lib/editor-launch.test.mjs
node_modules/.bin/tsc --noEmit -p tsconfig.json
npm run lint
```

If the direct typecheck reads stale `.next` route types, use the source-only temporary config defined in Task 8 instead. Expected: tests, source typecheck, and lint pass.

Commit:

```bash
git add components/FileExplorer.tsx components/SessionSidebar.tsx lib/editor-config.ts lib/editor-config.test.mjs
git commit -m "feat: open workspace files in external editor"
```

---

### Task 4: Add secure directory-browser domain logic and API

**Files:**
- Create: `lib/directory-browser.ts`
- Create: `lib/directory-browser.test.mjs`
- Create: `app/api/directories/route.ts`

**Interfaces:**
- Consumes: `homedir()` and `getAllowedFileRoots()`.
- Produces: `DirectoryBrowserEntry`, `DirectoryBrowserLocation`, `resolveBrowsableDirectory(candidate, roots)`, `listBrowsableDirectories(directory)`, `getBrowsableParent(directory, root)`, and GET `/api/directories`.

- [x] **Step 1: Write failing containment and listing tests**

Create temporary fixtures for a home root, an allowed external workspace, a normal child directory, a regular file, and a directory symlink escaping home. Assert:

```js
test("directory browsing stays inside the selected real root", () => {
  assert.equal(resolveBrowsableDirectory(homeChild, [homeRoot, externalRoot]).root, realHomeRoot);
  assert.throws(
    () => resolveBrowsableDirectory(escapingSymlink, [homeRoot, externalRoot]),
    /Access denied/,
  );
});

test("directory listings exclude files and symbolic links", () => {
  assert.deepEqual(
    listBrowsableDirectories(realHomeRoot).map((entry) => entry.name),
    ["project"],
  );
});

test("parent navigation is clamped at the authorized root", () => {
  assert.equal(getBrowsableParent(realHomeRoot, realHomeRoot), null);
  assert.equal(getBrowsableParent(homeChild, realHomeRoot), realHomeRoot);
});
```

- [x] **Step 2: Run the test and verify RED**

Run `node --test lib/directory-browser.test.mjs`.

Expected: FAIL because the domain module does not exist.

- [x] **Step 3: Implement the domain module**

`resolveBrowsableDirectory()` must:

- reject missing paths and direct symlinks;
- canonicalize the candidate and every existing root with `realpathSync()`;
- find a containing canonical root with `isFilePathAllowed()`;
- choose the longest containing root when roots overlap;
- return canonical `{ directory, root }` paths;
- throw `Access denied` when no root contains the real candidate.

`listBrowsableDirectories()` uses `readdirSync(directory, { withFileTypes: true })`, keeps only `entry.isDirectory()`, filters the same ignored build/cache names used by the file API, and sorts by name. It does not follow symbolic links.

- [x] **Step 4: Add the directory route**

Create GET `/api/directories?path=<absolute path>`. Its roots are:

```ts
const roots = [homedir(), ...(await getAllowedFileRoots())];
```

When `path` is absent, use `homedir()`. Return:

```ts
{
  path: location.directory,
  root: location.root,
  parent: getBrowsableParent(location.directory, location.root),
  entries: listBrowsableDirectories(location.directory),
}
```

Do not call `allowFileRoot(homedir())` and do not mutate `getAllowedFileRoots()`.

- [x] **Step 5: Verify GREEN and commit**

Run:

```bash
node --test lib/directory-browser.test.mjs lib/default-workspace.test.mjs
npm run lint
```

Commit:

```bash
git add lib/directory-browser.ts lib/directory-browser.test.mjs app/api/directories/route.ts
git commit -m "feat: add secure workspace directory API"
```

---

### Task 5: Build the standalone workspace directory browser

**Files:**
- Create: `components/WorkspaceDirectoryBrowser.tsx`
- Modify: `lib/directory-browser.ts`
- Modify: `lib/directory-browser.test.mjs`

**Interfaces:**
- Consumes: GET `/api/directories` and POST `/api/cwd/validate`.
- Produces: `WorkspaceDirectoryBrowser({ onClose, onSelect })` and `getDirectoryBrowserKeyAction(input)`.

- [x] **Step 1: Write failing keyboard-action tests**

Extend `lib/directory-browser.test.mjs` to cover:

```js
assert.deepEqual(getDirectoryBrowserKeyAction({ key: "ArrowDown", modifier: false }), { type: "move", delta: 1 });
assert.deepEqual(getDirectoryBrowserKeyAction({ key: "ArrowUp", modifier: false }), { type: "move", delta: -1 });
assert.deepEqual(getDirectoryBrowserKeyAction({ key: "Backspace", modifier: false }), { type: "parent" });
assert.deepEqual(getDirectoryBrowserKeyAction({ key: "Escape", modifier: false }), { type: "close" });
assert.deepEqual(getDirectoryBrowserKeyAction({ key: "k", modifier: true }), { type: "focus-path" });
assert.deepEqual(getDirectoryBrowserKeyAction({ key: "Enter", modifier: false }), { type: "activate" });
```

Run the test and verify RED because the function is missing.

- [x] **Step 2: Implement the keyboard helper**

Add a discriminated union return type and the exact key mapping above. Return `null` for all other keys.

- [x] **Step 3: Implement WorkspaceDirectoryBrowser**

Create a fixed modal with z-index above Settings and the workspace dropdown. Props:

```ts
interface WorkspaceDirectoryBrowserProps {
  onClose: () => void;
  onSelect: (cwd: string) => void;
}
```

The component must:

- fetch `/api/directories` on mount;
- fetch `/api/directories?path=...` for entry, breadcrumb, parent, and quick-path navigation;
- render breadcrumbs from the response path without guessing authorization roots;
- keep loading and request errors inside the modal;
- use the keyboard helper for arrow selection, Enter activation, Backspace parent, Escape close, and Cmd/Ctrl+K path focus;
- open a highlighted entry on Enter, otherwise confirm the current directory;
- confirm by POSTing `{ cwd: currentPath }` to `/api/cwd/validate`;
- call `onSelect(normalizedCwd)` only after validation succeeds;
- remain open and show the validation error on failure;
- use a single-column, full-width layout on mobile through `useIsMobile()`.

- [x] **Step 4: Verify and commit**

Run:

```bash
node --test lib/directory-browser.test.mjs
npm run lint
```

Run the source-only typecheck if `.next` is stale. Commit:

```bash
git add components/WorkspaceDirectoryBrowser.tsx lib/directory-browser.ts lib/directory-browser.test.mjs
git commit -m "feat: add workspace directory browser"
```

---

### Task 6: Integrate Browse directories into the workspace selector

**Files:**
- Modify: `components/SessionSidebar.tsx`

**Interfaces:**
- Consumes: `WorkspaceDirectoryBrowser`.
- Produces: a `Browse directories…` workspace action while retaining `Custom path…` and desktop `selectDirectory()` behavior.

- [x] **Step 1: Add directory-browser integration state**

Add one `directoryBrowserOpen` boolean. Do not copy the dev browser's path, entry, breadcrumb, animation, or keyboard state into SessionSidebar.

- [x] **Step 2: Add the workspace action**

Between `Use default directory` and `Custom path…`, add a `Browse directories…` button. It stops dropdown event propagation and opens `WorkspaceDirectoryBrowser`.

Keep the existing `Custom path…` handler unchanged so desktop builds still use `window.piDesktop.selectDirectory()` and browsers still show validated text input.

- [x] **Step 3: Handle selection and close behavior**

Render `WorkspaceDirectoryBrowser` next to the sidebar root. On selection:

```ts
setSelectedCwd(cwd);
setCustomPathOpen(false);
setCustomPathValue("");
setCustomPathError(null);
setDropdownOpen(false);
setDirectoryBrowserOpen(false);
```

On close, change only `directoryBrowserOpen` so the underlying workspace dropdown remains usable.

- [x] **Step 4: Verify and commit**

Run directory tests, lint, and source typecheck. Expected: all pass.

```bash
git add components/SessionSidebar.tsx
git commit -m "feat: browse workspace directories from sidebar"
```

---

### Task 7: Add embedded upstream panels and unified Settings

**Files:**
- Create: `lib/settings.ts`
- Create: `lib/settings.test.mjs`
- Create: `components/SettingsConfig.tsx`
- Modify: `components/ModelsConfig.tsx`
- Modify: `components/SkillsConfig.tsx`
- Modify: `components/PluginsConfig.tsx`

**Interfaces:**
- Produces: `SettingsCategory`, `SETTINGS_CATEGORIES`, `getSettingsEmptyState(category, cwd)`, embedded props on three upstream panels, and `SettingsConfig`.
- Consumes: `useTheme`, `useSendShortcut`, `useEditor`, and existing upstream config components.

- [x] **Step 1: Write failing category tests**

Create `lib/settings.test.mjs`:

```js
test("all five settings categories are available", () => {
  assert.deepEqual(SETTINGS_CATEGORIES.map((item) => item.key), [
    "models", "skills", "plugins", "editor", "general",
  ]);
});

test("only workspace-scoped categories show an empty state without cwd", () => {
  assert.equal(getSettingsEmptyState("models", null), null);
  assert.match(getSettingsEmptyState("skills", null) ?? "", /workspace/i);
  assert.match(getSettingsEmptyState("plugins", null) ?? "", /workspace/i);
  assert.equal(getSettingsEmptyState("editor", null), null);
  assert.equal(getSettingsEmptyState("general", null), null);
});
```

Run the test and verify RED because `lib/settings.ts` is missing.

- [x] **Step 2: Implement settings categories**

Create the exact ordered category definitions and return `Select a workspace to manage skills.` or `Select a workspace to manage plugins.` only for the two cwd-scoped categories.

- [x] **Step 3: Add presentation-only embedded props**

Add `embedded?: boolean` to Models, Skills, and Plugins props.

For each component:

- standalone mode preserves the current fixed backdrop, frame size, header, and close behavior;
- embedded mode uses `height: "100%"`, `width: "100%"`, no fixed positioning, no backdrop, no shadow, no outer border, and no outer radius;
- embedded mode hides the component header and Close/Cancel buttons;
- Models retains its Save action and error text;
- Skills retains update controls and status counts;
- Plugins retains diagnostics, Refresh, and reload behavior;
- nested provider pickers remain fixed above the Settings modal.

Do not move fetch, save, install, update, OAuth, API-key, or reload logic into SettingsConfig.

- [x] **Step 4: Build SettingsConfig**

Create props:

```ts
interface SettingsConfigProps {
  cwd: string | null;
  sessionId: string | null;
  onClose: () => void;
  onPluginReloaded: () => void;
}
```

The modal has one header, category navigation, and one content area. Desktop navigation is a 180px left column; mobile navigation is a horizontally scrollable row. Category rendering is:

- Models: `<ModelsConfig embedded onClose={() => {}} />`;
- Skills/Plugins: empty state without cwd, embedded panel with cwd otherwise;
- Editor: known-editor select plus custom absolute-path input, current command display, and validation explanation;
- General: theme toggle and send-shortcut radio controls using the existing hooks.

Changing categories must not remount the Settings shell. Clicking the backdrop or × closes it.

- [x] **Step 5: Verify and commit**

Run:

```bash
node --test lib/settings.test.mjs lib/editor-config.test.mjs hooks/useSendShortcut.test.mjs
npm run lint
```

Run source typecheck. Commit:

```bash
git add lib/settings.ts lib/settings.test.mjs components/SettingsConfig.tsx components/ModelsConfig.tsx components/SkillsConfig.tsx components/PluginsConfig.tsx
git commit -m "feat: add unified settings panel"
```

---

### Task 8: Switch AppShell to one Settings entry and complete verification

**Files:**
- Modify: `components/AppShell.tsx`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-07-19-unified-settings-directory-browser-editor.md`

**Interfaces:**
- Consumes: `SettingsConfig` and every completed task.
- Produces: one sidebar Settings entry and the final verified feature set.

- [x] **Step 1: Replace separate modal state and sidebar buttons**

In AppShell:

- replace `modelsConfigOpen`, `skillsConfigOpen`, and `pluginsConfigOpen` with `settingsConfigOpen`;
- replace the three bottom buttons with one full-width gear button labeled `Settings`;
- remove direct Models/Skills/Plugins modal rendering;
- compute `settingsCwd = activeCwd ?? selectedSession?.cwd ?? newSessionCwd`;
- render SettingsConfig with that cwd, the selected session ID, and the existing session reload callback;
- on close, set Settings false and increment `modelsRefreshKey` exactly once.

Keep `modelsRefreshKey`, theme quick access, send-shortcut quick access, and plugin `sessionKey` invalidation.

- [x] **Step 2: Update project documentation**

Add these entries to AGENTS.md:

```text
app/api/directories/route.ts       GET secure directory-only workspace browsing
app/api/file-actions/route.ts      POST external editor actions
components/SettingsConfig.tsx      unified Models/Skills/Plugins/Editor/General shell
components/WorkspaceDirectoryBrowser.tsx secure workspace picker
hooks/useEditor.ts                 shared external-editor preference
```

Document that directory browsing home does not authorize home for file reads and that custom editors are absolute executables launched without a shell.

- [x] **Step 3: Run the full Node test set**

Run:

```bash
test_files=($(rg --files -g '*.test.mjs'))
node --test "$test_files[@]"
```

Expected: every test passes.

- [x] **Step 4: Run source-only TypeScript verification**

Because the running dev server owns `.next`, create `tsconfig.verify.json` with `apply_patch`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", ".next"]
}
```

Run:

```bash
node_modules/.bin/tsc --noEmit -p tsconfig.verify.json
```

Expected: exit 0. Delete the temporary config with `apply_patch` immediately afterward.

- [x] **Step 5: Run lint, diff, and repository checks**

Run:

```bash
npm run lint
git diff --check
git diff --name-only --diff-filter=U
git status --short
```

Expected: lint exits 0, no conflict markers or whitespace errors exist, and only task changes plus the pre-existing untracked files are present.

- [x] **Step 6: Perform browser validation**

Use the Browser skill against `http://localhost:30141`. Verify the scenarios listed in the design spec: five Settings categories, cwd empty states, directory mouse/keyboard navigation, normalized selection, editor error feedback, and mobile layouts. If no browser backend is available, record this as an explicit unverified manual check rather than substituting source inspection.

- [x] **Step 7: Request code review and fix blocking findings**

Review `git diff` against the design spec. Critical and Important findings must be fixed with a failing regression test before the final commit.

- [x] **Step 8: Mark the plan complete and commit**

Change completed plan checkboxes to `[x]`, stage only the exact tracked/new task paths, verify the pre-existing untracked list is unchanged, and commit:

```bash
git commit -m "feat: unify settings and workspace selection"
```
