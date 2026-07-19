# Unified Settings, Directory Browser, and External Editor Design

## Goal

Replace the three separate sidebar configuration buttons with one unified Settings entry, restore the dev-style workspace directory browser without widening file-read permissions, and add a functional external-editor workflow with safe custom executable paths.

## Scope

The unified Settings window contains five categories:

- Models
- Skills
- Plugins
- Editor
- General

Models remains available without an active workspace. Skills and Plugins require an active workspace and show an explanatory empty state when none is selected. Editor and General are global browser settings.

The workspace selector retains both direct path entry and directory browsing:

- `Browse directories…` opens a directory-only browser.
- `Custom path…` keeps the existing validated text entry.

External-editor support includes editor selection, a safe custom executable path, and an `Open in editor` action from the file tree. File-manager reveal actions and shell command templates are outside this scope.

## Architecture

### Unified Settings shell

Create a `SettingsConfig` modal that owns category navigation and the shared modal frame. It does not duplicate model, skill, or plugin business logic.

`ModelsConfig`, `SkillsConfig`, and `PluginsConfig` gain an `embedded` presentation mode. In embedded mode each component renders its existing content and nested dialogs without its own full-screen backdrop, outer modal frame, or close footer. Standalone mode remains supported so internal behavior is not coupled to the new shell.

`AppShell` replaces the Models, Skills, and Plugins sidebar buttons and their separate open-state flags with one Settings button and one Settings open state. Closing Settings refreshes model data. Plugin reloads continue to invalidate the active agent session through the existing callback.

The current theme and send-shortcut quick controls remain available. General becomes the canonical full settings page for both values, using the existing `useTheme` and `useSendShortcut` shared hooks.

### Editor configuration

Add a `useEditor` hook following the repository's shared localStorage pattern:

- `useSyncExternalStore`
- module-level listener set
- validated snapshots
- no `CustomEvent` or lazy `useState` initialization

The editor configuration contains an editor identifier and an optional custom executable path. Known editor identifiers map to fixed executable names on the server. The custom option is valid only when the configured value is an absolute path to a real executable file.

The client never sends a shell command string. It sends a structured editor selection. The server builds the command and invokes it with `shell: false`, passing the selected file path as a separate argument.

Create a dedicated file-action route instead of overloading the existing upload POST handler. The route:

1. reconstructs the requested file path;
2. checks it against `getAllowedFileRoots()` and `isFilePathAllowed()`;
3. verifies that the target is a real file;
4. validates the editor identifier or custom executable path;
5. spawns the editor without a shell;
6. returns a structured error when validation or launch fails.

`FileExplorer` shows `Open in editor` for files on hover. `SessionSidebar` supplies the current editor configuration and reports launch failures in a compact explorer-level error message. Directories do not expose the action.

### Workspace directory browser

Extract the dev-style browser into a focused `WorkspaceDirectoryBrowser` component rather than restoring the large block of modal state directly inside `SessionSidebar`.

The component owns:

- current path and parent path;
- directory entries and loading/error state;
- breadcrumb navigation;
- forward/back navigation animation;
- arrow, Enter, Escape, Backspace, and Cmd/Ctrl+K keyboard handling;
- quick-path navigation;
- directory confirmation.

`SessionSidebar` only owns whether the browser is open and what happens after selection. Confirming a directory calls the existing `/api/cwd/validate` route before changing the selected workspace. This preserves canonical path normalization and `allowFileRoot()` behavior.

### Directory API security boundary

Add a directory-listing route dedicated to workspace selection. It lists directory names and metadata only; it never reads file contents.

The browsable roots are:

- the user's home directory;
- roots already returned by `getAllowedFileRoots()`.

The home directory is a directory-browser root only. It must not be added to the file-content allow-list.

Every requested directory is normalized and resolved against its permitted root. Real paths are used for containment checks so a symlink inside home or an allowed workspace cannot escape to another filesystem location. Directory entries that are symbolic links or non-directories are not returned. The parent field is `null` at the selected root, so browser navigation cannot climb above an authorized root.

Quick-path navigation follows the same browsing boundary. Users can still select an explicit directory outside those roots through the existing `Custom path…` input, which validates and authorizes exactly the submitted directory.

## Data Flow

### Settings

1. The user clicks the sidebar Settings button.
2. `AppShell` opens `SettingsConfig` with the effective cwd and existing refresh callbacks.
3. The selected category renders an embedded upstream configuration component or a local Editor/General panel.
4. Shared browser settings update through their existing external-store hooks.
5. Closing Settings refreshes model data once.

### Directory selection

1. The user opens the workspace dropdown and clicks `Browse directories…`.
2. `WorkspaceDirectoryBrowser` requests the home root from the directory route.
3. Navigation requests remain inside home or an already authorized root.
4. Confirming a directory posts it to `/api/cwd/validate`.
5. On success, `SessionSidebar` selects the normalized cwd and closes both browser and workspace dropdown.
6. On failure, the browser remains open and shows the returned error.

### External editor

1. The user selects a known editor or configures an absolute custom executable in Settings.
2. The editor choice is persisted through `useEditor`.
3. The user clicks `Open in editor` on a file-tree row.
4. The client posts the structured editor selection to the dedicated file-action route.
5. The server validates both the file and editor, then spawns the editor with the file as a separate argument.
6. Launch errors are shown without changing the selected file or workspace.

## Error Handling

- Settings categories that require a cwd render an empty state instead of mounting their data-loading UI with an empty path.
- Invalid stored editor identifiers fall back to the default known editor.
- A missing custom executable disables the file action and is explained in Editor settings.
- Directory loading errors stay inside the browser and can be retried by navigating again.
- Directory selection errors do not close the browser.
- Editor route errors use explicit 400, 403, 404, or 500 responses for invalid configuration, access denial, missing files, and launch failures.
- No code path falls back to shell execution.

## Testing

Use Node's test runner for pure logic and route helpers:

- settings category availability with and without a cwd;
- editor localStorage parsing and invalid-value fallback;
- known-editor command construction;
- custom editor absolute-path and executable validation;
- directory root selection and parent clamping;
- rejection of traversal and escaping symbolic links;
- exclusion of files and symbolic links from directory entries.

Component integration is checked by TypeScript and lint. Browser validation covers:

- one Settings entry replacing three buttons;
- all five categories opening correctly;
- Models without a cwd and Skills/Plugins empty states;
- directory mouse and keyboard navigation;
- selection through `/api/cwd/validate`;
- editor preset and custom-path launch error feedback;
- mobile layout of the Settings modal and workspace browser.

Run all existing `*.test.mjs` files, `npm run lint`, and a source-only TypeScript check that excludes the active `.next` cache. Do not run `next build`.

## Non-Goals

- Shell command templates or arbitrary editor arguments
- Opening directories in the external editor
- File-manager reveal actions
- Making home a general file-content root
- Replacing current Models, Skills, or Plugins data logic
- Refactoring unrelated AppShell, SessionSidebar, or file-viewer behavior
