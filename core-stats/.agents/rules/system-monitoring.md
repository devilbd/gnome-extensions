# System Monitoring & Hardware Sensor Rules

These rules govern hardware statistics discovery, metric computation, and file I/O within `extension.js`.

---

## 1. Asynchronous Non-Blocking I/O

- **No Synchronous File Reads:** Never use `GLib.file_get_contents`, `fs`, or synchronous subprocesses (`GLib.spawn_command_line_sync`) inside polling or update functions. Doing so blocks the compositor thread and degrades desktop frame rates.
- **Asynchronous Wrappers:** Always read procfs and sysfs nodes using `Gio.File.load_contents_async` wrapped in Promises:
  ```javascript
  async _readFile(path) {
      let file = Gio.File.new_for_path(path);
      return new Promise((resolve, reject) => {
          file.load_contents_async(null, (source, res) => {
              try {
                  let result = source.load_contents_finish(res);
                  let contents = result[0];
                  if (typeof contents === 'boolean') contents = result[1];
                  if (contents instanceof Uint8Array) {
                      resolve(new TextDecoder().decode(contents));
                  } else {
                      resolve(contents ? contents.toString() : "");
                  }
              } catch (e) {
                  reject(e);
              }
          });
      });
  }
  ```

---

## 2. Sensor Discovery & Path Verification

- Always test if paths exist using `GLib.file_test(path, GLib.FileTest.EXISTS)` before attempting to inspect or read them.
- In `/sys/class/hwmon/hwmon*`, identify sensor types by matching `/name` against known drivers:
  - CPU: `k10temp` (AMD), `coretemp` (Intel).
  - GPU: `amdgpu`, `radeon`, `nouveau`, `nvidia`.
  - NVMe: `nvme`.
  - RAM: `spd5118`, `jc42`.
- When reading GPU activity, check both `/sys/class/hwmon/hwmon*/device/gpu_busy_percent` and `/sys/class/drm/card*/device/gpu_busy_percent`.
- When reading NVMe activity, obtain block device stats via `/sys/block/<dev>/stat`.

---

## 3. Metrics Calculation & Normalization

- **CPU Usage:** Sample `/proc/stat` total ticks and idle ticks across successive intervals:
  $$\text{Usage} = \frac{\Delta\text{Total} - \Delta\text{Idle}}{\Delta\text{Total}} \times 100$$
- **RAM Usage:** Calculate active memory from `/proc/meminfo` using `MemTotal` and `MemAvailable`:
  $$\text{Usage} = \frac{\text{MemTotal} - \text{MemAvailable}}{\text{MemTotal}} \times 100$$
- **Network Bandwidth:** Parse `/proc/net/dev` aggregate bytes received and transmitted, dividing delta by elapsed time:
  $$\text{MB/s} = \frac{\Delta\text{Bytes}}{\Delta t \times 1024 \times 1024}$$
- **Filesystem Storage:** Query mount attributes asynchronously using `Gio.File.query_filesystem_info_async` with attributes `filesystem::size,filesystem::free,filesystem::used`.
- Always clamp progress bar percentages between `0` and `100`.
- Verify numeric parsing with `isNaN()` before assigning values to UI labels.

---

## 4. Error Resilience & Graceful Degradation

- Handle transient sensor errors, system sleep/wake cycles, or disconnected hardware devices without throwing unhandled exceptions.
- Provide sensible defaults (`--`) if a sensor temporarily fails to return data.
