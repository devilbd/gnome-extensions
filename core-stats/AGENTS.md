# AGENTS.md - Autonomous Agent Guidelines for 'core-stats'

This document defines the operational rules, constraints, and architecture guidelines for autonomous AI agents (Claude, Copilot, Antigravity, Gemini, OpenCode, Aider, etc.) operating on the `core-stats` (`core-stats@devilbd.com`) repository.

---

## 1. Project Invariants

- **Project Type:** GNOME Shell Desktop Extension (ESM).
- **Target Versions:** GNOME Shell 45 through 50.
- **UUID:** `core-stats@devilbd.com`
- **Language / Runtime:** JavaScript running on GJS (SpiderMonkey ESM).
- **Primary Subsystems:**
  - `extension.js` – Lifecycle, sysfs `hwmon` & `/proc` discovery, asynchronous file loading, Clutter/St actor hierarchy, background group placement.
  - `prefs.js` – Libadwaita Preferences dialog (`Adw.PreferencesPage`), GSettings data binding.
  - `schemas/` – GLib GSettings XML schema and compiled binary (`org.gnome.shell.extensions.core-stats@devilbd.com.gschema.xml`).
  - `stylesheet.css` – Glassmorphic HUD styling, custom component progress bars, and thermal alert classes (`status-warning`, `status-critical`).
  - `icons/` – Symbolic SVG assets (such as `cpu-chip-symbolic.svg`).
  - `package.sh` & `install.sh` – Shell scripts for packaging and local installation.

---

## 2. Critical Rules of Engagement for Agents

### 1. Complete Lifecycle Cleanup & Zero Memory Leaks
Every resource, signal handler, or GLib source allocated in `enable()` **must** be explicitly torn down in `disable()`. Failure to do so will cause GNOME Shell performance degradation or crashes across extension reloads.
- **Signals:** Always retain signal IDs returned by `.connect()` (e.g., `this._settingsId`) and disconnect them with `.disconnect(id)` in `disable()`.
- **GLib Timers:** Both initialization and update timers (`this._initTimeoutId`, `this._updateId`) must be cancelled using `GLib.source_remove(...)` and set to `null`.
- **Actors:** Remove `this._container` from its parent actor (`Main.layoutManager._backgroundGroup` or fallback `Main.uiGroup`) before invoking `.destroy()`.
- **State References:** Reset `this._monitoredItems`, `this._uiItems`, and `this._settings` to prevent dangling references.

### 2. Pure ECMAScript Modules (No Node.js / CommonJS)
- **Do not** introduce `require()`, `module.exports`, `__dirname`, or Node.js built-ins (`fs`, `path`, `process`).
- Imports must strictly follow GJS conventions:
  - GNOME GObject Introspection libraries: `import St from 'gi://St';`, `import Gio from 'gi://Gio';`, `import Clutter from 'gi://Clutter';`
  - GNOME Shell internal modules: `import * as Main from 'resource:///org/gnome/shell/ui/main.js';`
  - Extension classes: `import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';`

### 3. Asynchronous Non-Blocking Sensor I/O
- **Never** perform synchronous disk or file reading in update loops (e.g. `GLib.file_get_contents` or `cat` command subprocesses). This blocks the GNOME Shell compositor and causes noticeable UI stutter.
- Always use asynchronous reading routines via `Gio.File.load_contents_async` (see `_readFile`) and `query_filesystem_info_async` for drive metrics.
- Always validate that target sysfs/proc paths exist with `GLib.file_test` before opening them.
- Hardware configurations vary widely; handle missing sensor nodes (`temp1_input`, `gpu_busy_percent`, etc.) gracefully without crashing the extension.

### 4. GSettings Schema Integrity
When modifying or adding settings:
1. Edit `schemas/org.gnome.shell.extensions.core-stats@devilbd.com.gschema.xml`.
2. Always execute `glib-compile-schemas schemas/` to update `schemas/gschemas.compiled`.
3. Update `prefs.js` (create corresponding Adw / Gtk rows and bind to GSettings keys).
4. Update `extension.js` (handle setting changes in `this._settings.connect('changed', ...)` and reflect updates dynamically).

### 5. Desktop Background Layer Placement
- The widget actor must be attached to `Main.layoutManager._backgroundGroup` so it stays behind all application windows while remaining visible above the wallpaper.
- If `_backgroundGroup` is unavailable, fall back to `Main.uiGroup` placed below `Main.layoutManager.windowGroup`.

---

## 3. Directory Layout Reference

```text
core-stats/
├── extension.js          # Core extension logic, sensor polling, and Clutter/St UI
├── prefs.js              # Preferences window code (Adw.PreferencesPage)
├── metadata.json         # Extension metadata, UUID, supported shell versions (45-50)
├── stylesheet.css        # Extension CSS (HUD theme, bar styling, alert glows)
├── package.sh            # Packaging automation script
├── install.sh            # Local installation script
├── icons/                # Symbolic icon assets
│   └── cpu-chip-symbolic.svg
├── schemas/              # GSettings schema XML and compiled binary
│   └── org.gnome.shell.extensions.core-stats@devilbd.com.gschema.xml
├── .agents/              # Agent rules and skills directory
│   ├── rules/            # Specialized rule definitions (gnome-shell, system-monitoring)
│   └── skills/           # Custom agent automation skills (package-and-install)
├── AGENTS.md             # This document
├── GEMINI.md             # Gemini/Antigravity developer context
└── README.md             # Public README and user guide
```

---

## 4. Verification Procedures for Agents

Before completing any task, agents must run the following validation steps:

1. **Schema Compilation Check:**
   ```bash
   glib-compile-schemas --strict schemas/
   ```
   *Expected result: 0 errors.*

2. **Package Build Test:**
   ```bash
   ./package.sh
   ```
   *Expected result: Produces `core-stats@devilbd.com.shell-extension.zip` without warnings.*

3. **Code Syntax Verification:**
   Ensure JS files are syntactically valid ESM JavaScript.

---

## 5. Summary of Do's and Don'ts

| Do | Don't |
| :--- | :--- |
| Use `gi://` imports for GObject libraries | Use Node.js `require()` or npm packages |
| Read sensors asynchronously with `load_contents_async` | Use synchronous file I/O or shell commands inside the update loop |
| Clean up all timers and disconnect signals in `disable()` | Leave background interval timers running when disabled |
| Call `glib-compile-schemas schemas/` after schema edits | Commit modified schema XML without testing compilation |
| Parent actor to `Main.layoutManager._backgroundGroup` | Add widget directly to `Main.uiGroup` without z-order positioning |
| Handle missing `/sys/class/hwmon` entries gracefully | Assume all systems have AMD/Intel/NVIDIA sensors at static paths |
