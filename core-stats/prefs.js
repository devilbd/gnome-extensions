import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
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

        // Position & Sizing Group
        const positionGroup = new Adw.PreferencesGroup({ title: 'Widget Position & Sizing' });
        page.add(positionGroup);

        // Display Monitor
        const monitorStrings = ['Primary Monitor'];
        try {
            const display = Gdk.Display.get_default();
            if (display) {
                const monitors = display.get_monitors();
                const count = monitors ? monitors.get_n_items() : 0;
                for (let i = 0; i < count; i++) {
                    const monitor = monitors.get_item(i);
                    let desc = '';
                    if (monitor) {
                        if (typeof monitor.get_description === 'function') {
                            desc = monitor.get_description() || '';
                        }
                        if (!desc && typeof monitor.get_model === 'function') {
                            desc = monitor.get_model() || '';
                        }
                        let connector = '';
                        if (typeof monitor.get_connector === 'function') {
                            connector = monitor.get_connector() || '';
                        }
                        let label = `Monitor ${i + 1}`;
                        let details = [connector, desc].filter(Boolean).join(' - ');
                        if (details) {
                            label += ` (${details})`;
                        }
                        monitorStrings.push(label);
                    } else {
                        monitorStrings.push(`Monitor ${i + 1}`);
                    }
                }
            }
        } catch (e) {
            console.debug('CoreStats: Could not enumerate Gdk monitors:', e);
        }

        if (monitorStrings.length === 1) {
            monitorStrings.push('Monitor 1', 'Monitor 2', 'Monitor 3');
        }

        const savedMonitor = settings.get_int('widget-monitor');
        while (monitorStrings.length <= savedMonitor) {
            monitorStrings.push(`Monitor ${monitorStrings.length}`);
        }

        const monitorRow = new Adw.ComboRow({
            title: 'Display Monitor',
            subtitle: 'Choose which monitor the HUD appears on',
            model: new Gtk.StringList({
                strings: monitorStrings
            })
        });
        settings.bind('widget-monitor', monitorRow, 'selected', Gio.SettingsBindFlags.DEFAULT);
        positionGroup.add(monitorRow);

        const xRow = new Adw.ActionRow({
            title: 'X Offset',
            subtitle: 'Horizontal offset from monitor top-left (px)'
        });
        const xSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 5000, step_increment: 10 }),
            valign: Gtk.Align.CENTER
        });
        settings.bind('widget-x', xSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        xRow.add_suffix(xSpin);
        positionGroup.add(xRow);

        const yRow = new Adw.ActionRow({
            title: 'Y Offset',
            subtitle: 'Vertical offset from monitor top-left (px)'
        });
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

        // Migrate legacy max-height/max-width settings if needed
        if (settings.get_int('widget-height') === 0 && settings.get_int('widget-max-height') > 0) {
            settings.set_int('widget-height', settings.get_int('widget-max-height'));
        }

        const widthRow = new Adw.ActionRow({
            title: 'Width (px)',
            subtitle: 'Widget width in pixels (0 for auto-fit)'
        });
        const widthSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 5000, step_increment: 20 }),
            valign: Gtk.Align.CENTER
        });
        settings.bind('widget-width', widthSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        widthRow.add_suffix(widthSpin);
        positionGroup.add(widthRow);

        const heightRow = new Adw.ActionRow({
            title: 'Height (px)',
            subtitle: 'Widget height in pixels (0 for auto-fit)'
        });
        const heightSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 3000, step_increment: 20 }),
            valign: Gtk.Align.CENTER
        });
        settings.bind('widget-height', heightSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        heightRow.add_suffix(heightSpin);
        positionGroup.add(heightRow);
        

        window.add(page);
    }
}
