# Gemini Developer Context - Simple Clock (Analogue Clock)

> **Extension UUID:** `clock@devilbd.com`  
> **Repository:** [devilbd/gnome-extensions](https://github.com/devilbd/gnome-extensions/tree/main/analogue-clock)  
> **Supported GNOME Versions:** 45, 46, 47, 48, 49, 50  

This repository contains the **Simple Clock** (Analogue Clock) GNOME Shell extension. It renders an elegant, vector-drawn analog desktop clock on the GNOME Shell background layer with customizable sizing, multi-monitor display selection, corner position snapping, toggleable dial numbers, and non-intrusive click-through behavior.

---

## 1. Technology Stack & Runtime

- **Runtime:** GNOME Shell (45 through 50) via [GJS (GNOME JavaScript / SpiderMonkey)](https://gjs.guide/).
- **Module System:** Strict ECMAScript Modules (ESM). Node.js APIs (`require`, `npm`, `process`) are **not** available.
- **Introspection Libraries:**
  - `gi://St` – Shell Toolkit actors and styling (`St.DrawingArea` with `reactive: false`).
  - `gi://Clutter` – Scene graph and actor positioning.
  - `gi://GLib` – Main loop timers (`timeout_add_seconds`, `source_remove`) and file I/O.
  - `gi://Gio` – Settings (`Gio.Settings`), file abstractions, and application helpers.
  - `gi://cairo` – Pure 2D vector drawing for clock face, gradients, hands, and specular highlights.
  - `gi://Pango` & `gi://PangoCairo` – Typography and text rendering for dial numerals (`Lexend Bold`).
  - `gi://Gtk` (GTK 4), `gi://Gdk` (GDK 4) & `gi://Adw` (Libadwaita 1) – Used in the preferences window (`prefs.js` / `prefs.ui`).
- **GNOME Shell Resources:**
  - `resource:///org/gnome/shell/extensions/extension.js` – Base `Extension` class.
  - `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js` – Base `ExtensionPreferences` class.
  - `resource:///org/gnome/shell/ui/main.js` – Access to `Main.layoutManager._backgroundGroup`, `primaryMonitor`, and `monitors`.

---

## 2. Codebase Architecture & File Structure

```text
analogue-clock/
├── extension.js          # Core extension lifecycle (enable/disable), Cairo rendering, monitor layout
├── prefs.js              # Preferences window controller (ExtensionPreferences, GSettings bindings)
├── prefs.ui              # GTK4 / Libadwaita declarative UI definition for settings
├── metadata.json         # Extension manifest (UUID, version, shell-version compatibility: 45-50)
├── stylesheet.css        # Boilerplate stylesheet (required by GNOME extensions)
├── package.sh            # Script to compile schemas and produce distribution zip
├── install.sh            # Script to install locally into ~/.local/share/gnome-shell/extensions/
├── schemas/              # GSettings schema XML and compiled gschemas.compiled
│   └── org.gnome.shell.extensions.clock@devilbd.com.gschema.xml
├── .agents/              # Agent rules, workflows, and task-specific skills
│   ├── rules/            # Architectural rules (gnome-shell, cairo-graphics)
│   └── skills/           # Reusable skills (package-and-install)
├── AGENTS.md             # Universal agent standards and operational guidelines
├── GEMINI.md             # This file (Gemini/Antigravity pair programming instructions)
└── README.md             # User-facing and developer documentation
```

### Key Components

1. **[`extension.js`](file:///run/media/devilbd/d/Development/gnome-extensions/analogue-clock/extension.js):**
   - Inherits from `Extension`.
   - `enable()`: Reads GSettings, creates `St.DrawingArea` (`reactive: false` so desktop clicks pass through), connects settings listeners, connects `Main.layoutManager` `monitors-changed` signal, adds widget to `Main.layoutManager._backgroundGroup`, and starts the 1-second repaint timer.
   - `disable()`: Cleans up **all** timers, settings signal handlers, layout manager listeners, and destroys the `St.DrawingArea` actor.
   - `_getTargetMonitor()`: Returns the selected monitor based on `monitor-index` (0: Primary, 1+: specific index in `Main.layoutManager.monitors`).
   - `_updatePosition()`: Snaps the widget to Top Left (0), Top Right (1), Bottom Left (2), or Bottom Right (3) offset relative to `targetMonitor.x` and `targetMonitor.y`.
   - `_drawClock(area)`: Uses Cairo context to clear, paint dark metallic beveled rim, deep dark glass face, specular gradient shines, tick marks, Pango numeral layouts, beveled hour/minute hands, neon-red second hand, and a crystal sapphire jewel center.

2. **[`prefs.js`](file:///run/media/devilbd/d/Development/gnome-extensions/analogue-clock/prefs.js) & [`prefs.ui`](file:///run/media/devilbd/d/Development/gnome-extensions/analogue-clock/prefs.ui):**
   - Uses `Gtk.Builder` to load `AdwPreferencesPage` (`ClockPrefsWidget`) from `prefs.ui`.
   - Dynamically discovers connected displays via `Gdk.Display.get_default().get_monitors()` and populates the `monitor_combo`.
   - Binds UI controls directly to GSettings (`monitor-index`, `widget-position`, `clock-size`, `show-numbers`).

3. **[`schemas/org.gnome.shell.extensions.clock@devilbd.com.gschema.xml`](file:///run/media/devilbd/d/Development/gnome-extensions/analogue-clock/schemas/org.gnome.shell.extensions.clock@devilbd.com.gschema.xml):**
   - Defines configuration keys: `monitor-index`, `widget-position`, `clock-size`, `show-numbers`.

---

## 3. Development Commands & Workflows

### Validating Schemas
Always compile schemas after editing the XML:
```bash
glib-compile-schemas --strict schemas/
```

### Packaging
To build the distribution ZIP archive:
```bash
./package.sh
```

### Installing Locally
To install the extension directly to `~/.local/share/gnome-shell/extensions/clock@devilbd.com` and enable it:
```bash
./install.sh
```

### Inspecting Logs & Debugging
- **Stream logs:**
  ```bash
  journalctl -f -o cat /usr/bin/gnome-shell | grep -E "ClockExtension|clock@devilbd.com"
  ```
- **Error log file:**
  Errors caught during `enable()` are written to `error.log` in the extension directory.
- **Looking Glass (GNOME Interactive Debugger):**
  Press `Alt+F2`, type `lg`, and press `Enter`. Use the **Extensions** tab to check state and the **Evaluator** to test GJS expressions.

---

## 4. Coding Conventions & Best Practices

1. **Strict Lifecycle Isolation (No Leaks):**
   - Every GObject signal connected with `.connect()` **must** be stored (`this._settingsId`, `this._monitorsChangedId`, `this._repaintId`) and disconnected in `disable()`.
   - Any timer initialized with `GLib.timeout_add_seconds()` **must** be cleared in `disable()` using `GLib.source_remove()`.
   - Actors added to `Main.layoutManager._backgroundGroup` must be explicitly removed with `parent.remove_child(...)` and `.destroy()`.

2. **GJS / ESM Imports:**
   - Use standard ESM imports:
     ```javascript
     import St from 'gi://St';
     import GLib from 'gi://GLib';
     import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
     ```
   - Do not use CommonJS (`require()`, `module.exports`).

3. **Multi-Monitor Geometry:**
   - Always calculate positions offset from `monitor.x` and `monitor.y` since GNOME's background group covers the entire virtual desktop canvas spanning all displays.
