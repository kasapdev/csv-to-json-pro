# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.1] - 2026-09-06

### Fixed

- Pressing <kbd>Ctrl/⌘</kbd>+<kbd>Enter</kbd> while focused in the input textarea ran the conversion twice (and showed two stacked "Converted ✓" toasts). The textarea had its own local `keydown` handler for the shortcut *in addition to* the global `mod+enter` shortcut already registered via `WUS.registerShortcut`, which also fires while typing. Since `keydown` bubbles from the textarea up to `document`, both handlers ran on every press. Removed the redundant local handler; the global shortcut already covers this case.
