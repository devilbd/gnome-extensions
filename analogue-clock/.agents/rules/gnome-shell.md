# GNOME Shell Extension Rules

These rules apply to all code modifications within GNOME Shell extension files (`extension.js`, `prefs.js`, `prefs.ui`).

## 1. Module Imports & Runtime

- Target runtime is GNOME Shell 45 through 50 on GJS (SpiderMonkey ESM).
- Only import from `gi://` (GObject Introspection) or `resource:///` (GNOME Shell internal resources).
- Never use CommonJS (`require`), Node.js modules (`fs`, `path`, `process`), or browser-specific globals (`window`, `document`).

## 2. Strict Lifecycle Management

- Any actor attached in `enable()` (e.g., to `Main.layoutManager._backgroundGroup`) must be removed and destroyed in `disable()`:
  ```javascript
  let parent = this._clockWidget.get_parent();
  if (parent) parent.remove_child(this._clockWidget);
  this._clockWidget.destroy();
  this._clockWidget = null;
  ```
- Any GLib source/timeout added must be removed in `disable()`:
  ```javascript
  if (this._timeout) {
      GLib.source_remove(this._timeout);
      this._timeout = null;
  }
  ```
- Every signal connection (`.connect(...)`) must store its connection ID and be disconnected in `disable()` (`.disconnect(id)`).
- Always disconnect signals attached to `Main.layoutManager` (such as `monitors-changed`) in `disable()`.

## 3. Preferences & GTK 4 / Libadwaita

- Preferences must use modern `ExtensionPreferences` from `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js`.
- Use `Gtk.Builder` to instantiate `Adw.PreferencesPage` or `Adw.PreferencesGroup` defined in `prefs.ui`.
- Bind GSettings to GTK widgets using `settings.bind('key', widget, 'property', Gio.SettingsBindFlags.DEFAULT)`.
- Enumerate connected displays dynamically using `Gdk.Display.get_default().get_monitors()`.

## 4. Multi-Monitor Coordinate Calculations

- When placing actors in `Main.layoutManager._backgroundGroup`, always offset coordinates by `monitor.x` and `monitor.y`.
