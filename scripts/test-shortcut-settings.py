#!/usr/bin/env python3
"""Source integration checks for the in-app shortcut viewer/editor."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TERM = ROOT / "overlay/chrome/browser/cmux_term"

keymap = (TERM / "cmux_keymap.cc").read_text()
views = (TERM / "cmux_views.cc").read_text()
settings = (TERM / "cmux_configure_page.cc").read_text()
docs = (ROOT / "docs/configure-page.md").read_text()


def require(text: str, needle: str, description: str) -> None:
    if needle not in text:
        raise AssertionError(description)


require(
    keymap,
    'AddDefault(&rules, "shift+/", "settings.shortcuts",',
    "the default question-mark shortcut must remain in the keymap",
)
require(
    keymap,
    '"!terminalFocused && !omniboxFocused"',
    "question mark must remain available as terminal and omnibox input",
)
require(
    views,
    '{"settings.shortcuts", CommandAction::kSettingsShortcuts, false}',
    "the shortcut-viewer command must remain registered",
)
require(
    views,
    "case CommandAction::kSettingsShortcuts:",
    "the shortcut-viewer command must remain executable",
)
require(
    views,
    '"chrome://cmux-configure/?section=details"',
    "question mark must deep-link to the Keyboard settings panel",
)
require(
    views,
    'NewTabInPane(FocusedPane(), SurfaceKind::kWeb, std::string(),',
    "question mark must create a web tab with the settings URL",
)
require(
    settings,
    'id="add-shortcut"',
    "the Keyboard panel must expose an add-shortcut control",
)
require(
    settings,
    'id="shortcut-editor"',
    "the Keyboard panel must expose the shortcut editor",
)
require(
    settings,
    'id="editor-preview"',
    "the editor must show the preference that will be saved",
)
require(
    settings,
    "edit.addEventListener('click', () => showShortcutEditor(binding));",
    "each displayed binding must be editable",
)
require(
    settings,
    "sendWithPromise('saveKeybinding'",
    "the editor must await the native save result",
)
require(
    settings,
    '"saveKeybinding"',
    "the native WebUI save handler must remain registered",
)
require(
    settings,
    "AppendKeybindingRuleToConfig(updated, scheme, *rule, &error)",
    "saves must use the JSONC-preserving keybinding editor",
)
require(
    settings,
    "base::ImportantFileWriter::WriteFileAtomically(path, *with_rule)",
    "shortcut preferences must be persisted atomically",
)
require(
    docs,
    "Pressing `?` outside the terminal and omnibox",
    "the quick viewer shortcut must remain documented",
)
require(
    docs,
    "Add and edit controls append validated",
    "the preference-edit behavior must remain documented",
)

print("Shortcut settings integration: PASS")
