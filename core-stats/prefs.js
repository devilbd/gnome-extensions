import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class CoreStatsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ title: 'General Settings' });
        page.add(group);

        // Refresh Interval
        const refreshRow = new Adw.ActionRow({ title: 'Refresh Interval (seconds)' });
        const refreshSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 60, step_increment: 1 }),
            valign: Gtk.Align.CENTER
        });
        settings.bind('refresh-interval', refreshSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        refreshRow.add_suffix(refreshSpin);
        group.add(refreshRow);

        // Visibility Group
        const visibilityGroup = new Adw.PreferencesGroup({ title: 'Panel Visibility' });
        page.add(visibilityGroup);

        // CPU Settings
        const cpuTempRow = new Adw.SwitchRow({ title: 'Show CPU Temperature' });
        settings.bind('show-cpu-temp', cpuTempRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        visibilityGroup.add(cpuTempRow);

        const cpuUsageRow = new Adw.SwitchRow({ title: 'Show CPU Usage' });
        settings.bind('show-cpu-usage', cpuUsageRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        visibilityGroup.add(cpuUsageRow);

        // GPU Settings
        const gpuTempRow = new Adw.SwitchRow({ title: 'Show GPU Temperature' });
        settings.bind('show-gpu-temp', gpuTempRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        visibilityGroup.add(gpuTempRow);

        const gpuUsageRow = new Adw.SwitchRow({ title: 'Show GPU Usage' });
        settings.bind('show-gpu-usage', gpuUsageRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        visibilityGroup.add(gpuUsageRow);

        // NVMe Settings
        const nvmeTempRow = new Adw.SwitchRow({ title: 'Show NVMe Temperature' });
        settings.bind('show-nvme-temp', nvmeTempRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        visibilityGroup.add(nvmeTempRow);

        const nvmeUsageRow = new Adw.SwitchRow({ title: 'Show NVMe Usage' });
        settings.bind('show-nvme-usage', nvmeUsageRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        visibilityGroup.add(nvmeUsageRow);

        // RAM Settings
        const ramTempRow = new Adw.SwitchRow({ title: 'Show RAM Temperature' });
        settings.bind('show-ram-temp', ramTempRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        visibilityGroup.add(ramTempRow);

        const ramUsageRow = new Adw.SwitchRow({ title: 'Show RAM Usage' });
        settings.bind('show-ram-usage', ramUsageRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        visibilityGroup.add(ramUsageRow);

        // Network Settings
        const networkUsageRow = new Adw.SwitchRow({ title: 'Show Network Speed' });
        settings.bind('show-network-usage', networkUsageRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        visibilityGroup.add(networkUsageRow);

        // Drive Settings
        const driveUsageRow = new Adw.SwitchRow({ title: 'Show Drive Fulfillment' });
        settings.bind('show-drive-usage', driveUsageRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        visibilityGroup.add(driveUsageRow);

        // Thresholds Group
        const thresholdGroup = new Adw.PreferencesGroup({ title: 'Thresholds' });
        page.add(thresholdGroup);

        const warnRow = new Adw.ActionRow({ title: 'Warning Threshold (°C)' });
        const warnSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 40, upper: 100, step_increment: 1 }),
            valign: Gtk.Align.CENTER
        });
        settings.bind('warning-threshold', warnSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        warnRow.add_suffix(warnSpin);
        thresholdGroup.add(warnRow);

        const critRow = new Adw.ActionRow({ title: 'Critical Threshold (°C)' });
        const critSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 40, upper: 110, step_increment: 1 }),
            valign: Gtk.Align.CENTER
        });
        settings.bind('critical-threshold', critSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        critRow.add_suffix(critSpin);
        thresholdGroup.add(critRow);

        // Position Group
        const positionGroup = new Adw.PreferencesGroup({ title: 'Widget Position' });
        page.add(positionGroup);

        const xRow = new Adw.ActionRow({ title: 'X Coordinate' });
        const xSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 5000, step_increment: 10 }),
            valign: Gtk.Align.CENTER
        });
        settings.bind('widget-x', xSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        xRow.add_suffix(xSpin);
        positionGroup.add(xRow);

        const yRow = new Adw.ActionRow({ title: 'Y Coordinate' });
        const ySpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 5000, step_increment: 10 }),
            valign: Gtk.Align.CENTER
        });
        settings.bind('widget-y', ySpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        yRow.add_suffix(ySpin);
        positionGroup.add(yRow);


        const orientationRow = new Adw.ComboRow({
            title: 'Widget Orientation',
            model: new Gtk.StringList({
                strings: ['Vertical', 'Horizontal']
            })
        });
        settings.bind('widget-orientation', orientationRow, 'selected', Gio.SettingsBindFlags.DEFAULT);
        positionGroup.add(orientationRow);

        const maxWidthRow = new Adw.ActionRow({ title: 'Widget Size X (0 for automatic)' });
        const maxWidthSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 2000, step_increment: 10 }),
            valign: Gtk.Align.CENTER
        });
        settings.bind('widget-max-width', maxWidthSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        maxWidthRow.add_suffix(maxWidthSpin);
        positionGroup.add(maxWidthRow);

        const maxHeightRow = new Adw.ActionRow({ title: 'Widget Size Y (0 for automatic)' });
        const maxHeightSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 2000, step_increment: 10 }),
            valign: Gtk.Align.CENTER
        });
        settings.bind('widget-max-height', maxHeightSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        maxHeightRow.add_suffix(maxHeightSpin);
        positionGroup.add(maxHeightRow);
        

        window.add(page);
    }
}
