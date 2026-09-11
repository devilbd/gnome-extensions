# AGENTS.md - Autonomous Agent Guidelines for 'analogue-clock'

This document defines the operational rules, constraints, and architecture guidelines for autonomous AI agents (Claude, Copilot, Antigravity, Gemini, OpenCode, Aider, etc.) operating on the `analogue-clock` (`clock@devilbd.com`) repository.

---

## 1. Project Invariants

- **Project Type:** GNOME Shell Desktop Extension (ESM).
- **Target Versions:** GNOME Shell 45 through 50.
- **Language / Runtime:** JavaScript running on GJS (SpiderMonkey).
- **Primary Subsystems:**
  - `extension.js` – Lifecycle, actor hierarchy, Cairo 2D drawing, multi-monitor layout.
  - `prefs.js` & `prefs.ui` – Libadwaita Preferences dialog, GSettings data binding.
  - `schemas/` – GLib GSettings XML schema and compiled binary.
  - `package.sh` & `install.sh` – Shell scripts for packaging and local installation.

---

## 2. Critical Rules of Engagement for Agents

### 1. Zero Memory Leaks & Complete Lifecycle Cleanup
Every resource, signal handler, or GLib source allocated in `enable()` **must** be explicitly torn down in `disable()`. Failure to do so will cause GNOME Shell performance degradation or crashes across extensions reloads.
- **Signals:** Always retain signal IDs returned by `.connect()` and disconnect them with `.disconnect(id)`.
- **Layout Manager Signals:** Always disconnect listeners connected to `Main.layoutManager` (such as `monitors-changed`) in `disable()`.
- **GLib Timers:** Timers created via `GLib.timeout_add_seconds` or `GLib.timeout_add` must be cancelled with `GLib.source_remove(this._timeout)` and the reference set to `null`.
- **Actors:** Remove any child added to `Main.layoutManager._backgroundGroup` and invoke `.destroy()` on the actor.

### 2. Pure ECMAScript Modules (No Node.js / CommonJS)
- **Do not** introduce `require()`, `module.exports`, `__dirname`, or Node.js built-ins (`fs`, `path`).
- Imports must strictly follow GJS conventions:
  - GNOME GObject Introspection libraries: `import Name from 'gi://Name';`
  - GNOME Shell internal modules: `import * as Main from 'resource:///org/gnome/shell/ui/main.js';`
  - Extension classes: `import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';`

### 3. GSettings Schema Integrity
When modifying or adding settings:
1. Edit `schemas/org.gnome.shell.extensions.clock@devilbd.com.gschema.xml`.
2. Always execute `glib-compile-schemas schemas/` to update `schemas/gschemas.compiled`.
3. Update `prefs.ui` (GTK4 / Libadwaita UI components).
4. Update `prefs.js` (bind new UI object to GSettings key).
5. Update `extension.js` (read default value in `enable()` and handle key change in `this._settings.connect('changed', ...)`).

### 4. Cairo 2D Drawing State Management
- Never perform drawing operations directly without clearing the surface or restoring state.
- Always use `cr.save()` before applying transformations, clip paths, or custom blend modes, and pair it with `cr.restore()`.
- Keep mathematical computations efficient; `_drawClock` runs every second. Avoid expensive allocations inside the 1-second render loop.

### 5. Multi-Monitor Coordinate Calculation
- Never hardcode screen coordinates to `0, 0` when positioning widgets on `Main.layoutManager._backgroundGroup`.
- The background group spans the entire virtual display area across all monitors; calculate offsets starting from `monitor.x` and `monitor.y`.

---

## 3. Directory Layout Reference

```text
analogue-clock/
├── extension.js          # Core extension logic and Cairo vector drawing
├── prefs.js              # Preferences window code (Adw.PreferencesPage)
├── prefs.ui              # GTK4 Adwaita preferences UI layout
├── metadata.json         # Extension metadata, UUID, supported shell versions (45-50)
├── stylesheet.css        # Extension CSS boilerplate
├── package.sh            # Packaging automation script
├── install.sh            # Local installation script
├── schemas/              # GSettings schema XML and compiled binary
├── .agents/              # Agent rules and skills directory
│   ├── rules/            # Specialized rule definitions
│   └── skills/           # Custom agent automation skills
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
   *Expected result: Produces `clock@devilbd.com.shell-extension.zip` without warnings.*

3. **Code Syntax Verification:**
   Ensure JS files are syntactically valid ESM JavaScript.

---

## 5. Summary of Do's and Don'ts

| Do | Don't |
| :--- | :--- |
| Use `gi://` imports for GObject libraries | Use Node.js `require()` or npm packages |
| Clean up all timers and signals in `disable()` | Leave dangling timers or layout manager listeners |
| Call `glib-compile-schemas schemas/` after schema edits | Commit modified schema XML without testing compilation |
| Position relative to `monitor.x` and `monitor.y` | Assume the primary monitor begins at `(0, 0)` |
| Use `cr.save()` / `cr.restore()` around Cairo clips | Leave Cairo clipping regions active across drawing passes |
