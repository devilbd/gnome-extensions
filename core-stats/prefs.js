import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class CoreStatsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ title: 'General Settings' });
        page.add(group);

        // Refresh Interval
        const refreshRow = new Adw.ActionRow({ title: 'Refresh Interval (seconds)' });
        const refreshSpin = new Adw.SpinButton({
            adjustment: new Adw.Adjustment({ lower: 1, upper: 60, step_increment: 1 }),
            valign: 1 // Center
        });
        settings.bind('refresh-interval', refreshSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        refreshRow.add_suffix(refreshSpin);
        group.add(refreshRow);

        // CPU Usage Toggle
        const cpuUsageRow = new Adw.SwitchRow({ title: 'Show CPU Usage' });
        settings.bind('show-cpu-usage', cpuUsageRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(cpuUsageRow);

        // GPU Usage Toggle
        const gpuUsageRow = new Adw.SwitchRow({ title: 'Show GPU Usage' });
        settings.bind('show-gpu-usage', gpuUsageRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(gpuUsageRow);

        // Thresholds Group
        const thresholdGroup = new Adw.PreferencesGroup({ title: 'Thresholds' });
        page.add(thresholdGroup);

        const warnRow = new Adw.ActionRow({ title: 'Warning Threshold (°C)' });
        const warnSpin = new Adw.SpinButton({
            adjustment: new Adw.Adjustment({ lower: 40, upper: 100, step_increment: 1 }),
            valign: 1
        });
        settings.bind('warning-threshold', warnSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        warnRow.add_suffix(warnSpin);
        thresholdGroup.add(warnRow);

        const critRow = new Adw.ActionRow({ title: 'Critical Threshold (°C)' });
        const critSpin = new Adw.SpinButton({
            adjustment: new Adw.Adjustment({ lower: 40, upper: 110, step_increment: 1 }),
            valign: 1
        });
        settings.bind('critical-threshold', critSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        critRow.add_suffix(critSpin);
        thresholdGroup.add(critRow);

        window.add(page);
    }
}
