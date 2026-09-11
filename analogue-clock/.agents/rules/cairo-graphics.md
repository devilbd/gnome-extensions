# Cairo Graphics & 2D Vector Drawing Rules

These rules govern the 2D canvas drawing inside `extension.js` (`St.DrawingArea` / Cairo context).

## 1. Context Lifecycle and Operators

- Start every redraw cycle by clearing the canvas and restoring normal compositing:
  ```javascript
  cr.setOperator(Cairo.Operator.CLEAR);
  cr.paint();
  cr.setOperator(Cairo.Operator.OVER);
  ```
- Always wrap clipping paths, matrix transforms, and font setups in `cr.save()` and `cr.restore()` pairs.

## 2. Gradient Patterns

- When creating `Cairo.LinearGradient` or `Cairo.RadialGradient`, ensure coordinate offsets match the geometric center `(cx, cy)` and radius `R`.
- Specify color stops using `addColorStopRGBA(offset, r, g, b, a)` where values are normalized between `0.0` and `1.0`.

## 3. Typography with PangoCairo

- Render text numerals using `PangoCairo.create_layout(cr)`.
- Set the font description via `Pango.FontDescription.from_string(...)` and compute pixel metrics with `layout.get_pixel_size()`.
- Always center text offsets based on computed layout dimensions:
  ```javascript
  const [pWidth, pHeight] = layout.get_pixel_size();
  const nx = cx + Math.cos(angle) * dist - pWidth / 2;
  const ny = cy + Math.sin(angle) * dist - pHeight / 2;
  cr.moveTo(nx, ny);
  PangoCairo.show_layout(cr, layout);
  ```

## 4. Performance

- The drawing routine triggers once every second via `GLib.timeout_add_seconds`.
- Avoid recreating large static objects or parsing strings redundantly inside the 1-second render loop.
- Use integer/rounded values for pixel coordinates when positioning UI actors to avoid sub-pixel blurring during drag-and-drop.
