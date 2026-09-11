# Analogue Clock (Simple Clock)

An elegant, vector-rendered desktop analog clock widget for GNOME Shell, built with GJS, Cairo, Clutter, and Libadwaita.

<p align="center">
  <img width="378" height="347" alt="Analogue Clock Preview" src="https://github.com/user-attachments/assets/a328618a-b7fb-4019-8a83-e43037fe61f7" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/GNOME%20Shell-45%20|%2046%20|%2047%20|%2048%20|%2049%20|%2050-blue?logo=gnome" alt="GNOME Shell 45-50" />
  <img src="https://img.shields.io/badge/Language-JavaScript%20(GJS)-yellow?logo=javascript" alt="JavaScript GJS" />
  <img src="https://img.shields.io/badge/Graphics-Cairo%202D-orange" alt="Cairo 2D" />
  <img src="https://img.shields.io/badge/UI-Libadwaita%20%2F%20GTK4-purple" alt="Libadwaita GTK4" />
</p>

---

## Features

- **2D Vector Rendered:** Sharp, resolution-independent clock face drawn with Cairo and PangoCairo.
- **Glass & Metallic Aesthetics:** Beveled metallic rim, rich dark radial glass dial, specular reflection highlights, and an ultra-shiny sapphire crystal center jewel.
- **Glowing Neon Accents:** Distinctive neon-red second hand and illuminated hour/minute markers.
- **Multi-Monitor Screen Selection:** Choose which display renders the clock (Primary Monitor, Display 1, Display 2, etc.) with automatic display hotplug repositioning.
- **Non-Intrusive Click-Through:** Mouse clicks pass directly through to desktop icons and wallpapers without accidental clicks or interference.
- **Corner Snapping:** Snaps cleanly to any screen corner (Top-Left, Top-Right, Bottom-Left, Bottom-Right).
- **Customizable Size:** Dynamically adjust the clock diameter from 100px up to 600px.
- **Toggleable Numerals:** Choose between a minimalist dial or highlighted quadrant numbers (12, 3, 6, 9) rendered in *Lexend Bold*.
- **Streamlined Preferences UI:** Built with modern GTK 4 and Libadwaita (`AdwPreferencesPage`), cleanly organized into **Placement** and **Appearance**.

---

## Compatibility

| Component | Requirement |
| :--- | :--- |
| **Desktop Environment** | GNOME Shell 45, 46, 47, 48, 49, 50 |
| **Display Server** | Wayland and X11 |
| **Tooling Dependencies** | `glib2` (`glib-compile-schemas`), `gnome-extensions-tool` |

---

## Quick Installation

### Option 1: Automated Script (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/devilbd/gnome-extensions.git
   cd gnome-extensions/analogue-clock
   ```

2. Run the install script:
   ```bash
   ./install.sh
   ```

3. **Reload GNOME Shell:**
   - **Wayland (Default on modern Fedora / Ubuntu):** Log out and log back in to load the extension.
   - **X11:** Press `Alt+F2`, type `r`, and press `Enter`.

### Option 2: Package and Install via CLI

1. Build the distribution zip:
   ```bash
   ./package.sh
   ```

2. Install the packaged extension:
   ```bash
   gnome-extensions install --force clock@devilbd.com.shell-extension.zip
   gnome-extensions enable clock@devilbd.com
   ```

---

## Configuration & Preferences

Open preferences through the **Extensions** app (`gnome-extensions-app`) or run:

```bash
gnome-extensions prefs clock@devilbd.com
```

### Available Settings

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **Display Monitor** | Enumeration | `Primary Monitor` | Selects which display screen renders the clock. |
| **Position** | Enumeration | `Top Left` | Snaps clock to Top Left, Top Right, Bottom Left, or Bottom Right. |
| **Clock Size** | Integer | `280` | Adjusts diameter in pixels (range: 100 – 600). |
| **Show Numbers** | Boolean | `true` | Displays numerals (12, 3, 6, 9) on the clock face. |

You can also adjust these settings directly via `gsettings`:
```bash
# Example: Display on second monitor
gsettings --schemadir schemas/ set org.gnome.shell.extensions.clock@devilbd.com monitor-index 2

# Example: Move to Top Right corner
gsettings --schemadir schemas/ set org.gnome.shell.extensions.clock@devilbd.com widget-position 1

# Example: Change size to 320px
gsettings --schemadir schemas/ set org.gnome.shell.extensions.clock@devilbd.com clock-size 320
```

---

## Development & Debugging

### Inspecting Logs
View live logs filtered for the clock extension:
```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -E "ClockExtension|clock@devilbd.com"
```

### Testing in a Nested Shell
Test extension changes without restarting your active desktop session:
```bash
dbus-run-session -- gnome-shell --nested --wayland
```

### Looking Glass
Press `Alt+F2`, type `lg`, and hit `Enter` to open GNOME's interactive JavaScript debugger.

---

## File Overview

```text
analogue-clock/
├── extension.js          # Core extension lifecycle, Cairo drawing, and monitor tracking
├── prefs.js              # Preferences window controller with display discovery
├── prefs.ui              # Libadwaita / GTK4 preferences UI definition
├── metadata.json         # Extension metadata (GNOME Shell 45-50)
├── stylesheet.css        # Extension stylesheet
├── package.sh            # Packaging script
├── install.sh            # Local installation script
├── schemas/              # GSettings schema XML and compiled binary
├── .agents/              # AI pair-programming rules & task skills
├── AGENTS.md             # Autonomous agent operational guidelines
├── GEMINI.md             # Gemini & Antigravity developer context
└── README.md             # This documentation
```
