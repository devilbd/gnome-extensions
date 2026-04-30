import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

const SENSOR_TYPES = {
    'cpu': {
        names: ['k10temp', 'coretemp'],
        icon: 'cpu-chip-symbolic',
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
    },
    'network': {
        icon: 'network-transmit-receive-symbolic',
        label: 'Net'
    },
    'drive': {
        icon: 'drive-harddisk-symbolic',
        label: 'Disk'
    }
};

export default class CoreStatsExtension extends Extension {
    async enable() {
        this._settings = this.getSettings();
        this._monitoredItems = [];
        this._prevCpuTotal = 0;
        this._prevCpuIdle = 0;

        await this._initSensors();
        
        if (!this._settings) return;

        this._buildUi();
        
        this._updateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 
            this._settings.get_int('refresh-interval'), 
            () => {
                this._updateStats().catch(e => logError(e, 'CoreStats'));
                return GLib.SOURCE_CONTINUE;
            });
            
        this._settingsId = this._settings.connect('changed', (settings, key) => {
            if (key === 'refresh-interval') {
                if (this._updateId) GLib.source_remove(this._updateId);
                this._updateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 
                    this._settings.get_int('refresh-interval'), 
                    () => {
                        this._updateStats().catch(e => logError(e, 'CoreStats'));
                        return GLib.SOURCE_CONTINUE;
                    });
            } else if (key === 'widget-x' || key === 'widget-y') {
                this._container.set_position(
                    this._settings.get_int('widget-x'),
                    this._settings.get_int('widget-y')
                );
            } else if (key === 'widget-width') {
                this._container.set_width(this._settings.get_int('widget-width'));
            }
            this._updateDisplay();
        });

        await this._updateStats();
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
        if (this._container) {
            let parent = this._container.get_parent();
            if (parent) parent.remove_child(this._container);
            this._container.destroy();
            this._container = null;
        }
        this._settings = null;
        this._monitoredItems = [];
    }

    async _initSensors() {
        this._monitoredItems = [];
        let i = 0;
        while (true) {
            let path = `/sys/class/hwmon/hwmon${i}`;
            if (!GLib.file_test(path, GLib.FileTest.EXISTS)) break;

            try {
                let contents = await this._readFile(`${path}/name`);
                let name = contents.trim();
                let type = null;
                for (let t in SENSOR_TYPES) {
                    if (SENSOR_TYPES[t].names.includes(name)) {
                        type = t;
                        break;
                    }
                }

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

                    if (type === 'gpu') {
                        let gpuBase = `/sys/class/drm/card0/device`;
                        if (GLib.file_test(`${gpuBase}/gpu_busy_percent`, GLib.FileTest.EXISTS)) {
                            item.usagePath = `${gpuBase}/gpu_busy_percent`;
                        }
                    }

                    if (type === 'nvme') {
                        try {
                            let deviceLink = GLib.file_read_link(`${path}/device`);
                            let deviceName = deviceLink.split('/').pop();
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

        // Add Network
        this._monitoredItems.push({
            type: 'network',
            displayName: 'Network',
            icon: 'network-transmit-receive-symbolic',
            usage: 0,
            speedDown: 0,
            speedUp: 0,
            prevBytesRecv: 0,
            prevBytesSent: 0,
            prevTime: GLib.get_monotonic_time(),
            temp: 0
        });

        // Add Drives
        await this._initDrives();
    }

    async _initDrives() {
        try {
            let contents = await this._readFile('/proc/mounts');
            if (!contents) return;
            
            let lines = contents.split('\n');
            let seenMounts = new Set();
            for (let line of lines) {
                let parts = line.trim().split(/\s+/);
                if (parts.length < 3) continue;
                let dev = parts[0];
                let mountPoint = parts[1];
                let fsType = parts[2];

                if (dev.startsWith('/dev/') && !seenMounts.has(mountPoint)) {
                    if (fsType === 'tmpfs' || fsType === 'devtmpfs' || fsType === 'squashfs') continue;
                    
                    // Unescape octal sequences (like \040 for space)
                    mountPoint = mountPoint.replace(/\\(\d{3})/g, (match, octal) => {
                        return String.fromCharCode(parseInt(octal, 8));
                    });

                    seenMounts.add(mountPoint);
                    let label = mountPoint === '/' ? 'Root' : mountPoint.split('/').pop();
                    if (!label) label = mountPoint;

                    this._monitoredItems.push({
                        type: 'drive',
                        displayName: `Disk (${label})`,
                        mountPoint: mountPoint,
                        icon: 'drive-harddisk-symbolic',
                        usage: 0,
                        temp: 0
                    });
                }
            }
        } catch (e) {
            logError(e, 'CoreStats: Error initializing drives');
        }
    }

    _buildUi() {
        this._container = new St.BoxLayout({
            vertical: true,
            style_class: 'core-stats-container',
            reactive: true,
            can_focus: false,
            track_hover: true
        });

        // Header
        let header = new St.Label({
            text: _('CORE STATS'),
            style_class: 'core-stats-header',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER
        });
        header.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._container.add_child(header);

        this._uiItems = [];

        this._monitoredItems.forEach(item => {
            let row = new St.BoxLayout({ style_class: 'core-stats-row', vertical: true });
            
            let infoBox = new St.BoxLayout({ style_class: 'core-stats-info' });
            let icon;
            if (item.icon === 'cpu-chip-symbolic') {
                let iconFile = this.dir.get_child('icons').get_child('cpu-chip-symbolic.svg');
                icon = new St.Icon({ 
                    gicon: Gio.Icon.new_for_string(iconFile.get_path()), 
                    style_class: 'core-stats-icon' 
                });
            } else {
                icon = new St.Icon({ 
                    icon_name: item.icon, 
                    style_class: 'core-stats-icon' 
                });
            }
            let label = new St.Label({ 
                text: item.displayName, 
                style_class: 'core-stats-label',
                y_align: Clutter.ActorAlign.CENTER 
            });
            let valueLabel = new St.Label({ 
                text: '--', 
                style_class: 'core-stats-value',
                x_expand: true,
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER 
            });

            infoBox.add_child(icon);
            infoBox.add_child(label);
            infoBox.add_child(valueLabel);

            // Progress bar container
            let barBg = new St.Bin({ style_class: 'core-stats-bar-bg', x_expand: true });
            let barFill = new St.Bin({ 
                style_class: `core-stats-bar-fill core-stats-bar-${item.type}`,
                width: 0,
                x_align: Clutter.ActorAlign.START
            });
            barBg.set_child(barFill);

            row.add_child(infoBox);
            row.add_child(barBg);

            this._container.add_child(row);

            this._uiItems.push({
                row: row,
                valueLabel: valueLabel,
                barFill: barFill
            });
        });

        // Add to the background group to stay on the desktop level
        Main.layoutManager._backgroundGroup.add_child(this._container);

        // Position it from settings
        this._container.set_position(
            this._settings.get_int('widget-x'),
            this._settings.get_int('widget-y')
        );
        this._container.set_width(this._settings.get_int('widget-width'));
    }



    async _updateStats() {
        if (!this._monitoredItems || this._monitoredItems.length === 0) return;

        try {
            await Promise.all(this._monitoredItems.map(async (item) => {
                await this._readTemp(item);
                await this._readUsage(item);
            }));
        } catch (e) {
            logError(e, 'CoreStats: Error updating stats');
        }

        this._updateDisplay();
    }

    async _readTemp(item) {
        if (!item.path) return;
        try {
            let contents = await this._readFile(`${item.path}/temp1_input`);
            if (!contents) return;
            let tempStr = contents.trim();
            let val = parseInt(tempStr);
            if (!isNaN(val)) {
                item.temp = Math.round(val / 1000);
            }
        } catch (e) {}
    }

    async _readUsage(item) {
        try {
            if (item.type === 'cpu') {
                let contents = await this._readFile('/proc/stat');
                if (!contents) return;
                let line = contents.split('\n')[0];
                let stat = line.trim().split(/\s+/);
                if (stat.length < 5) return;
                
                let idle = parseInt(stat[4]);
                let total = stat.slice(1).reduce((acc, n) => {
                    let val = parseInt(n);
                    return acc + (isNaN(val) ? 0 : val);
                }, 0);
                
                let diffTotal = total - this._prevCpuTotal;
                let diffIdle = idle - this._prevCpuIdle;
                if (diffTotal > 0) {
                    item.usage = Math.round(100 * (diffTotal - diffIdle) / diffTotal);
                }
                
                this._prevCpuTotal = total;
                this._prevCpuIdle = idle;
            } else if (item.type === 'gpu' && item.usagePath) {
                let contents = await this._readFile(item.usagePath);
                if (contents) {
                    let usageStr = contents.trim();
                    item.usage = parseInt(usageStr);
                }
            } else if (item.type === 'ram') {
                let contents = await this._readFile('/proc/meminfo');
                if (!contents) return;
                let totalMatch = contents.match(/MemTotal:\s+(\d+)/);
                let availMatch = contents.match(/MemAvailable:\s+(\d+)/);
                
                if (totalMatch && availMatch) {
                    let total = parseInt(totalMatch[1]);
                    let avail = parseInt(availMatch[1]);
                    item.usage = Math.round(100 * (total - avail) / total);
                }
            } else if (item.type === 'nvme' && item.blockPath) {
                let contents = await this._readFile(item.blockPath);
                if (contents) {
                    let stat = contents.trim().split(/\s+/);
                    let ioTime = parseInt(stat[9]);
                    let now = GLib.get_monotonic_time();
                    
                    if (item.prevIoTime !== undefined) {
                        let diffIo = ioTime - item.prevIoTime;
                        let diffTime = (now - item.prevTime) / 1000;
                        if (diffTime > 0) {
                            item.usage = Math.min(100, Math.round(100 * diffIo / diffTime));
                        }
                    }
                    item.prevIoTime = ioTime;
                    item.prevTime = now;
                }
            } else if (item.type === 'network') {
                let contents = await this._readFile('/proc/net/dev');
                if (!contents) return;
                
                let lines = contents.split('\n');
                let totalRecv = 0;
                let totalSent = 0;
                for (let line of lines) {
                    if (line.includes(':')) {
                        let parts = line.trim().split(/\s+/);
                        if (parts.length < 10) continue;
                        let iface = parts[0];
                        if (iface === 'lo:') continue;
                        
                        let recv = parseInt(parts[1]);
                        let sent = parseInt(parts[9]);
                        if (!isNaN(recv)) totalRecv += recv;
                        if (!isNaN(sent)) totalSent += sent;
                    }
                }

                let now = GLib.get_monotonic_time();
                if (item.prevTime !== undefined) {
                    let diffTime = (now - item.prevTime) / 1000000; // seconds
                    if (diffTime > 0) {
                        item.speedDown = (totalRecv - item.prevBytesRecv) / diffTime / (1024 * 1024); // MB/s
                        item.speedUp = (totalSent - item.prevBytesSent) / diffTime / (1024 * 1024); // MB/s
                        // Bar shows combined speed, 100MB/s = 100%
                        item.usage = Math.min(100, Math.round((item.speedDown + item.speedUp)));
                    }
                }
                item.prevBytesRecv = totalRecv;
                item.prevBytesSent = totalSent;
                item.prevTime = now;
            } else if (item.type === 'drive') {
                try {
                    let file = Gio.File.new_for_path(item.mountPoint);
                    let info = await new Promise((resolve, reject) => {
                        file.query_filesystem_info_async(
                            'filesystem::size,filesystem::free,filesystem::used',
                            GLib.PRIORITY_DEFAULT,
                            null,
                            (source, res) => {
                                try {
                                    resolve(source.query_filesystem_info_finish(res));
                                } catch (e) {
                                    reject(e);
                                }
                            }
                        );
                    });

                    let total = BigInt(info.get_attribute_uint64('filesystem::size'));
                    let free = BigInt(info.get_attribute_uint64('filesystem::free'));
                    let used = BigInt(info.get_attribute_uint64('filesystem::used'));
                    
                    // Fallback: if used is 0, calculate it from size and free
                    if (used === 0n && total > 0n) {
                        used = total - free;
                    }

                    if (total > 0n) {
                        item.usage = Number((100n * used) / total);
                        item.freeStr = GLib.format_size(Number(free));
                    }
                } catch (e) {
                    logError(e, `CoreStats: Error reading usage for ${item.mountPoint}`);
                }
            }
        } catch (e) {}
    }

    _updateDisplay() {
        if (!this._container) return;

        let warn = this._settings.get_int('warning-threshold');
        let crit = this._settings.get_int('critical-threshold');

        this._monitoredItems.forEach((item, index) => {
            let ui = this._uiItems[index];
            if (!ui) return;

            let showTemp = false;
            let showUsage = true;

            try {
                showTemp = this._settings.get_boolean(`show-${item.type}-temp`);
                showUsage = this._settings.get_boolean(`show-${item.type}-usage`);
            } catch (e) {
                // Settings might not exist yet for new types
            }

            let parts = [];
            if (item.type === 'network') {
                if (showUsage) {
                    parts.push(`↓${item.speedDown.toFixed(1)} MB/s`);
                    parts.push(`↑${item.speedUp.toFixed(1)} MB/s`);
                }
            } else if (item.type === 'drive') {
                if (showUsage) {
                    let text = `${item.usage}% full`;
                    if (item.freeStr) text += ` (${item.freeStr} free)`;
                    parts.push(text);
                }
            } else {
                if (showUsage) parts.push(`${item.usage}%`);
                if (showTemp) parts.push(`${item.temp}°C`);
            }

            let text = parts.join(' | ');
            ui.valueLabel.set_text(text);
            
            if (showTemp) {
                ui.valueLabel.remove_style_class_name('status-warning');
                ui.valueLabel.remove_style_class_name('status-critical');
                
                if (item.temp >= crit) {
                    ui.valueLabel.add_style_class_name('status-critical');
                } else if (item.temp >= warn) {
                    ui.valueLabel.add_style_class_name('status-warning');
                }
            } else {
                ui.valueLabel.remove_style_class_name('status-warning');
                ui.valueLabel.remove_style_class_name('status-critical');
            }

            let fullWidth = 150;
            let barBg = ui.barFill.get_parent();
            if (barBg && barBg.width > 0) {
                fullWidth = barBg.width;
            }
            
            let targetWidth = (item.usage / 100) * fullWidth;
            ui.barFill.width = targetWidth;

            ui.row.visible = (showTemp || showUsage);
        });
    }

    _getTempStyle(temp, warn, crit) {
        return '';
    }

    async _readFile(path) {
        try {
            let file = Gio.File.new_for_path(path);
            return new Promise((resolve, reject) => {
                file.load_contents_async(null, (source, res) => {
                    try {
                        let result = source.load_contents_finish(res);
                        // Handle both old [success, contents, etag] and new [contents, etag] signatures
                        let contents = result[0];
                        if (typeof contents === 'boolean') {
                            contents = result[1];
                        }
                        
                        if (contents instanceof Uint8Array || (contents && contents.constructor && contents.constructor.name === 'Uint8Array')) {
                            resolve(new TextDecoder().decode(contents));
                        } else if (contents && typeof contents.toString === 'function') {
                            resolve(contents.toString());
                        } else {
                            resolve("");
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        } catch (e) {
            logError(e, `CoreStats: Failed to read file ${path}`);
            return "";
        }
    }
}