import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

const SENSOR_TYPES = {
    'cpu': {
        names: ['k10temp', 'coretemp'],
        icon: 'processor-symbolic',
        label: 'CPU'
    },
    'gpu': {
        names: ['amdgpu', 'radeon', 'nouveau', 'nvidia'],
        icon: 'video-display-symbolic',
        label: 'GPU'
    },
    'nvme': {
        names: ['nvme'],
        icon: 'drive-harddisk-symbolic',
        label: 'Disk'
    },
    'ram': {
        names: ['spd5118', 'jc42'],
        icon: 'memory-symbolic',
        label: 'RAM'
    }
};

export default class CoreStatsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._monitoredItems = [];
        this._prevCpuTotal = 0;
        this._prevCpuIdle = 0;

        this._initSensors();
        this._buildUi();
        
        this._updateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 
            this._settings.get_int('refresh-interval'), 
            this._updateStats.bind(this));
            
        this._settingsId = this._settings.connect('changed::refresh-interval', () => {
            if (this._updateId) GLib.source_remove(this._updateId);
            this._updateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 
                this._settings.get_int('refresh-interval'), 
                this._updateStats.bind(this));
        });

        this._updateStats();
    }

    disable() {
        if (this._updateId) {
            GLib.source_remove(this._updateId);
            this._updateId = null;
        }
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
        this._monitoredItems = [];
    }

    _initSensors() {
        this._monitoredItems = [];
        let i = 0;
        while (true) {
            let path = `/sys/class/hwmon/hwmon${i}`;
            if (!GLib.file_test(path, GLib.FileTest.EXISTS)) break;

            try {
                let name = GLib.file_get_contents(`${path}/name`)[1].toString().trim();
                let type = null;
                for (let t in SENSOR_TYPES) {
                    if (SENSOR_TYPES[t].names.includes(name)) {
                        type = t;
                        break;
                    }
                }

                // We only care about items with temperature sensors
                if (type && GLib.file_test(`${path}/temp1_input`, GLib.FileTest.EXISTS)) {
                    let item = {
                        type: type,
                        path: path,
                        sensorName: name,
                        displayName: SENSOR_TYPES[type].label,
                        icon: SENSOR_TYPES[type].icon,
                        temp: 0,
                        usage: 0,
                        lastUsageUpdate: 0
                    };

                    // Try to find usage path for GPU
                    if (type === 'gpu') {
                        let gpuBase = `/sys/class/drm/card0/device`;
                        if (GLib.file_test(`${gpuBase}/gpu_busy_percent`, GLib.FileTest.EXISTS)) {
                            item.usagePath = `${gpuBase}/gpu_busy_percent`;
                        }
                    }

                    // For NVMe, try to find matching block device for usage stats
                    if (type === 'nvme') {
                        // hwmon0/device is usually a symlink to ../../nvme0
                        // We want to find nvme0n1 or similar
                        try {
                            let deviceLink = GLib.file_read_link(`${path}/device`);
                            let deviceName = deviceLink.split('/').pop(); // e.g. "nvme0"
                            item.blockPath = `/sys/block/${deviceName}n1/stat`;
                            if (!GLib.file_test(item.blockPath, GLib.FileTest.EXISTS)) {
                                item.blockPath = null;
                            }
                        } catch (e) {}
                    }

                    this._monitoredItems.push(item);
                }
            } catch (e) {}
            i++;
        }

        // Always ensure CPU is present if possible, even if sensor name didn't match perfectly
        if (!this._monitoredItems.find(it => it.type === 'cpu')) {
            // Check for generic thermal zone if k10temp/coretemp not found
            // (Skipping for now as k10temp/coretemp are very common on Linux)
        }
    }

    _buildUi() {
        this._indicator = new PanelMenu.Button(0.0, 'Core Stats Indicator', false);
        this._box = new St.BoxLayout({ style_class: 'panel-status-indicators-box' });
        
        this._uiItems = [];

        // Add detailed menu header
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let titleItem = new PopupMenu.PopupMenuItem(_('Hardware Stats'), { reactive: false });
        titleItem.label.style = 'font-weight: bold;';
        this._indicator.menu.addMenuItem(titleItem);

        this._monitoredItems.forEach(item => {
            let itemBox = new St.BoxLayout({ style_class: 'core-stats-item' });
            let icon = new St.Icon({ icon_name: item.icon, style_class: 'system-status-icon' });
            let label = new St.Label({ text: '--', y_align: Clutter.ActorAlign.CENTER });
            
            itemBox.add_child(icon);
            itemBox.add_child(label);
            this._box.add_child(itemBox);
            
            let menuLabel = new PopupMenu.PopupMenuItem(`${item.displayName}: --`, { reactive: false });
            this._indicator.menu.addMenuItem(menuLabel);

            this._uiItems.push({
                box: itemBox,
                label: label,
                menuLabel: menuLabel
            });
        });

        this._indicator.add_child(this._box);
        Main.panel.addToStatusArea('core-stats', this._indicator);
    }

    _updateStats() {
        this._monitoredItems.forEach((item, index) => {
            this._readTemp(item);
            this._readUsage(item);
        });

        this._updateDisplay();
        return GLib.SOURCE_CONTINUE;
    }

    _readTemp(item) {
        try {
            let tempStr = GLib.file_get_contents(`${item.path}/temp1_input`)[1].toString().trim();
            item.temp = Math.round(parseInt(tempStr) / 1000);
        } catch (e) {}
    }

    _readUsage(item) {
        try {
            if (item.type === 'cpu') {
                let stat = GLib.file_get_contents('/proc/stat')[1].toString().split('\n')[0].split(/\s+/);
                let idle = parseInt(stat[4]);
                let total = stat.slice(1).reduce((acc, n) => acc + parseInt(n), 0);
                
                let diffTotal = total - this._prevCpuTotal;
                let diffIdle = idle - this._prevCpuIdle;
                if (diffTotal > 0) {
                    item.usage = Math.round(100 * (diffTotal - diffIdle) / diffTotal);
                }
                
                this._prevCpuTotal = total;
                this._prevCpuIdle = idle;
            } else if (item.type === 'gpu' && item.usagePath) {
                let usageStr = GLib.file_get_contents(item.usagePath)[1].toString().trim();
                item.usage = parseInt(usageStr);
            } else if (item.type === 'ram') {
                let meminfo = GLib.file_get_contents('/proc/meminfo')[1].toString();
                let total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]);
                let avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]);
                item.usage = Math.round(100 * (total - avail) / total);
            } else if (item.type === 'nvme' && item.blockPath) {
                let stat = GLib.file_get_contents(item.blockPath)[1].toString().trim().split(/\s+/);
                // Field 10 is milliseconds spent doing I/Os
                let ioTime = parseInt(stat[9]);
                let now = GLib.get_monotonic_time();
                
                if (item.prevIoTime !== undefined) {
                    let diffIo = ioTime - item.prevIoTime;
                    let diffTime = (now - item.prevTime) / 1000; // ms
                    if (diffTime > 0) {
                        item.usage = Math.min(100, Math.round(100 * diffIo / diffTime));
                    }
                }
                item.prevIoTime = ioTime;
                item.prevTime = now;
            }
        } catch (e) {}
    }

    _updateDisplay() {
        if (!this._indicator) return;

        let warn = this._settings.get_int('warning-threshold');
        let crit = this._settings.get_int('critical-threshold');

        this._monitoredItems.forEach((item, index) => {
            let ui = this._uiItems[index];
            if (!ui) return;

            let text = `${item.usage}% ${item.temp}°C`;
            ui.label.set_text(text);
            ui.label.style = this._getTempStyle(item.temp, warn, crit);

            ui.menuLabel.label.set_text(`${item.displayName}: ${item.usage}% usage | ${item.temp}°C`);
        });
    }

    _getTempStyle(temp, warn, crit) {
        if (temp >= crit) return 'color: #ff3333; font-weight: bold;';
        if (temp >= warn) return 'color: #ffaa00;';
        return '';
    }
}