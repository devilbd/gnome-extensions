---
name: package-and-install
description: >-
  Use this skill to compile GSettings schemas, package the core-stats GNOME Shell extension into a ZIP file, or install and enable it locally.
---

# Package and Install Skill

This skill provides step-by-step procedures to validate, package, and locally install the `core-stats@devilbd.com` GNOME Shell extension.

## 1. Prerequisites

Verify that the required tools are installed on the system:
```bash
which glib-compile-schemas
which gnome-extensions
```

## 2. Step 1: Validate and Compile Schemas

Run the strict GLib schema compiler to verify that XML schemas contain no syntax or type errors:
```bash
glib-compile-schemas --strict schemas/
```

- **Verification:** Ensure the command exits with code 0 and updates `schemas/gschemas.compiled`.

## 3. Step 2: Package the Extension

Run the packaging script to generate the distribution zip archive:
```bash
./package.sh
```

- **Output:** Produces `core-stats@devilbd.com.shell-extension.zip`.
- **Underlying Command:**
  ```bash
  gnome-extensions pack --force --out-dir="."
  ```

## 4. Step 3: Install and Enable Locally

To test changes on the local desktop, run the install script:
```bash
./install.sh
```

The script performs the following actions:
1. Cleans and recreates `~/.local/share/gnome-shell/extensions/core-stats@devilbd.com`.
2. Copies `extension.js`, `metadata.json`, `stylesheet.css`, `prefs.js`, `icons/`, and `schemas/`.
3. Compiles the installed schemas.
4. Enables the extension via `gnome-extensions enable core-stats@devilbd.com`.

## 5. Step 4: Reload GNOME Shell for Testing

- **Wayland (Fedora / Ubuntu Default):**
  Extensions cannot be hot-reloaded with `Alt+F2` + `r`. You must log out and log back in, or test inside a nested Wayland session:
  ```bash
  dbus-run-session -- gnome-shell --nested --wayland
  ```
- **X11:**
  Press `Alt+F2`, enter `r`, and press `Enter`.

## 6. Troubleshooting and Log Inspection

To view live extension output:
```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -E "CoreStats|core-stats@devilbd.com"
```
