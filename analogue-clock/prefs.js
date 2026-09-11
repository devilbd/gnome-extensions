import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ClockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const builder = new Gtk.Builder();
        builder.set_translation_domain('clock@devilbd.com');
        
        let uiFile = this.dir.get_child('prefs.ui');
        builder.add_from_file(uiFile.get_path());

        const page = builder.get_object('ClockPrefsWidget');
        if (page) {
            window.add(page);
        } else {
            console.error('[ClockExtension] Could not find ClockPrefsWidget in prefs.ui');
        }

        // Display monitor selection
        const monitorCombo = builder.get_object('monitor_combo');
        const monitorStringList = builder.get_object('monitor_string_list');
        if (monitorCombo && monitorStringList) {
            try {
                const display = Gdk.Display.get_default();
                if (display) {
                    const monitors = display.get_monitors();
                    const nMonitors = monitors.get_n_items();
                    for (let i = 0; i < nMonitors; i++) {
                        const mon = monitors.get_item(i);
                        const desc = mon.get_description() || mon.get_model() || `Display ${i + 1}`;
                        monitorStringList.append(`${desc} (Display ${i + 1})`);
                    }
                }
            } catch (e) {
                console.warn('[ClockExtension] Could not enumerate displays: ' + e.message);
            }

            // Ensure saved monitor index is within bounds of populated list
            const savedMonitor = settings.get_int('monitor-index');
            const totalItems = monitorStringList.get_n_items();
            if (savedMonitor >= totalItems) {
                settings.set_int('monitor-index', 0);
            }
            settings.bind('monitor-index', monitorCombo, 'selected', Gio.SettingsBindFlags.DEFAULT);
        }

        // Widget corner position
        const positionCombo = builder.get_object('position_combo');
        if (positionCombo) {
            settings.bind('widget-position', positionCombo, 'selected', Gio.SettingsBindFlags.DEFAULT);
        }

        // Clock size
        const sizeSpinButton = builder.get_object('size_spin_button');
        if (sizeSpinButton) {
            settings.bind('clock-size', sizeSpinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
        }

        // Show numbers
        const showNumbersSwitch = builder.get_object('show_numbers_switch');
        if (showNumbersSwitch) {
            settings.bind('show-numbers', showNumbersSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        }
    }
}
