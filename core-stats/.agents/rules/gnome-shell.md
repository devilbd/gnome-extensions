# GNOME Shell Extension Rules for CORE STATS

These rules apply to all code modifications within GNOME Shell extension files (`extension.js`, `prefs.js`).

## 1. Module Imports & Runtime

- Target runtime is GNOME Shell 45 through 50 on GJS (SpiderMonkey ESM).
- Only import from `gi://` (GObject Introspection) or `resource:///` (GNOME Shell internal resources).
- Never use CommonJS (`require`), Node.js modules (`fs`, `path`, `process`), or browser-specific globals (`window`, `document`).

## 2. Strict Lifecycle Management

- Any actor attached in `enable()` (e.g., to `Main.layoutManager._backgroundGroup`) must be removed and destroyed in `disable()`:
  ```javascript
  let parent = this._container?.get_parent();
  if (parent) parent.remove_child(this._container);
  this._container?.destroy();
  this._container = null;
  ```
- Any `GLib.timeout_add` or `GLib.timeout_add_seconds` source must be tracked and removed in `disable()`:
  ```javascript
  if (this._updateId) {
      GLib.source_remove(this._updateId);
      this._updateId = null;
  }
  ```
- Disconnect all GSettings signal handlers:
  ```javascript
  if (this._settingsId) {
      this._settings.disconnect(this._settingsId);
      this._settingsId = null;
  }
  ```

## 3. Asynchronous Operations

- Use `load_contents_async` via `Gio.File` for file reading to avoid freezing the Shell during hardware stat updates.
- Keep tick intervals reasonable (`refresh-interval` >= 1 second).

## 4. Multi-Display & Layout Safety

- Do not assume fixed display resolutions or monitor layouts.
- Keep widget positioning configurable and within monitor bounds.
