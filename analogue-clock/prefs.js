import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ClockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const builder = new Gtk.Builder();
        builder.set_translation_domain('clock@devilbd.com');
        builder.add_from_file(this.dir.get_path() + '/prefs.ui');

        const page = builder.get_object('ClockPrefsWidget');
        window.add(page);

        // Bind settings to UI
        const showNumbersSwitch = builder.get_object('show_numbers_switch');
        settings.bind('show-numbers', showNumbersSwitch, 'active', 
            Gio.SettingsBindFlags.DEFAULT);

        const sizeSpinButton = builder.get_object('size_spin_button');
        settings.bind('clock-size', sizeSpinButton, 'value', 
            Gio.SettingsBindFlags.DEFAULT);

        const blurSwitch = builder.get_object('blur_switch');
        settings.bind('enable-blur', blurSwitch, 'active', 
            Gio.SettingsBindFlags.DEFAULT);
    }
}
