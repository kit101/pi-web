# @ File Mention Design

**Date:** 2026-06-04
**Author:** Claude Code

## Goal

Enable users to reference files and folders in chat messages by typing `@` followed by a file/folder name, triggering a popup autocomplete panel. Selected items are inserted as `` `relative/path` `` into the textarea, consistent with the existing sidebar @ button behavior.

## Architecture

```
┌─────────────────────────────────────────────┐
│                ChatInput                     │
│  ┌──────────────────────────────────────┐   │
│  │           <textarea />                │   │
│  └─────────┼──────────────────────────┘   │
│            │                              │
│            ▼                              │
│  ┌──────────────────────────────────────┐   │
│  │        MentionPopup                   │   │
│  │  ┌────────────────────────────────┐  │   │
│  │  │ 📄 file-a.ts                    │  │   │
│  │  │ 📁 folder/                      │  │   │
│  │  └────────────────────────────────┘  │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Data: MentionPopup → useFileMention()       │
└──────────────────────────────────────────────┘
```

### Components & Files

| File | Role | Changes |
|---|---|---|
| `components/MentionPopup.tsx` | **New** — popup UI for file/folder selection | ~180 lines |
| `hooks/useFileMention.ts` | **New** — core logic: @ detection, search, hybrid data loading, match filtering | ~250 lines |
| `components/ChatInput.tsx` | **Modify** — integrate useFileMention hook, render MentionPopup, adjust key handling | ~50-70 lines added |
| `lib/types.ts` | **Modify** — add FileMentionItem type | ~8 lines |
| `lib/file-paths.ts` | **Modify** — add getRelativeFolderPath utility | ~10 lines |

## Component Design

### 1. `useFileMention` hook

**Signature:**
```typescript
interface UseFileMentionOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  cwd: string;
}

interface UseFileMentionReturn {
  active: boolean;
  searchTerm: string;
  position: { left: number; top: number };
  matches: FileMentionItem[];
  loading: boolean;
  selectedIndex: number;
  selectItem: (item: FileMentionItem) => void;
  dismiss: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}
```

**Logic flow:**
1. On textarea `onChange`: test cursor context against regex `/@\S*$/`
2. If match: extract `searchTerm`, compute caret coordinates, set `active=true`
3. On `searchTerm` change: search cached file tree (debounce 150ms)
4. If search contains `/` and cached tree doesn't cover that depth, fetch API (debounce 300ms)
5. Return up to 20 matches

**Data loading strategy:**
- **Startup**: Recursively fetch top-level directory tree (depth 2) via `/api/files/[...path]?type=list`, cache in memory
- **On-demand**: If search term contains path separator beyond cached depth, fetch that subdirectory via API
- **Cache**: Plain object `{ [directoryPath]: FileEntry[] }`, invalidated on component unmount

### 2. `MentionPopup` component

**Props:**
```typescript
interface MentionPopupProps {
  position: { left: number; top: number };
  items: FileMentionItem[];
  selectedIndex: number;
  onSelect: (item: FileMentionItem) => void;
  onDismiss: () => void;
}
```

**UI specs:**
- Absolute positioning, max-height 300px, max-width 400px
- File icons via existing FileIcons component; folder icon: 📁
- Selected item highlighted with background color
- Scrollable if more than 20 items
- Click outside dismisses
- Hover item sets selectedIndex

### 3. ChatInput integration

**Changes:**
- Add `const mention = useFileMention({ textareaRef, cwd })` 
- In `onChange`: call `mention.onChange(textarea.value)` 
- In `onKeyDown`: if `mention.active`, let mention handle ArrowUp/ArrowDown/Enter/Escape first
- When `mention.active && mention.matches.length > 0`, render `<MentionPopup ... />`
- On item select: `mention.selectItem()` inserts `` `item.relativePath` `` via existing `insertText`

**Key priority when popup active:**
- `ArrowUp/ArrowDown` → navigate list (no cursor movement in textarea)
- `Enter` → select item (no send)
- `Escape` → dismiss popup
- All other keys → pass through to textarea normally

### 4. Caret position calculation

Use hidden canvas method:
- Create offscreen canvas with same font/style as textarea
- Iterate text character-by-character up to cursor position
- Sum character widths using `measureText()`
- Add textarea border, padding, scroll offsets
- Return `{ left, top }` for popup positioning

### 5. Types

```typescript
interface FileMentionItem {
  label: string;        // Display name (filename or folder name)
  type: 'file' | 'folder';
  fullPath: string;     // Absolute path for API calls
  relativePath: string; // Relative path for insertion
}
```

## Error Handling

| Scenario | Behavior |
|---|---|
| API request fails | Show "Failed to load" in popup with retry button; user can still type manually |
| No matches found | Show "No matching files" text in popup |
| textarea ref missing | Silently dismiss popup |
| Window resize/scroll | Recompute position or dismiss |
| Large directory (1000+ files) | Virtualize or paginate display; cap at 20 visible items |

## Success Criteria

1. Typing `@` in the chat input shows a popup with file/folder suggestions
2. Typing after `@` filters the list (e.g., `@lib/comp` → shows files containing "lib/comp")
3. Arrow keys navigate the list; Enter selects; Escape dismisses
4. Selected item inserts `` `relative/path` `` at cursor position
5. Popup dismisses when clicking outside or moving cursor away from @ token
6. Files and folders are both supported
7. Existing ChatInput functionality (send, paste images, resize) is unaffected
