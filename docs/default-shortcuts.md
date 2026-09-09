# Default shortcut keys

This is the complete built-in shortcut reference for cmux. The defaults are
defined by `DefaultKeymapRules` in
`overlay/chrome/browser/cmux_term/cmux_keymap.cc`; user rules in
`~/.config/cmux/cmux.json` can add, replace, or remove them.

## Notation

- `mod` is Command on macOS and Control on Linux/Windows.
- On macOS, the default `command-tabs-control-workspaces` scheme uses Command
  for tabs and Option for workspaces.
- On macOS, the alternate `control-tabs-command-workspaces` scheme uses
  Control for tabs and Command for workspaces. Native page, pane, column, and
  app shortcuts keep their Command bindings.
- `escape` is active only when the omnibox is focused or a drag is active.
- The zoom shortcuts are ignored while a terminal is focused.

## Shared defaults

| Shortcut | Action |
| --- | --- |
| `mod+b` | Toggle sidebar |
| `mod+z` | Undo |
| `mod+shift+z` | Redo |
| `mod+x` | Cut |
| `mod+c` | Copy |
| `mod+v` | Paste |
| `mod+a` | Select all |
| `mod+shift+n` | New window |
| `mod+shift+w` | Close window |
| `mod+shift+enter` | Toggle fullscreen |
| `mod+t` | New web tab |
| `mod+d` | Split pane right / create a column |
| `mod+shift+d` | Split pane down |
| `mod+n` | New column |
| `mod+l` | Focus omnibox |
| `mod+r` | Reload page |
| `mod+[` | Go back |
| `mod+]` | Go forward |
| `mod+=` or `mod+plus` | Zoom in |
| `mod+-` | Zoom out |
| `mod+0` | Reset zoom |
| `ctrl+tab` | Next tab |
| `ctrl+shift+tab` | Previous tab |
| `alt+n` | New workspace |
| `?` (`shift+/`) | Open the Keyboard settings and current shortcut list |
| `escape` | Exit omnibox or cancel an active drag |

The following shortcuts use the scheme's tab modifier (`tab`) or workspace
modifier (`workspace`):

| Shortcut | Action |
| --- | --- |
| `tab+w` | Close tab |
| `tab+shift+[` | Previous tab |
| `tab+shift+]` | Next tab |
| `tab+1` through `tab+9` | Select tab 1 through 9 (9 selects the last tab) |
| `workspace+shift+m` | Toggle workspace layout |
| `workspace+[` | Previous workspace* |
| `workspace+]` | Next workspace* |
| `workspace+1` through `workspace+9` | Select workspace 1 through 9 |

\* On the default macOS scheme these are `alt+[` and `alt+]`; on macOS's
alternate scheme they are `cmd+[` and `cmd+]`; on Linux/Windows they are
`ctrl+alt+[` and `ctrl+alt+]`.

## macOS defaults

These are present in addition to the shared defaults. In the default
`command-tabs-control-workspaces` scheme, `tab` is `cmd` and `workspace` is
`alt`. In the alternate scheme, `tab` is `ctrl` and `workspace` is `cmd`.

| Shortcut | Action |
| --- | --- |
| `cmd+shift+t` | Restore the last closed tab |
| `cmd+ctrl+t` | New terminal tab |
| `cmd+ctrl+r` | Cycle column width |
| `cmd+ctrl+h` or `cmd+alt+left` | Focus pane left |
| `cmd+ctrl+l` or `cmd+alt+right` | Focus pane right |
| `cmd+ctrl+k` or `cmd+alt+up` | Focus pane up |
| `cmd+ctrl+j` or `cmd+alt+down` | Focus pane down |
| `cmd+alt+i` | Toggle DevTools |

In the alternate scheme, `cmd+t` remains a web-tab shortcut in addition to
the scheme-generated `ctrl+t` tab shortcut.

## Linux and Windows defaults

Here `mod`, `tab`, and `workspace` all resolve to Control.

| Shortcut | Action |
| --- | --- |
| `ctrl+shift+t` | Restore the last closed tab |
| `ctrl+alt+t` | New terminal tab |
| `ctrl+alt+r` | Cycle column width |
| `ctrl+left` | Focus pane left |
| `ctrl+right` | Focus pane right |
| `ctrl+up` | Focus pane up |
| `ctrl+down` | Focus pane down |

## Commands without a default shortcut

`keymap.reload`, `theme.reload`, and `devtools.undock` are available commands
but are unbound by default. They can be assigned in the `keybindings` array.
