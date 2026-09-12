# CORE STATS (core-stats@devilbd.com)

An elegant, real-time desktop hardware monitoring widget for GNOME Shell, built with GJS, Clutter, St, and Libadwaita.

<p align="center">
  <img width="335" height="1069" alt="Core Stats Preview" src="https://github.com/user-attachments/assets/a3258938-7abe-4828-89d3-8a1d66b2bdc0" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/GNOME%20Shell-45%20|%2046%20|%2047%20|%2048%20|%2049%20|%2050-blue?logo=gnome" alt="GNOME Shell 45-50" />
  <img src="https://img.shields.io/badge/Language-JavaScript%20(GJS)-yellow?logo=javascript" alt="JavaScript GJS" />
  <img src="https://img.shields.io/badge/UI-Libadwaita%20%2F%20GTK4-purple" alt="Libadwaita GTK4" />
  <img src="https://img.shields.io/badge/Scene%20Graph-Clutter%20%2F%20St-teal" alt="Clutter St" />
</p>

---

## Features

- **Automatic Hardware Sensor Discovery:** Dynamically detects Linux `hwmon` devices (`/sys/class/hwmon/`) for CPU (`k10temp`, `coretemp`), GPU (`amdgpu`, `radeon`, `nouveau`, `nvidia`), and NVMe storage devices.
- **Comprehensive Component Monitoring:**
  - **CPU:** Real-time multi-core utilization calculation (`/proc/stat`) and package temperatures.
  - **GPU:** Dynamic GPU core temperature and graphics engine activity (`gpu_busy_percent`).
  - **NVMe:** Solid-state drive temperatures and disk I/O activity via kernel block stats.
  - **Memory (RAM):** Active memory utilization from `/proc/meminfo` and optional SPD module thermal sensors (`spd5118`, `jc42`).
  - **Network:** Live upload and download throughput in MB/s (`/proc/net/dev`) with adaptive visual activity bars.
  - **Storage Volumes:** Mounted disk capacity fulfillment and free disk space calculated asynchronously via `Gio.File.query_filesystem_info_async`.
- **Glassmorphic Desktop Widget:** Renders onto `Main.layoutManager._backgroundGroup` directly above the wallpaper, remaining visible on the desktop without occluding or interfering with application windows.
- **Dual Layout Orientation & Integrated Scrolling:** Toggle between a vertical sidebar/tower HUD and a horizontal status bar, featuring smooth `St.ScrollView` scrollbars that appear automatically only when content exceeds the configured dimensions (Height for vertical, Width for horizontal).
- **Dynamic Thermal Warning Levels:** Customizable Warning (`80°C`) and Critical (`95°C`) thresholds that trigger visual glow and color alerts (`status-warning`, `status-critical`).
- **Native Libadwaita Preferences:** Built with GTK 4 and Libadwaita (`AdwPreferencesPage`), allowing configuration of Width and Height (with `0` for auto-fit), alongside polling frequency, sensor visibility, and thermal threshold controls.

---

## Compatibility

| Component | Requirement |
| :--- | :--- |
| **Desktop Environment** | GNOME Shell 45, 46, 47, 48, 49, 50 |
| **Display Server** | Wayland and X11 |
| **OS / Kernel** | Linux with `hwmon` driver support (`/sys/class/hwmon`) |
| **Tooling Dependencies** | `glib2` (`glib-compile-schemas`), `gnome-extensions-tool` |

---

## Quick Installation

### Option 1: Automated Script (Recommended)

Run the included installation script to install directly to your local GNOME Shell extensions directory and compile schemas:

```bash
chmod +x install.sh package.sh
./install.sh
```

### Option 2: Manual Package Installation

1. Package the extension archive:
   ```bash
   ./package.sh
   ```
2. Install the generated ZIP archive:
   ```bash
   gnome-extensions install --force core-stats@devilbd.com.shell-extension.zip
   ```
3. Enable the extension:
   ```bash
   gnome-extensions enable core-stats@devilbd.com
   ```

### Restarting the GNOME Shell
- **Wayland (Default on modern Fedora / Ubuntu):** Log out and log back in, or test inside a nested Wayland session:
  ```bash
  dbus-run-session -- gnome-shell --nested --wayland
  ```
- **X11:** Press `Alt+F2`, enter `r`, and press `Enter`.

---

## Preferences & Configuration

Open the extension preferences through the **Extensions** app or via terminal:

```bash
gnome-extensions prefs core-stats@devilbd.com
```

### Available Settings

| Setting Key | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `refresh-interval` | Integer | `2` | Update frequency in seconds (1 to 60s) |
| `show-cpu-temp` / `show-cpu-usage` | Boolean | `true` | Display CPU temperature and utilization |
| `show-gpu-temp` / `show-gpu-usage` | Boolean | `true` | Display GPU temperature and utilization |
| `show-nvme-temp` / `show-nvme-usage` | Boolean | `true` | Display NVMe temperature and disk activity |
| `show-ram-temp` / `show-ram-usage` | Boolean | `true` | Display RAM temperature and memory usage |
| `show-network-usage` | Boolean | `true` | Display network download and upload speeds |
| `show-drive-usage` | Boolean | `true` | Display filesystem storage usage and free space |
| `show-motherboard-section` | Boolean | `true` | Display Motherboard, VRM, and Chipset telemetry |
| `warning-threshold` | Integer | `80` | Warning temperature in °C |
| `critical-threshold` | Integer | `95` | Critical temperature in °C |
| `widget-monitor` | Integer | `0` | Monitor selection (`0`: Primary, `1`: Monitor 1, `2`: Monitor 2, ...) |
| `widget-x` / `widget-y` | Integer | `20`, `100` | X and Y pixel offsets relative to selected monitor |
| `widget-orientation` | Integer | `0` | Orientation (`0`: Vertical, `1`: Horizontal) |
| `widget-width` | Integer | `280` | Widget width in pixels (`0` for auto/fit) |
| `widget-height` | Integer | `0` | Widget height in pixels (`0` for auto/fit) |

---

## Motherboard Sensors Setup (Nuvoton / ASUS Super I/O)

Motherboard ambient, VRM, CPU socket, and chassis fan sensors are provided by onboard Super I/O chips (such as Nuvoton NCT6796D / NCT6799D found on ASUS AM5 B650/B850, PRIME, TUF, and ROG motherboards).

On many Linux distributions, the Super I/O driver (`nct6775`) is not loaded by default. To activate motherboard sensors:

1. **Test loading the module immediately:**
   ```bash
   sudo modprobe nct6775
   ```

2. **Enable automatic loading at boot:**
   ```bash
   echo "nct6775" | sudo tee /etc/modules-load.d/nct6775.conf
   ```

Once loaded, `/sys/class/hwmon` registers the device (e.g. `nct6799`), and CORE STATS will automatically detect and display Motherboard Ambient (`SYSTIN`), VRM (`AUXTIN0`), and CPU Socket (`CPUTIN`) telemetry in the HUD.

---

## Directory Layout

```text
core-stats/
├── extension.js          # Main extension lifecycle, hwmon sensor discovery, and UI layout
├── prefs.js              # GTK4 / Libadwaita Preferences dialog controller
├── metadata.json         # Extension manifest and GNOME Shell version compatibility
├── stylesheet.css        # Glassmorphic HUD styles, progress bar colors, and thermal alerts
├── package.sh            # Packaging automation script
├── install.sh            # Local installation script
├── icons/                # Extension icon assets (cpu-chip-symbolic.svg)
├── schemas/              # GSettings XML schema and compiled binary
│   └── org.gnome.shell.extensions.core-stats@devilbd.com.gschema.xml
├── .agents/              # AI pair-programming rules and task skills
│   ├── rules/            # Architectural rules (gnome-shell, system-monitoring)
│   └── skills/           # Packaging and installation skills
├── AGENTS.md             # Autonomous agent guidelines and operational constraints
├── GEMINI.md             # Developer context and system architecture reference
└── README.md             # Extension documentation and user guide
```

---

## Development & Schema Compilation

Whenever modifying settings in `schemas/org.gnome.shell.extensions.core-stats@devilbd.com.gschema.xml`:

```bash
glib-compile-schemas --strict schemas/
```

To stream live extension logs:

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -E "CoreStats|core-stats@devilbd.com"
```
