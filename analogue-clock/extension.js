import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import cairo from 'cairo';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class ClockExtension extends Extension {
    enable() {
        try {
            this._settings = this.getSettings();
            this._size = this._settings.get_int('clock-size');

            // St.DrawingArea for Cairo drawing — reactive so it can receive events
            this._clockWidget = new St.DrawingArea({
                width: this._size,
                height: this._size,
                reactive: true,   // must be true for drag
            });

            // Listen for settings changes
            this._settingsId = this._settings.connect('changed', (settings, key) => {
                if (key === 'clock-size') {
                    this._size = settings.get_int('clock-size');
                    this._clockWidget.set_size(this._size, this._size);
                    // Update position to stay relative or just repaint
                }
                this._clockWidget.queue_repaint();
            });

            this._clockWidget.connect('repaint', this._drawClock.bind(this));

            // Position: bottom-right corner with margin
            let monitor = Main.layoutManager.primaryMonitor;
            this._posX = monitor.width - this._size - 40;
            this._posY = monitor.height - this._size - 80;
            this._clockWidget.set_position(this._posX, this._posY);

            // ----- Drag support -----
            this._dragging    = false;
            this._dragOffsetX = 0;
            this._dragOffsetY = 0;

            this._pressId = this._clockWidget.connect('button-press-event', (actor, event) => {
                this._dragging = true;
                let [ex, ey] = event.get_coords();
                let [ax, ay] = actor.get_position();
                this._dragOffsetX = ex - ax;
                this._dragOffsetY = ey - ay;
                return Clutter.EVENT_STOP;
            });

            this._releaseId = this._clockWidget.connect('button-release-event', () => {
                this._dragging = false;
                return Clutter.EVENT_STOP;
            });

            // motion events come from the stage while button is held
            this._motionId = global.stage.connect('captured-event', (stage, event) => {
                if (!this._dragging) return Clutter.EVENT_PROPAGATE;
                if (event.type() === Clutter.EventType.MOTION) {
                    let [ex, ey] = event.get_coords();
                    this._posX = Math.round(ex - this._dragOffsetX);
                    this._posY = Math.round(ey - this._dragOffsetY);
                    this._clockWidget.set_position(this._posX, this._posY);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            // Add to uiGroup overlay so it floats above desktop but below windows
            Main.uiGroup.add_child(this._clockWidget);

            // Update every second
            this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                this._clockWidget.queue_repaint();
                return GLib.SOURCE_CONTINUE;
            });

            this._clockWidget.queue_repaint();
        } catch (e) {
            let msg = e.message + '\n' + e.stack;
            GLib.file_set_contents(
                '/run/media/devilbd/d/Development/gnome-extensions-dev/clock/error.log',
                new TextEncoder().encode(msg)
            );
            console.error('ClockExtension error: ' + msg);
        }
    }

    disable() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }

        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
        this._settings = null;

        if (this._motionId) {
            global.stage.disconnect(this._motionId);
            this._motionId = null;
        }

        if (this._clockWidget) {
            if (this._pressId)   this._clockWidget.disconnect(this._pressId);
            if (this._releaseId) this._clockWidget.disconnect(this._releaseId);
            Main.uiGroup.remove_child(this._clockWidget);
            this._clockWidget.destroy();
            this._clockWidget = null;
        }
    }

    _drawClock(area) {
        const cr = area.get_context();
        const [width, height] = area.get_surface_size();

        const now     = GLib.DateTime.new_now_local();
        const hours   = now.get_hour();
        const minutes = now.get_minute();
        const seconds = now.get_second();

        const cx = width  / 2;
        const cy = height / 2;
        const R  = Math.min(width, height) / 2 - 6;

        // ── Clear ──────────────────────────────────────────────────────────
        cr.setOperator(cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(cairo.Operator.OVER);

        // ── Outer glow ring ───────────────────────────────────────────────
        // soft cyan halo
        cr.arc(cx, cy, R + 4, 0, 2 * Math.PI);
        cr.setSourceRGBA(0.0, 0.85, 1.0, 0.18);
        cr.setLineWidth(10);
        cr.stroke();

        // ── Face background (deep dark radial) ────────────────────────────
        let faceGrad = new cairo.RadialGradient(cx - R * 0.25, cy - R * 0.25, R * 0.05,
                                                 cx, cy, R);
        faceGrad.addColorStopRGBA(0,   0.18, 0.18, 0.22, 0.97);
        faceGrad.addColorStopRGBA(0.7, 0.08, 0.08, 0.10, 0.97);
        faceGrad.addColorStopRGBA(1,   0.03, 0.03, 0.05, 0.97);
        cr.arc(cx, cy, R, 0, 2 * Math.PI);
        cr.setSource(faceGrad);
        cr.fillPreserve();

        // ── Metallic border ───────────────────────────────────────────────
        let rimGrad = new cairo.LinearGradient(cx - R, cy - R, cx + R, cy + R);
        rimGrad.addColorStopRGBA(0,   0.9, 0.9, 1.0, 1.0);
        rimGrad.addColorStopRGBA(0.3, 0.4, 0.4, 0.5, 1.0);
        rimGrad.addColorStopRGBA(0.6, 0.8, 0.8, 0.9, 1.0);
        rimGrad.addColorStopRGBA(1,   0.2, 0.2, 0.3, 1.0);
        cr.setSource(rimGrad);
        cr.setLineWidth(3.5);
        cr.stroke();

        // ── Inner shine arc (top-left glossy highlight) ───────────────────
        cr.save();
        cr.arc(cx, cy, R, 0, 2 * Math.PI);
        cr.clip();
        let shineGrad = new cairo.LinearGradient(cx - R * 0.6, cy - R, cx + R * 0.3, cy + R * 0.2);
        shineGrad.addColorStopRGBA(0,   1, 1, 1, 0.13);
        shineGrad.addColorStopRGBA(0.5, 1, 1, 1, 0.0);
        cr.setSource(shineGrad);
        cr.arc(cx, cy, R, 0, 2 * Math.PI);
        cr.fill();
        cr.restore();

        // ── Hour tick marks ───────────────────────────────────────────────
        for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6 - Math.PI / 2;
            const isMain = (i % 3 === 0);
            const inner  = isMain ? R - 22 : R - 14;
            const lw     = isMain ? 3.5 : 2;

            const x1 = cx + Math.cos(angle) * inner;
            const y1 = cy + Math.sin(angle) * inner;
            const x2 = cx + Math.cos(angle) * (R - 3);
            const y2 = cy + Math.sin(angle) * (R - 3);

            // glowing tick
            cr.moveTo(x1, y1);
            cr.lineTo(x2, y2);
            cr.setLineCap(cairo.LineCap.ROUND);
            cr.setLineWidth(lw + 2);
            cr.setSourceRGBA(0.0, 0.85, 1.0, 0.25);
            cr.stroke();

            cr.moveTo(x1, y1);
            cr.lineTo(x2, y2);
            cr.setLineWidth(lw);
            cr.setSourceRGBA(0.85, 0.95, 1.0, 0.95);
            cr.stroke();

            // Draw numbers (12, 3, 6, 9) if enabled
            if (this._settings.get_boolean('show-numbers') && isMain) {
                const num = i === 0 ? 12 : i;
                cr.selectFontFace("Sans", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD);
                cr.setFontSize(R * 0.18);
                const extents = cr.textExtents(num.toString());
                const nx = cx + Math.cos(angle) * (inner - 25) - (extents.width / 2 + extents.x_bearing);
                const ny = cy + Math.sin(angle) * (inner - 25) - (extents.height / 2 + extents.y_bearing);
                cr.moveTo(nx, ny);
                cr.showText(num.toString());
            }
        }

        // ── Minute tick marks ─────────────────────────────────────────────
        for (let i = 0; i < 60; i++) {
            if (i % 5 === 0) continue;
            const angle = (i * Math.PI) / 30 - Math.PI / 2;
            const x1 = cx + Math.cos(angle) * (R - 8);
            const y1 = cy + Math.sin(angle) * (R - 8);
            const x2 = cx + Math.cos(angle) * (R - 3);
            const y2 = cy + Math.sin(angle) * (R - 3);
            cr.moveTo(x1, y1);
            cr.lineTo(x2, y2);
            cr.setLineWidth(1);
            cr.setSourceRGBA(0.6, 0.75, 0.85, 0.55);
            cr.stroke();
        }

        // ── Clock hand angles ─────────────────────────────────────────────
        const secAngle  = (seconds * Math.PI) / 30 - Math.PI / 2;
        const minAngle  = (minutes * Math.PI) / 30 + (seconds * Math.PI) / 1800 - Math.PI / 2;
        const hourAngle = ((hours % 12) * Math.PI) / 6 + (minutes * Math.PI) / 360 - Math.PI / 2;

        // ── Hour hand ─────────────────────────────────────────────────────
        this._drawHand(cr, cx, cy, hourAngle, R * 0.52, 7, [0.85, 0.9, 1.0], [0.0, 0.75, 1.0]);

        // ── Minute hand ───────────────────────────────────────────────────
        this._drawHand(cr, cx, cy, minAngle, R * 0.78, 5, [0.9, 0.95, 1.0], [0.0, 0.85, 1.0]);

        // ── Second hand (neon red) ────────────────────────────────────────
        // tail
        cr.moveTo(cx + Math.cos(secAngle + Math.PI) * R * 0.18,
                  cy + Math.sin(secAngle + Math.PI) * R * 0.18);
        cr.lineTo(cx + Math.cos(secAngle) * R * 0.88,
                  cy + Math.sin(secAngle) * R * 0.88);
        cr.setLineCap(cairo.LineCap.ROUND);
        // glow pass
        cr.setLineWidth(4);
        cr.setSourceRGBA(1.0, 0.1, 0.2, 0.35);
        cr.stroke();
        // sharp pass
        cr.moveTo(cx + Math.cos(secAngle + Math.PI) * R * 0.18,
                  cy + Math.sin(secAngle + Math.PI) * R * 0.18);
        cr.lineTo(cx + Math.cos(secAngle) * R * 0.88,
                  cy + Math.sin(secAngle) * R * 0.88);
        cr.setLineWidth(1.5);
        cr.setSourceRGBA(1.0, 0.25, 0.3, 1.0);
        cr.stroke();

        // ── Center jewel ─────────────────────────────────────────────────
        // outer glow
        cr.arc(cx, cy, 8, 0, 2 * Math.PI);
        cr.setSourceRGBA(0.0, 0.85, 1.0, 0.45);
        cr.fill();
        // inner bright dot
        cr.arc(cx, cy, 5, 0, 2 * Math.PI);
        cr.setSourceRGBA(0.9, 0.97, 1.0, 1.0);
        cr.fill();
        // specular
        cr.arc(cx - 1.5, cy - 1.5, 2, 0, 2 * Math.PI);
        cr.setSourceRGBA(1, 1, 1, 0.9);
        cr.fill();

        cr.$dispose();
    }

    /** Draw a glowing clock hand with a gradient from tipColor to glowColor */
    _drawHand(cr, cx, cy, angle, length, width, tipRGB, glowRGB) {
        const ex = cx + Math.cos(angle) * length;
        const ey = cy + Math.sin(angle) * length;

        // glow pass
        cr.moveTo(cx, cy);
        cr.lineTo(ex, ey);
        cr.setLineCap(cairo.LineCap.ROUND);
        cr.setLineWidth(width + 5);
        cr.setSourceRGBA(glowRGB[0], glowRGB[1], glowRGB[2], 0.22);
        cr.stroke();

        // main pass with gradient
        let grad = new cairo.LinearGradient(cx, cy, ex, ey);
        grad.addColorStopRGBA(0,   glowRGB[0]  * 0.6, glowRGB[1]  * 0.6, glowRGB[2]  * 0.6, 1.0);
        grad.addColorStopRGBA(0.5, tipRGB[0],          tipRGB[1],          tipRGB[2],          1.0);
        grad.addColorStopRGBA(1,   glowRGB[0],  glowRGB[1],  glowRGB[2],  1.0);

        cr.moveTo(cx, cy);
        cr.lineTo(ex, ey);
        cr.setSource(grad);
        cr.setLineWidth(width);
        cr.stroke();
    }
}
