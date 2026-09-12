import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

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
    },
    'motherboard': {
        icon: 'computer-symbolic',
        label: 'Motherboard'
    },
    'chipset': {
        icon: 'cpu-chip-symbolic',
        label: 'Chipset'
    },
    'vrm': {
        icon: 'power-profile-performance-symbolic',
        label: 'VRM'
    },
    'cpu-socket': {
        icon: 'cpu-chip-symbolic',
        label: 'CPU Socket'
    },
    'tsensor': {
        icon: 'temperature-symbolic',
        label: 'T-Sensor'
    },
    'motherboard-m2': {
        icon: 'drive-harddisk-symbolic',
        label: 'M.2 Slot'
    }
};

export default class CoreStatsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        if (!this._settings) return;

        this._monitoredItems = [];
        this._prevCpuTotal = 0;
        this._prevCpuIdle = 0;

        // Initialize display with a placeholder or empty container
        this._buildUi();
        
        // Connect settings
        this._settingsId = this._settings.connect('changed', (settings, key) => {
            if (key === 'refresh-interval') {
                this._restartTimer();
            } else if (key === 'widget-x' || key === 'widget-y' || key === 'widget-monitor') {
                this._updatePosition();
            } else if (key === 'widget-width' || key === 'widget-height' || key === 'widget-max-width' || key === 'widget-max-height' || key === 'widget-orientation' || key === 'show-motherboard-section') {
                this._buildUi();
            }
            this._updateDisplay();
        });

        // Listen for display/monitor topology changes
        if (Main.layoutManager && typeof Main.layoutManager.connect === 'function') {
            this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
                this._updatePosition();
            });
        }

        // Use a small timeout to ensure Shell is ready before final UI build
        this._initTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this._initAsync().catch(e => console.error('CoreStats init error:', e));
            this._initTimeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    async _initAsync() {
        await this._initSensors();
        this._buildUi();
        await this._updateStats();
        this._restartTimer();
    }

    _restartTimer() {
        if (this._updateId) {
            GLib.source_remove(this._updateId);
            this._updateId = null;
        }
        
        let interval = this._settings.get_int('refresh-interval');
        if (interval < 1) interval = 1;

        this._updateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 
            interval, 
            () => {
                this._updateStats().catch(e => console.debug('CoreStats update stats error:', e));
                return GLib.SOURCE_CONTINUE;
            });
    }

    disable() {
        if (this._initTimeoutId) {
            GLib.source_remove(this._initTimeoutId);
            this._initTimeoutId = null;
        }
        if (this._updateId) {
            GLib.source_remove(this._updateId);
            this._updateId = null;
        }
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
        if (this._monitorsChangedId && Main.layoutManager) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }
        if (this._container) {
            let parent = this._container.get_parent();
            if (parent) parent.remove_child(this._container);
            this._container.destroy();
            this._container = null;
        }
        this._coreWidget = null;
        this._mbWidget = null;
        this._uiItems = [];
        this._settings = null;
        this._monitoredItems = [];
    }

    async _initSensors() {
        this._monitoredItems = [];
        let addedPaths = new Set();

        for (let i = 0; i < 32; i++) {
            let path = `/sys/class/hwmon/hwmon${i}`;
            if (!GLib.file_test(path, GLib.FileTest.EXISTS)) continue;

            try {
                let contents = await this._readFile(`${path}/name`);
                if (!contents) continue;
                let name = contents.trim();

                let coreType = null;
                for (let t in SENSOR_TYPES) {
                    if (SENSOR_TYPES[t].names && SENSOR_TYPES[t].names.includes(name)) {
                        coreType = t;
                        break;
                    }
                }

                if (coreType && GLib.file_test(`${path}/temp1_input`, GLib.FileTest.EXISTS)) {
                    let tempPath = `${path}/temp1_input`;
                    if (!addedPaths.has(tempPath)) {
                        addedPaths.add(tempPath);
                        let item = {
                            section: 'core',
                            type: coreType,
                            path: path,
                            tempPath: tempPath,
                            sensorName: name,
                            displayName: SENSOR_TYPES[coreType].label,
                            icon: SENSOR_TYPES[coreType].icon,
                            temp: 0,
                            usage: 0,
                            lastUsageUpdate: 0
                        };

                        if (coreType === 'gpu') {
                            if (GLib.file_test(`${path}/device/gpu_busy_percent`, GLib.FileTest.EXISTS)) {
                                item.usagePath = `${path}/device/gpu_busy_percent`;
                            } else {
                                for (let cardIdx = 0; cardIdx < 5; cardIdx++) {
                                    let gpuBase = `/sys/class/drm/card${cardIdx}/device`;
                                    if (GLib.file_test(`${gpuBase}/gpu_busy_percent`, GLib.FileTest.EXISTS)) {
                                        item.usagePath = `${gpuBase}/gpu_busy_percent`;
                                        break;
                                    }
                                }
                            }
                        }

                        if (coreType === 'nvme') {
                            try {
                                let deviceLink = GLib.file_read_link(`${path}/device`);
                                let deviceName = deviceLink.split('/').pop();
                                item.blockPath = `/sys/block/${deviceName}n1/stat`;
                                if (!GLib.file_test(item.blockPath, GLib.FileTest.EXISTS)) {
                                    item.blockPath = null;
                                }
                            } catch (e) {
                                console.debug('CoreStats: Error reading nvme block path:', e);
                            }
                        }

                        this._monitoredItems.push(item);
                    }
                }

                // Motherboard Sensors (Ambient, Chipset/PCH, VRM, CPU Socket, T-Sensor, M.2)
                await this._scanMotherboardSensors(path, name, addedPaths);

            } catch (e) {
                console.debug(`CoreStats: Error initializing sensor ${path}:`, e);
            }
        }

        // Add Network
        this._monitoredItems.push({
            section: 'core',
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

    async _scanMotherboardSensors(path, name, addedPaths) {
        // 1. Intel PCH Thermal (pch_cannonlake, pch_alderlake, pch_raptorlake, etc.)
        if (name.startsWith('pch_') || name === 'pch') {
            let tempFile = `${path}/temp1_input`;
            if (GLib.file_test(tempFile, GLib.FileTest.EXISTS) && !addedPaths.has(tempFile)) {
                addedPaths.add(tempFile);
                this._monitoredItems.push({
                    section: 'motherboard',
                    type: 'chipset',
                    path: path,
                    tempPath: tempFile,
                    sensorName: name,
                    displayName: 'Chipset (PCH)',
                    icon: SENSOR_TYPES['chipset'].icon,
                    temp: 0,
                    usage: 0
                });
            }
            return;
        }

        // 2. Dedicated PMBus VRM Controllers
        const PMBUS_DRIVERS = [
            'pmbus', 'max16601', 'max20730', 'isl68137', 'xdpe122',
            'xdpe152', 'tps53679', 'mp2857', 'mp2975', 'raa229004',
            'raa228000', 'ir35221'
        ];
        if (PMBUS_DRIVERS.includes(name.toLowerCase())) {
            let tempFile = `${path}/temp1_input`;
            if (GLib.file_test(tempFile, GLib.FileTest.EXISTS) && !addedPaths.has(tempFile)) {
                addedPaths.add(tempFile);
                let item = {
                    section: 'motherboard',
                    type: 'vrm',
                    path: path,
                    tempPath: tempFile,
                    sensorName: name,
                    displayName: 'VRM',
                    icon: SENSOR_TYPES['vrm'].icon,
                    temp: 0,
                    usage: 0,
                    power: 0
                };
                if (GLib.file_test(`${path}/power1_input`, GLib.FileTest.EXISTS)) {
                    item.powerPath = `${path}/power1_input`;
                }
                if (GLib.file_test(`${path}/curr1_input`, GLib.FileTest.EXISTS)) {
                    item.currentPath = `${path}/curr1_input`;
                }
                if (GLib.file_test(`${path}/in1_input`, GLib.FileTest.EXISTS)) {
                    item.voltagePath = `${path}/in1_input`;
                }
                this._monitoredItems.push(item);
            }
            return;
        }

        // 3. Super I/O, Embedded Controller (EC), ACPI & Motherboard Telemetry
        const IGNORE_DRIVERS = ['k10temp', 'coretemp', 'amdgpu', 'radeon', 'nouveau', 'nvidia', 'nvme', 'spd5118', 'jc42'];
        if (IGNORE_DRIVERS.includes(name.toLowerCase())) return;

        // Scan inputs 1 through 16 for multi-channel motherboard sensors
        for (let idx = 1; idx <= 16; idx++) {
            let tempFile = `${path}/temp${idx}_input`;
            if (!GLib.file_test(tempFile, GLib.FileTest.EXISTS)) continue;
            if (addedPaths.has(tempFile)) continue;

            let label = '';
            let labelFile = `${path}/temp${idx}_label`;
            if (GLib.file_test(labelFile, GLib.FileTest.EXISTS)) {
                try {
                    let labelContent = await this._readFile(labelFile);
                    if (labelContent) label = labelContent.trim();
                } catch (e) {
                    console.debug(`CoreStats: Could not read label ${labelFile}:`, e);
                }
            }

            let l = label.toLowerCase();
            let matchedType = null;
            let displayName = '';
            let icon = '';

            if (l.includes('pch') || l.includes('chipset')) {
                matchedType = 'chipset';
                displayName = 'Chipset';
                icon = SENSOR_TYPES['chipset'].icon;
            } else if (l === 'systin' || l.includes('motherboard') || l.includes('mainboard') || l === 'system' || l === 'mb' || l === 'board' || l.includes('ambient') || (name === 'acpitz' && (l === 'temp1' || !label))) {
                matchedType = 'motherboard';
                displayName = 'Motherboard';
                icon = SENSOR_TYPES['motherboard'].icon;
            } else if (l.includes('vrm') || l.includes('mos') || l.includes('vcore') || ((name.startsWith('nct67') || name.startsWith('nct66')) && (l === 'auxtin0' || l === 'auxtin1'))) {
                matchedType = 'vrm';
                displayName = l.includes('east') ? 'VRM (East)' : (l.includes('west') ? 'VRM (West)' : 'VRM');
                icon = SENSOR_TYPES['vrm'].icon;
            } else if (l.includes('cputin') || l.includes('cpu socket') || l.includes('socket')) {
                matchedType = 'cpu-socket';
                displayName = 'CPU Socket';
                icon = SENSOR_TYPES['cpu-socket'].icon;
            } else if (l.includes('t_sensor') || l.includes('tsensor') || l.includes('water_') || l.includes('sensor_extra')) {
                matchedType = 'tsensor';
                displayName = label ? label.replace(/_/g, ' ') : 'T-Sensor';
                icon = SENSOR_TYPES['tsensor'].icon;
            } else if (l.includes('m.2') || l.includes('m2') || l.includes('pcie') || l.includes('pciex16')) {
                matchedType = 'motherboard-m2';
                displayName = l.includes('m') ? 'M.2 Slot' : 'PCIe Slot';
                icon = SENSOR_TYPES['motherboard-m2'].icon;
            }

            if (matchedType) {
                addedPaths.add(tempFile);
                let item = {
                    section: 'motherboard',
                    type: matchedType,
                    path: path,
                    tempPath: tempFile,
                    sensorName: name,
                    displayName: displayName,
                    icon: icon,
                    temp: 0,
                    usage: 0,
                    power: 0
                };

                if (matchedType === 'vrm') {
                    if (GLib.file_test(`${path}/power1_input`, GLib.FileTest.EXISTS)) {
                        item.powerPath = `${path}/power1_input`;
                    }
                    if (GLib.file_test(`${path}/curr1_input`, GLib.FileTest.EXISTS)) {
                        item.currentPath = `${path}/curr1_input`;
                    }
                    if (GLib.file_test(`${path}/in1_input`, GLib.FileTest.EXISTS)) {
                        item.voltagePath = `${path}/in1_input`;
                    }
                }

                this._monitoredItems.push(item);
            }
        }
    }

    async _initDrives() {
        try {
            let contents = await this._readFile('/proc/mounts');
            if (!contents) return;
            
            let lines = contents.split('\n');
            let seenMounts = new Set();
            let seenDevs = new Set();
            const ignoredPrefixes = [
                '/boot', '/etc', '/bin', '/sbin', '/usr', '/var',
                '/dev', '/proc', '/sys', '/run/credentials',
                '/run/systemd', '/run/user'
            ];

            for (let line of lines) {
                let parts = line.trim().split(/\s+/);
                if (parts.length < 3) continue;
                let dev = parts[0];
                let mountPoint = parts[1];
                let fsType = parts[2];

                if (dev.startsWith('/dev/')) {
                    if (fsType === 'tmpfs' || fsType === 'devtmpfs' || fsType === 'squashfs') continue;
                    
                    // Unescape octal sequences (like \040 for space)
                    mountPoint = mountPoint.replace(/\\(\d{3})/g, (match, octal) => {
                        return String.fromCharCode(parseInt(octal, 8));
                    });

                    if (seenMounts.has(mountPoint)) continue;
                    if (ignoredPrefixes.some(p => mountPoint.startsWith(p))) continue;
                    if (mountPoint.includes('/.')) continue;
                    if (seenDevs.has(dev) && mountPoint !== '/' && mountPoint !== '/home') continue;

                    seenMounts.add(mountPoint);
                    seenDevs.add(dev);

                    let label = mountPoint === '/' ? 'Root' : mountPoint.split('/').pop();
                    if (!label) label = mountPoint;

                    this._monitoredItems.push({
                        section: 'core',
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
            console.debug('CoreStats: Error initializing drives:', e);
        }
    }

    _buildUi() {
        if (this._container) {
            let parent = this._container.get_parent();
            if (parent) parent.remove_child(this._container);
            this._container.destroy();
            this._container = null;
        }

        let orientation = this._settings.get_int('widget-orientation');
        let isVertical = orientation === 0;
        let width = this._settings.get_int('widget-width');
        let height = this._settings.get_int('widget-height');

        // Backward compatibility fallback
        if (width <= 0) width = this._settings.get_int('widget-max-width');
        if (height <= 0) height = this._settings.get_int('widget-max-height');

        if (isVertical && width <= 0) width = 280;

        this._container = new St.BoxLayout({
            vertical: true,
            style_class: 'core-stats-wrapper',
            reactive: true,
            can_focus: false,
            track_hover: false,
            x_expand: true,
            y_expand: true
        });

        // 1. Main Core Stats Card
        this._coreWidget = new St.BoxLayout({
            vertical: true,
            style_class: 'core-stats-card',
            reactive: true,
            can_focus: false,
            track_hover: false,
            x_expand: true,
            y_expand: true
        });

        let cardWidthStyle = width > 0 ? `width: ${width}px; ` : '';
        let cardHeightStyle = height > 0 ? `height: ${height}px; ` : '';
        if (cardWidthStyle || cardHeightStyle) {
            this._coreWidget.style = `${cardWidthStyle}${cardHeightStyle}`;
        }
        if (width > 0) this._coreWidget.set_width(width);
        if (height > 0) this._coreWidget.set_height(height);

        let scrollView = new St.ScrollView({
            style_class: 'core-stats-scrollview',
            hscrollbar_policy: isVertical ? St.PolicyType.NEVER : (width > 0 ? St.PolicyType.AUTOMATIC : St.PolicyType.NEVER),
            vscrollbar_policy: isVertical ? (height > 0 ? St.PolicyType.AUTOMATIC : St.PolicyType.NEVER) : St.PolicyType.NEVER,
            enable_mouse_scrolling: true,
            overlay_scrollbars: false,
            x_expand: true,
            y_expand: true,
            reactive: true
        });

        let coreContentBox = new St.BoxLayout({
            vertical: isVertical,
            style_class: 'core-stats-content',
            x_expand: true,
            y_expand: true
        });
        scrollView.set_child(coreContentBox);
        this._coreWidget.add_child(scrollView);

        // Core Footer with title
        let footer = new St.BoxLayout({
            style_class: 'core-stats-footer',
            x_expand: true
        });
        let footerLabel = new St.Label({
            text: 'CORE STATS',
            style_class: 'core-stats-footer-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.END
        });
        footerLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        footerLabel.clutter_text.x_align = Clutter.ActorAlign.END;
        footer.add_child(footerLabel);
        this._coreWidget.add_child(footer);

        this._container.add_child(this._coreWidget);

        // 2. Motherboard Values Card (Separate widget look)
        this._mbWidget = new St.BoxLayout({
            vertical: true,
            style_class: 'core-stats-card core-stats-mb-card',
            reactive: true,
            can_focus: false,
            track_hover: false,
            x_expand: true,
            y_expand: false
        });

        if (cardWidthStyle) {
            this._mbWidget.style = cardWidthStyle;
        }
        if (width > 0) this._mbWidget.set_width(width);

        // Motherboard Section Header
        let mbHeader = new St.BoxLayout({
            style_class: 'core-stats-section-header',
            x_expand: true
        });
        let mbIcon = new St.Icon({
            icon_name: 'computer-symbolic',
            style_class: 'core-stats-section-icon'
        });
        let mbTitle = new St.Label({
            text: 'Motherboard values',
            style_class: 'core-stats-section-title',
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true
        });
        mbHeader.add_child(mbIcon);
        mbHeader.add_child(mbTitle);
        this._mbWidget.add_child(mbHeader);

        let mbContentBox = new St.BoxLayout({
            vertical: isVertical,
            style_class: 'core-stats-content',
            x_expand: true,
            y_expand: true
        });
        this._mbWidget.add_child(mbContentBox);

        this._container.add_child(this._mbWidget);

        this._uiItems = [];

        this._monitoredItems.forEach(item => {
            let row = new St.BoxLayout({ 
                style_class: isVertical ? 'core-stats-row' : 'core-stats-row-horizontal', 
                vertical: true,
                x_expand: true
            });
            
            let infoBox = new St.BoxLayout({ 
                style_class: 'core-stats-info',
                x_expand: true 
            });
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
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true
            });
            label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            label.clutter_text.line_wrap = false;

            let valueLabel = new St.Label({ 
                text: '--', 
                style_class: 'core-stats-value',
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: false
            });
            valueLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            valueLabel.clutter_text.line_wrap = false;

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

            if (item.section === 'motherboard') {
                mbContentBox.add_child(row);
            } else {
                coreContentBox.add_child(row);
            }

            this._uiItems.push({
                row: row,
                valueLabel: valueLabel,
                barFill: barFill
            });
        });

        // Add placeholder if no motherboard sensors are detected on hardware
        let hasMbSensors = this._monitoredItems.some(i => i.section === 'motherboard');
        if (!hasMbSensors) {
            let placeholderBox = new St.BoxLayout({
                style_class: 'core-stats-row',
                vertical: false,
                x_expand: true
            });
            let placeholderLabel = new St.Label({
                text: 'No motherboard sensors detected',
                style_class: 'core-stats-label',
                style: 'font-size: 0.82em; color: rgba(255, 255, 255, 0.5); font-style: italic;',
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true
            });
            placeholderBox.add_child(placeholderLabel);
            mbContentBox.add_child(placeholderBox);
        }

        // Add to the background group so it stays behind all application windows.
        try {
            let bgGroup = Main.layoutManager._backgroundGroup;
            if (bgGroup) {
                bgGroup.add_child(this._container);
                bgGroup.set_child_above_sibling(this._container, null);
            } else {
                Main.uiGroup.add_child(this._container);
                let windowGroup = Main.layoutManager.windowGroup;
                if (windowGroup) {
                    Main.uiGroup.set_child_below_sibling(this._container, windowGroup);
                }
            }
        } catch (e) {
            console.debug('CoreStats: Could not set z-order:', e);
            Main.uiGroup.add_child(this._container);
        }

        // Position it from settings relative to chosen monitor
        this._updatePosition();

        this._updateDisplay();
    }

    _getTargetMonitor() {
        let monitors = Main.layoutManager ? Main.layoutManager.monitors : null;
        if (!monitors || monitors.length === 0) {
            return (Main.layoutManager && Main.layoutManager.primaryMonitor) ? Main.layoutManager.primaryMonitor : null;
        }

        let monitorSetting = this._settings ? this._settings.get_int('widget-monitor') : 0;
        // 0 = Primary Monitor
        if (monitorSetting === 0) {
            return Main.layoutManager.primaryMonitor || monitors[0];
        }

        // monitorSetting >= 1 corresponds to monitor index (monitorSetting - 1)
        let targetIndex = monitorSetting - 1;
        if (targetIndex >= 0 && targetIndex < monitors.length) {
            return monitors[targetIndex];
        }

        return Main.layoutManager.primaryMonitor || monitors[0];
    }

    _updatePosition() {
        if (!this._container || !this._settings) return;

        let monitor = this._getTargetMonitor();
        let monX = monitor ? monitor.x : 0;
        let monY = monitor ? monitor.y : 0;

        this._container.set_position(
            monX + this._settings.get_int('widget-x'),
            monY + this._settings.get_int('widget-y')
        );
    }



    async _updateStats() {
        if (!this._monitoredItems || this._monitoredItems.length === 0) return;

        try {
            await Promise.all(this._monitoredItems.map(async (item) => {
                await this._readTemp(item);
                await this._readUsage(item);
            }));
        } catch (e) {
            console.debug('CoreStats: Error updating stats:', e);
        }

        this._updateDisplay();
    }

    async _readTemp(item) {
        let tempFile = item.tempPath || (item.path ? `${item.path}/temp1_input` : null);
        if (!tempFile) return;
        try {
            let contents = await this._readFile(tempFile);
            if (!contents) return;
            let tempStr = contents.trim();
            let val = parseInt(tempStr);
            if (!isNaN(val)) {
                let t = Math.round(val / 1000);
                // Filter out disconnected probes or blank readings (e.g., <= -40°C or 0°C on external headers)
                if (t <= -40 || (item.type === 'tsensor' && t <= 0)) {
                    item.temp = null;
                    item.disconnected = true;
                } else {
                    item.temp = t;
                    item.disconnected = false;
                }
            }
        } catch (e) {
            console.debug(`CoreStats: Error reading temp for ${tempFile}:`, e);
        }
    }

    async _readUsage(item) {
        try {
            if (item.section === 'motherboard') {
                // Read power telemetry if available
                if (item.powerPath) {
                    let contents = await this._readFile(item.powerPath);
                    if (contents) {
                        let val = parseInt(contents.trim());
                        if (!isNaN(val)) item.power = Math.round(val / 1000000);
                    }
                }
                // Read current telemetry if available
                if (item.currentPath) {
                    let contents = await this._readFile(item.currentPath);
                    if (contents) {
                        let val = parseInt(contents.trim());
                        if (!isNaN(val)) item.current = Math.round(val / 1000);
                    }
                }
                // Read voltage telemetry if available
                if (item.voltagePath) {
                    let contents = await this._readFile(item.voltagePath);
                    if (contents) {
                        let val = parseInt(contents.trim());
                        if (!isNaN(val)) item.voltage = (val / 1000).toFixed(2);
                    }
                }

                // Compute thermal percentage bar for motherboard items
                if (item.temp !== null && item.temp !== undefined && !item.disconnected) {
                    let maxRange = 85;
                    if (item.type === 'vrm') maxRange = 105;
                    else if (item.type === 'motherboard') maxRange = 60;
                    else if (item.type === 'chipset') maxRange = 85;
                    else if (item.type === 'cpu-socket') maxRange = 90;
                    else if (item.type === 'tsensor') maxRange = 70;

                    item.usage = Math.min(100, Math.max(0, Math.round((item.temp / maxRange) * 100)));
                } else {
                    item.usage = 0;
                }
                return;
            }

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
                    
                    if (used === 0n && total > 0n) {
                        used = total - free;
                    }

                    if (total > 0n) {
                        item.usage = Number((100n * used) / total);
                        item.freeStr = GLib.format_size(Number(free));
                    }
                } catch (e) {
                    console.debug(`CoreStats: Error reading usage for ${item.mountPoint}:`, e);
                }
            }
        } catch (e) {
            console.debug(`CoreStats: Error reading usage for ${item.type}:`, e);
        }
    }

    _updateDisplay() {
        if (!this._container) return;

        let warn = this._settings.get_int('warning-threshold');
        let crit = this._settings.get_int('critical-threshold');
        let showMbSection = this._settings.get_boolean('show-motherboard-section');

        this._monitoredItems.forEach((item, index) => {
            let ui = this._uiItems[index];
            if (!ui) return;

            let showTemp = false;
            let showUsage = true;

            try {
                if (item.section === 'motherboard') {
                    if (item.type === 'motherboard' || item.type === 'motherboard-m2') {
                        showTemp = this._settings.get_boolean('show-motherboard-temp');
                    } else if (item.type === 'chipset') {
                        showTemp = this._settings.get_boolean('show-chipset-temp');
                    } else if (item.type === 'vrm') {
                        showTemp = this._settings.get_boolean('show-vrm-temp');
                    } else if (item.type === 'cpu-socket') {
                        showTemp = this._settings.get_boolean('show-cpu-socket-temp');
                    } else if (item.type === 'tsensor') {
                        showTemp = this._settings.get_boolean('show-tsensor-temp');
                    } else {
                        showTemp = true;
                    }
                    showUsage = false;
                } else {
                    showTemp = this._settings.get_boolean(`show-${item.type}-temp`);
                    showUsage = this._settings.get_boolean(`show-${item.type}-usage`);
                }
            } catch (e) {
                console.debug(`CoreStats: Settings might not exist yet for ${item.type}`, e);
            }

            let parts = [];
            if (item.section === 'motherboard') {
                if (showTemp) {
                    if (item.disconnected) {
                        parts.push('N/C');
                    } else if (item.temp !== null && item.temp !== undefined) {
                        if (item.type === 'vrm' && this._settings.get_boolean('show-vrm-power') && item.power > 0) {
                            parts.push(`${item.temp}°C | ${item.power}W`);
                        } else {
                            parts.push(`${item.temp}°C`);
                        }
                    }
                }
            } else if (item.type === 'network') {
                if (showUsage) {
                    let downStr = item.speedDown >= 100 
                        ? `${Math.round(item.speedDown)}` 
                        : item.speedDown.toFixed(1);
                    let upStr = item.speedUp >= 100 
                        ? `${Math.round(item.speedUp)}` 
                        : item.speedUp.toFixed(1);
                    parts.push(`↓${downStr} ↑${upStr} MB/s`);
                }
            } else if (item.type === 'drive') {
                if (showUsage) {
                    let text = `${item.usage}%`;
                    if (item.freeStr) text += ` (${item.freeStr} free)`;
                    parts.push(text);
                }
            } else {
                if (showUsage) parts.push(`${item.usage}%`);
                if (showTemp && item.temp !== null) parts.push(`${item.temp}°C`);
            }

            let text = parts.join(' | ');
            ui.valueLabel.set_text(text || '--');
            
            if (showTemp && item.temp !== null && !item.disconnected) {
                ui.valueLabel.remove_style_class_name('status-warning');
                ui.valueLabel.remove_style_class_name('status-critical');
                
                let itemWarn = item.type === 'vrm' ? Math.max(warn, 85) : warn;
                let itemCrit = item.type === 'vrm' ? Math.max(crit, 100) : crit;

                if (item.temp >= itemCrit) {
                    ui.valueLabel.add_style_class_name('status-critical');
                } else if (item.temp >= itemWarn) {
                    ui.valueLabel.add_style_class_name('status-warning');
                }
            } else {
                ui.valueLabel.remove_style_class_name('status-warning');
                ui.valueLabel.remove_style_class_name('status-critical');
            }

            let isVertical = this._settings.get_int('widget-orientation') === 0;
            let barBg = ui.barFill.get_parent();
            let availWidth = 100;
            if (barBg && barBg.width > 1) {
                availWidth = barBg.width;
            } else if (isVertical && this._coreWidget && this._coreWidget.width > 50) {
                availWidth = this._coreWidget.width - 50;
            } else if (!isVertical) {
                availWidth = 220;
            }
            
            let targetWidth = Math.min(availWidth, Math.max(0, Math.round((item.usage / 100) * availWidth)));
            ui.barFill.width = targetWidth;

            if (item.section === 'motherboard') {
                ui.row.visible = showTemp && showMbSection && !item.disconnected;
            } else {
                ui.row.visible = (showTemp || showUsage);
            }
        });

        if (this._mbWidget) {
            if (!showMbSection) {
                this._mbWidget.visible = false;
            } else {
                let hasMbSensors = this._monitoredItems.some(i => i.section === 'motherboard');
                if (hasMbSensors) {
                    let anyVisible = this._monitoredItems.some((item, idx) => {
                        return item.section === 'motherboard' && this._uiItems[idx] && this._uiItems[idx].row.visible;
                    });
                    this._mbWidget.visible = anyVisible;
                } else {
                    this._mbWidget.visible = true;
                }
            }
        }
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
            console.debug(`CoreStats: Failed to read file ${path}:`, e);
            return "";
        }
    }
}