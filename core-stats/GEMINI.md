# Gemini Developer Context - CORE STATS

> **Extension UUID:** `core-stats@devilbd.com`  
> **Repository:** [devilbd/gnome-extensions](https://github.com/devilbd/gnome-extensions/tree/main/core-stats)  
> **Supported GNOME Versions:** 45, 46, 47, 48, 49, 50  

This repository contains the **CORE STATS** GNOME Shell desktop extension. It provides a real-time, glassmorphic desktop hardware HUD that displays temperatures and utilization percentages for CPU, GPU, NVMe, RAM, network bandwidth, and mounted storage drives directly on the GNOME Shell background layer.

---

## 1. Technology Stack & Runtime

- **Runtime:** GNOME Shell (45 through 50) via [GJS (GNOME JavaScript / SpiderMonkey)](https://gjs.guide/).
- **Module System:** Strict ECMAScript Modules (ESM). Node.js APIs (`require`, `npm`, `process`) are **not** available.
- **Introspection Libraries:**
  - `gi://St` – Shell Toolkit UI actors (`St.BoxLayout`, `St.Bin`, `St.Label`, `St.Icon`).
  - `gi://Clutter` – Scene graph actors, alignment (`Clutter.ActorAlign`), and positioning.
  - `gi://GLib` – Main loop timeouts (`timeout_add`, `timeout_add_seconds`, `source_remove`), file tests (`GLib.file_test`), and string formatting (`GLib.format_size`).
  - `gi://Gio` – Settings (`Gio.Settings`), asynchronous file I/O (`Gio.File.load_contents_async`), and query attributes (`query_filesystem_info_async`).
  - `gi://Pango` – Text formatting and ellipsize modes.
  - `gi://Gtk` (GTK 4) & `gi://Adw` (Libadwaita 1) – Used in the preferences window (`prefs.js`).
- **GNOME Shell Resources:**
  - `resource:///org/gnome/shell/extensions/extension.js` – Base `Extension` class.
  - `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js` – Base `ExtensionPreferences` class.
  - `resource:///org/gnome/shell/ui/main.js` – Access to `Main.layoutManager._backgroundGroup`, `Main.uiGroup`, and layout managers.

---

## 2. Codebase Architecture & File Structure

```text
core-stats/
├── extension.js          # Core extension lifecycle, sensor polling, async I/O, UI construction
├── prefs.js              # Preferences window controller (ExtensionPreferences, Libadwaita rows)
├── metadata.json         # Extension manifest (UUID, version, shell-version compatibility: 45-50)
├── stylesheet.css        # Glassmorphic HUD styles, progress bar styling, thermal status alerts
├── package.sh            # Script to compile schemas and produce distribution zip
├── install.sh            # Script to install locally into ~/.local/share/gnome-shell/extensions/
├── icons/                # Extension icon assets
│   └── cpu-chip-symbolic.svg
├── schemas/              # GSettings schema XML and compiled gschemas.compiled
│   └── org.gnome.shell.extensions.core-stats@devilbd.com.gschema.xml
├── .agents/              # Agent rules, workflows, and task-specific skills
│   ├── rules/            # Architectural rules (gnome-shell, system-monitoring)
│   └── skills/           # Reusable skills (package-and-install)
├── AGENTS.md             # Universal agent standards and operational guidelines
├── GEMINI.md             # This file (Gemini/Antigravity developer context)
└── README.md             # User-facing and developer documentation
```

### Key Components

1. **[`extension.js`](file:///run/media/devilbd/d/Development/gnome-extensions/core-stats/extension.js):**
   - Inherits from `Extension`.
   - `enable()`: Loads GSettings, initializes layout container, binds settings change listeners, launches asynchronous initialization timeout (`_initAsync`), builds UI rows, and starts periodic polling timer.
   - `disable()`: Cancels timers (`_initTimeoutId`, `_updateId`), disconnects settings signal (`_settingsId`), removes and destroys `this._container` from `Main.layoutManager._backgroundGroup`, and cleans up all state references.
   - `_initSensors()`: Iterates through `/sys/class/hwmon/hwmon*` discovering drivers for CPU (`k10temp`, `coretemp`), GPU (`amdgpu`, `radeon`, `nouveau`, `nvidia`), and NVMe drives. Sets up network throughput tracking.
   - `_initDrives()`: Parses `/proc/mounts` for real filesystem mounts (`/dev/*`) ignoring pseudofs/tmpfs.
   - `_updateStats()`: Asynchronously reads temperature (`temp1_input`) and utilization metrics (`/proc/stat` for CPU, `gpu_busy_percent` for GPU, `/proc/meminfo` for RAM, `/proc/net/dev` for network, `query_filesystem_info_async` for drives).
   - `_buildUi()`: Constructs `St.BoxLayout` container and child rows, applies orientation (vertical or horizontal), dimensions, icons, progress bars (`St.Bin`), and adds to `Main.layoutManager._backgroundGroup`.
   - `_updateDisplay()`: Updates text labels, applies warning/critical CSS classes (`status-warning`, `status-critical`), and recalculates bar fill widths.
   - `_readFile(path)`: Robust asynchronous Promise wrapper around `Gio.File.load_contents_async` that prevents main-loop freezes.

2. **[`prefs.js`](file:///run/media/devilbd/d/Development/gnome-extensions/core-stats/prefs.js):**
   - Inherits from `ExtensionPreferences`.
   - Programmatically builds `Adw.PreferencesPage` with groups for **General Settings** (refresh interval), **Panel Visibility** (toggle CPU, GPU, NVMe, RAM, Network, and Drive visibility), **Thresholds** (Warning and Critical °C), and **Widget Position** (X/Y coordinates, orientation, max width/height).
   - Binds UI controls directly to GSettings keys via `settings.bind()`.

3. **[`schemas/org.gnome.shell.extensions.core-stats@devilbd.com.gschema.xml`](file:///run/media/devilbd/d/Development/gnome-extensions/core-stats/schemas/org.gnome.shell.extensions.core-stats@devilbd.com.gschema.xml):**
   - Defines configuration keys: `refresh-interval`, `show-*-temp`, `show-*-usage`, `warning-threshold`, `critical-threshold`, `widget-x`, `widget-y`, `widget-orientation`, `widget-max-width`, `widget-max-height`.

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
To install the extension directly to `~/.local/share/gnome-shell/extensions/core-stats@devilbd.com` and enable it:
```bash
./install.sh
```

### Inspecting Logs & Debugging
- **Stream logs:**
  ```bash
  journalctl -f -o cat /usr/bin/gnome-shell | grep -E "CoreStats|core-stats@devilbd.com"
  ```
- **Looking Glass (GNOME Interactive Debugger):**
  Press `Alt+F2`, type `lg`, and press `Enter`. Use the **Extensions** tab to check state and the **Evaluator** to test GJS expressions.

---

## 4. Coding Conventions & Best Practices

1. **Non-Blocking Asynchronous Operations:**
   - Reading kernel sysfs and procfs entries must never block the compositor. Always use `load_contents_async` wrapped in Promises rather than synchronous file APIs.
   - Use `GLib.file_test` to verify node existence before attempting asynchronous reads.

2. **Strict Lifecycle Isolation (No Leaks):**
   - Every GObject signal connected with `.connect()` **must** be stored (`this._settingsId`) and disconnected in `disable()`.
   - Any timer initialized with `GLib.timeout_add` or `GLib.timeout_add_seconds` **must** be cleared in `disable()` using `GLib.source_remove()`.
   - The UI container added to `Main.layoutManager._backgroundGroup` must be removed from its parent and destroyed with `.destroy()`.

3. **Multi-Component Error Resilience:**
   - Never assume all hardware sensor nodes exist. Check return values, catch Promise rejections, and verify parsed numbers with `isNaN()` before updating UI actors.
