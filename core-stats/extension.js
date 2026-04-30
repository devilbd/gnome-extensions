import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class CoreStatsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._sensors = {
            cpu: { temp: 0, usage: 0, path: null },
            gpu: { temp: 0, usage: 0, path: null, usagePath: null },
            ram: { usage: 0 },
            nvme: []
        };

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
    }

    _initSensors() {
        // Find CPU/GPU/NVMe paths in /sys/class/hwmon
        let i = 0;
        while (true) {
            let path = `/sys/class/hwmon/hwmon${i}`;
            if (!GLib.file_test(path, GLib.FileTest.EXISTS)) break;

            try {
                let name = GLib.file_get_contents(`${path}/name`)[1].toString().trim();
                if (name === 'k10temp' || name === 'coretemp') {
                    this._sensors.cpu.path = path;
                } else if (name === 'amdgpu' || name === 'radeon' || name === 'nouveau') {
                    this._sensors.gpu.path = path;
                    // Try to find GPU usage path
                    let gpuBase = `/sys/class/drm/card0/device`;
                    if (GLib.file_test(`${gpuBase}/gpu_busy_percent`, GLib.FileTest.EXISTS)) {
                        this._sensors.gpu.usagePath = `${gpuBase}/gpu_busy_percent`;
                    }
                } else if (name === 'nvme') {
                    this._sensors.nvme.push({ path: path });
                }
            } catch (e) {}
            i++;
        }
    }

    _buildUi() {
        this._indicator = new PanelMenu.Button(0.0, 'Core Stats Indicator', false);
        
        this._box = new St.BoxLayout({ style_class: 'panel-status-indicators-box' });
        
        // CPU Info
        this._cpuBox = new St.BoxLayout({ style_class: 'core-stats-item' });
        this._cpuIcon = new St.Icon({ icon_name: 'processor-symbolic', style_class: 'system-status-icon' });
        this._cpuLabel = new St.Label({ text: '0°C', y_align: Clutter.ActorAlign.CENTER });
        this._cpuBox.add_child(this._cpuIcon);
        this._cpuBox.add_child(this._cpuLabel);
        
        // GPU Info
        this._gpuBox = new St.BoxLayout({ style_class: 'core-stats-item' });
        this._gpuIcon = new St.Icon({ icon_name: 'video-display-symbolic', style_class: 'system-status-icon' });
        this._gpuLabel = new St.Label({ text: '0°C', y_align: Clutter.ActorAlign.CENTER });
        this._gpuBox.add_child(this._gpuIcon);
        this._gpuBox.add_child(this._gpuLabel);

        this._box.add_child(this._cpuBox);
        this._box.add_child(this._gpuBox);
        
        this._indicator.add_child(this._box);
        
        // Add detailed menu
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._cpuMenuLabel = new PopupMenu.PopupMenuItem(_('CPU: --'), { reactive: false });
        this._gpuMenuLabel = new PopupMenu.PopupMenuItem(_('GPU: --'), { reactive: false });
        this._ramMenuLabel = new PopupMenu.PopupMenuItem(_('RAM: --'), { reactive: false });
        
        this._indicator.menu.addMenuItem(this._cpuMenuLabel);
        this._indicator.menu.addMenuItem(this._gpuMenuLabel);
        this._indicator.menu.addMenuItem(this._ramMenuLabel);
        
        Main.panel.addToStatusArea('core-stats', this._indicator);
    }

    _updateStats() {
        this._readCpu();
        this._readGpu();
        this._readRam();
        this._updateDisplay();
        return GLib.SOURCE_CONTINUE;
    }

    _readCpu() {
        // Temperature
        if (this._sensors.cpu.path) {
            try {
                let tempStr = GLib.file_get_contents(`${this._sensors.cpu.path}/temp1_input`)[1].toString().trim();
                this._sensors.cpu.temp = Math.round(parseInt(tempStr) / 1000);
            } catch (e) {}
        }

        // Usage
        try {
            let stat = GLib.file_get_contents('/proc/stat')[1].toString().split('\n')[0].split(/\s+/);
            let idle = parseInt(stat[4]);
            let total = stat.slice(1).reduce((acc, n) => acc + parseInt(n), 0);
            
            let diffTotal = total - this._prevCpuTotal;
            let diffIdle = idle - this._prevCpuIdle;
            this._sensors.cpu.usage = Math.round(100 * (diffTotal - diffIdle) / diffTotal);
            
            this._prevCpuTotal = total;
            this._prevCpuIdle = idle;
        } catch (e) {}
    }

    _readGpu() {
        // Temperature
        if (this._sensors.gpu.path) {
            try {
                let tempStr = GLib.file_get_contents(`${this._sensors.gpu.path}/temp1_input`)[1].toString().trim();
                this._sensors.gpu.temp = Math.round(parseInt(tempStr) / 1000);
            } catch (e) {}
        }
        // Usage (AMD)
        if (this._sensors.gpu.usagePath) {
            try {
                let usageStr = GLib.file_get_contents(this._sensors.gpu.usagePath)[1].toString().trim();
                this._sensors.gpu.usage = parseInt(usageStr);
            } catch (e) {}
        }
    }

    _readRam() {
        try {
            let meminfo = GLib.file_get_contents('/proc/meminfo')[1].toString();
            let total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]);
            let avail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)[1]);
            this._sensors.ram.usage = Math.round(100 * (total - avail) / total);
        } catch (e) {}
    }

    _updateDisplay() {
        if (!this._indicator) return;

        let cpuText = `${this._sensors.cpu.temp}°C`;
        let gpuText = `${this._sensors.gpu.temp}°C`;
        
        if (this._settings.get_boolean('show-cpu-usage')) cpuText += ` (${this._sensors.cpu.usage}%)`;
        if (this._settings.get_boolean('show-gpu-usage')) gpuText += ` (${this._sensors.gpu.usage}%)`;

        this._cpuLabel.set_text(cpuText);
        this._gpuLabel.set_text(gpuText);

        // Update menu items
        this._cpuMenuLabel.label.set_text(`CPU: ${this._sensors.cpu.temp}°C | ${this._sensors.cpu.usage}% usage`);
        this._gpuMenuLabel.label.set_text(`GPU: ${this._sensors.gpu.temp}°C | ${this._sensors.gpu.usage}% usage`);
        this._ramMenuLabel.label.set_text(`RAM: ${this._sensors.ram.usage}% usage`);

        // Color coding for warnings
        let warn = this._settings.get_int('warning-threshold');
        let crit = this._settings.get_int('critical-threshold');

        this._cpuLabel.style = this._getTempStyle(this._sensors.cpu.temp, warn, crit);
        this._gpuLabel.style = this._getTempStyle(this._sensors.gpu.temp, warn, crit);
    }

    _getTempStyle(temp, warn, crit) {
        if (temp >= crit) return 'color: #ff3333; font-weight: bold;';
        if (temp >= warn) return 'color: #ffaa00;';
        return '';
    }
}