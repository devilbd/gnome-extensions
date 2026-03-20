import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
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

        // Bind settings to UI
        const showNumbersSwitch = builder.get_object('show_numbers_switch');
        if (showNumbersSwitch) {
            settings.bind('show-numbers', showNumbersSwitch, 'active', 0);
        }

        const sizeSpinButton = builder.get_object('size_spin_button');
        if (sizeSpinButton) {
            settings.bind('clock-size', sizeSpinButton, 'value', 0);
        }

        const blurSwitch = builder.get_object('blur_switch');
        if (blurSwitch) {
            settings.bind('enable-blur', blurSwitch, 'active', 0);
        }
    }
}
