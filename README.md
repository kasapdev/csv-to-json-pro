# CSV ⇄ JSON Converter Pro

[![CI](https://github.com/kasapdev/csv-to-json-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/kasapdev/csv-to-json-pro/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?logo=javascript&logoColor=black)

Convert CSV to JSON and back, with a hand-written parser that gets quoting right — fast, private, and fully offline.

> A zero-dependency CSV/JSON workbench. Paste or upload a CSV file and get structured JSON in either array-of-objects or array-of-arrays shape, with optional type inference for numbers, booleans and null. Flip the direction and paste JSON back to get clean, correctly-quoted CSV. Nothing ever leaves your browser.

## Overview

CSV to JSON Converter Pro runs entirely in the browser with no build step, no frameworks, and no network calls — open `index.html` from disk and it works. A two-pane layout pairs a raw input editor with a formatted, read-only output view, matching the rest of the kasapdev tool suite. The CSV parser and serializer are written from scratch (no library): the parser correctly handles quoted fields containing commas, newlines, and escaped (`""`) quotes; the serializer only quotes fields that actually need it and doubles embedded quotes.

## Features

- **Two-way conversion** — CSV → JSON and JSON → CSV, switched with a single segmented control.
- **Hand-rolled CSV parser** — correctly handles quoted fields with embedded commas, newlines, and `""` escaped quotes, `\r\n`/`\n` line endings, and CSVs with or without a trailing newline.
- **Hand-rolled CSV serializer** — quotes only fields that need it (containing a comma, quote, newline, or leading/trailing whitespace) and doubles internal quotes.
- **Output shape toggle** — array-of-objects (using the header row as keys) or array-of-arrays.
- **Header row toggle** — treat the first CSV row as column headers, or not (synthesizes `column1`, `column2`, … when absent).
- **Type inference toggle** — detect numbers, `true`/`false`, and `null` in CSV cells instead of leaving every value as a string.
- **Reverse mode (JSON → CSV)** — paste or upload a JSON array of flat objects (or array of arrays) and get back correctly-quoted CSV, with the header row built from the union of all object keys.
- **Copy**, **Download** (`.json` or `.csv` depending on direction), and **Upload** (`.csv` or `.json`, mode auto-detected from the file extension).
- **Load sample** — a realistic dataset with quoted, comma-containing text and a missing value, in both directions.
- **Live stats bar** — row count, column count, and output size.
- **Clear error reporting** — malformed JSON or an unsupported JSON shape (e.g. mixed arrays) surfaces a readable message instead of a silent failure.
- **Auto-persist** — your last input, direction, shape and options are saved to `localStorage` and restored on return.
- **Dark & light themes**, fully responsive down to 360px, accessible, and keyboard-driven.

## Installation

No dependencies, no build step.

```bash
git clone https://github.com/kasapdev/csv-to-json-pro.git
cd csv-to-json-pro
```

Then simply open `index.html` in any modern browser (double-click it, or `file://` it). That's it.

## Usage

1. Pick a direction: **CSV → JSON** or **JSON → CSV**.
2. Paste or type into the **Input** pane, or click **Sample** / **Upload** a file.
3. In CSV → JSON mode, choose the **output shape** (objects or arrays), and toggle **Infer types** / **Header row** as needed.
4. Click **Convert** (or press <kbd>Ctrl/⌘</kbd>+<kbd>Enter</kbd>).
5. **Copy** the result or **Download** it — `.json` when converting from CSV, `.csv` when converting from JSON.

## Keyboard Shortcuts

| Action          | Shortcut                             |
| ---------------- | ------------------------------------ |
| Convert           | <kbd>Ctrl/⌘</kbd> + <kbd>Enter</kbd> |
| Download output   | <kbd>Ctrl/⌘</kbd> + <kbd>S</kbd>     |
| Show shortcuts help | <kbd>?</kbd>                       |
| Close dialog       | <kbd>Esc</kbd>                       |

## Screenshots

> _Screenshots coming soon._

## Roadmap

- [ ] Custom delimiter support (semicolon, tab, pipe)
- [ ] Column reordering / renaming before conversion
- [ ] Nested-object flattening (dot-path headers) for JSON → CSV
- [ ] Streaming parse for very large files
- [ ] Drag-and-drop file upload

## License

MIT Licensed.
