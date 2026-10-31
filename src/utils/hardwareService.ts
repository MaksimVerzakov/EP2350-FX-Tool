export interface HardwareDeviceFile {
  name: string;
  size: number;
  isWav: boolean;
  isHidden: boolean;
}

export interface HardwareStatus {
  connected: boolean;
  mode: 'macos-bridge' | 'fs-access' | 'disconnected';
  volumeName: string;
  mountPath?: string;
  usbProduct?: string;
  serialPort?: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  hasConfigJson: boolean;
  configSize?: number;
  configLastModified?: number;
  files: HardwareDeviceFile[];
  lastChecked: number;
}

export interface ConfigBackupEntry {
  id: string;
  timestamp: number;
  label: 'MIC SNAPSHOT' | 'PRE-UPLOAD AUTO-BACKUP' | 'MANUAL BACKUP' | 'FACTORY / MIC BASELINE';
  packName: string;
  presetNames: string[];
  rawJson: string;
  sizeBytes: number;
}

const BACKUP_STORAGE_KEY = 'ep2350_config_backups_v1';
const MAX_BACKUPS = 25;
// Exact FAT12 user-accessible volume capacity reported by diskutil on EP-2350 DRIVE (251 x 4096-byte clusters)
export const TINGDISK_TOTAL_BYTES = 1028096;
export const TINGDISK_BLOCK_SIZE = 4096;

// Baseline snapshot of the user's actual TINGDISK config.json ("BROKEN RADIO PACK")
export const HARDWARE_BASELINE_CONFIG_JSON = `{
  "name": "BROKEN RADIO PACK",
  "presets": [
    {
      "pos": 0,
      "name": "WALKIE TALKIE",
      "comment": "bandpass filter + dist. handle tunes frequency.",
      "list": [
        {
          "effect": "HIGHPASS",
          "cutoff": 0.1
        },
        {
          "effect": "LOWPASS",
          "cutoff": 0.4
        },
        {
          "effect": "DIST",
          "amount": 15.0,
          "mix": 0.5
        },
        {
          "effect": "SAMPLE"
        }
      ],
      "handle": {
        "row": 1,
        "param": "cutoff",
        "depth": 0.5
      },
      "shake": {
        "row": 2,
        "param": "mix",
        "depth": 0.5
      },
      "trigger": {
        "row": 3
      }
    },
    {
      "pos": 1,
      "name": "AM TUNER",
      "comment": "ssb frequency shift. handle searches for station.",
      "list": [
        {
          "effect": "SSB",
          "frequency": -500.0
        },
        {
          "effect": "DIST",
          "amount": 5.0,
          "mix": 0.2
        },
        {
          "effect": "SAMPLE"
        }
      ],
      "handle": {
        "row": 0,
        "param": "frequency",
        "depth": 1000.0
      },
      "shake": {
        "row": 0,
        "param": "frequency",
        "depth": 200.0
      },
      "trigger": {
        "row": 2
      }
    },
    {
      "pos": 2,
      "name": "CRYPTIC",
      "comment": "ring modulator. handle changes pitch tone.",
      "list": [
        {
          "effect": "RING",
          "frequency": 100.0,
          "mix": 0.8
        },
        {
          "effect": "REVERB",
          "time": 0.5,
          "wet-level": 0.4
        },
        {
          "effect": "SAMPLE"
        }
      ],
      "handle": {
        "row": 0,
        "param": "frequency",
        "depth": 2000.0
      },
      "lfo": {
        "row": 0,
        "param": "frequency",
        "depth": 50.0,
        "shape": "random",
        "speed": 8.0
      },
      "trigger": {
        "row": 2
      }
    },
    {
      "pos": 3,
      "name": "LOSING SIGNAL",
      "comment": "sound gets choppy and distant when handle is pushed.",
      "list": [
        {
          "effect": "BALANCE",
          "balance": 0.5
        },
        {
          "effect": "REVERB",
          "time": 1.0,
          "wet-level": 0.0,
          "dry-level": 1.0
        },
        {
          "effect": "SAMPLE"
        }
      ],
      "handle": {
        "row": 1,
        "param": "wet-level",
        "depth": 1.0
      },
      "lfo": {
        "row": 0,
        "param": "balance",
        "depth": 1.0,
        "shape": "square",
        "speed": 10.0
      },
      "shake": {
        "row": 1,
        "param": "dry-level",
        "depth": -1.0
      },
      "trigger": {
        "row": 2
      }
    }
  ]
}`;

class Ep2350HardwareService {
  private dirHandle: any = null; // FileSystemDirectoryHandle when connected via Browser File System Access API
  private bridgeBaseUrl: string | null = null;

  /**
   * Checks if the browser supports the Web File System Access API (Chrome, Edge, Brave, Arc, Opera on macOS).
   */
  public supportsFileSystemAccess(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  /**
   * Probes whether the local macOS native USB bridge (/api/ep2350/status) is reachable.
   */
  private async probeMacBridge(): Promise<any | null> {
    const candidates = ['./api/ep2350/status', 'http://localhost:3000/api/ep2350/status'];
    for (const url of candidates) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data && data.bridgeAvailable) {
            this.bridgeBaseUrl = url.replace(/\/status$/, '');
            return data;
          }
        }
      } catch {
        // Ignore and try next candidate
      }
    }
    this.bridgeBaseUrl = null;
    return null;
  }

  /**
   * Queries current EP-2350 hardware status across either the macOS native bridge
   * or an active Web File System Access directory handle.
   */
  public async getStatus(): Promise<HardwareStatus> {
    // 1. Try native macOS bridge first (automatic /Volumes/TINGDISK detection)
    const bridgeData = await this.probeMacBridge();
    if (bridgeData && bridgeData.connected) {
      return {
        connected: true,
        mode: 'macos-bridge',
        volumeName: bridgeData.volumeName || 'TINGDISK',
        mountPath: bridgeData.mountPath || '/Volumes/TINGDISK',
        usbProduct: bridgeData.usbProduct || 'EP-2350 1.0.8',
        serialPort: bridgeData.serialPort,
        totalBytes: bridgeData.totalBytes || TINGDISK_TOTAL_BYTES,
        usedBytes: bridgeData.usedBytes || 0,
        freeBytes: bridgeData.freeBytes || TINGDISK_TOTAL_BYTES,
        hasConfigJson: Boolean(bridgeData.hasConfigJson),
        configSize: bridgeData.configSize,
        configLastModified: bridgeData.configLastModified,
        files: Array.isArray(bridgeData.files) ? bridgeData.files : [],
        lastChecked: Date.now()
      };
    }

    // 2. Check active FileSystemDirectoryHandle if user connected via browser picker
    if (this.dirHandle) {
      try {
        const files: HardwareDeviceFile[] = [];
        let usedBytes = 0;
        let hasConfigJson = false;
        let configSize: number | undefined;
        let configLastModified: number | undefined;

        for await (const [name, entry] of this.dirHandle.entries()) {
          if (entry.kind === 'file') {
            const fileObj: File = await entry.getFile();
            const isHidden = name.startsWith('.');
            const isWav = name.toLowerCase().endsWith('.wav');
            files.push({
              name,
              size: fileObj.size,
              isWav,
              isHidden
            });
            // FAT12 allocates in 4096-byte clusters
            const allocated = Math.max(TINGDISK_BLOCK_SIZE, Math.ceil(fileObj.size / TINGDISK_BLOCK_SIZE) * TINGDISK_BLOCK_SIZE);
            usedBytes += allocated;

            if (name.toLowerCase() === 'config.json') {
              hasConfigJson = true;
              configSize = fileObj.size;
              configLastModified = fileObj.lastModified;
            }
          } else if (entry.kind === 'directory') {
            // Directory cluster overhead on FAT12
            usedBytes += TINGDISK_BLOCK_SIZE;
          }
        }

        files.sort((a, b) => a.name.localeCompare(b.name));
        const freeBytes = Math.max(0, TINGDISK_TOTAL_BYTES - usedBytes);

        return {
          connected: true,
          mode: 'fs-access',
          volumeName: this.dirHandle.name || 'TINGDISK',
          mountPath: `/Volumes/${this.dirHandle.name || 'TINGDISK'}`,
          usbProduct: 'EP-2350 (USB MSC)',
          totalBytes: TINGDISK_TOTAL_BYTES,
          usedBytes,
          freeBytes,
          hasConfigJson,
          configSize,
          configLastModified,
          files,
          lastChecked: Date.now()
        };
      } catch {
        // Handle became invalid (e.g. disk ejected)
        this.dirHandle = null;
      }
    }

    return {
      connected: false,
      mode: 'disconnected',
      volumeName: 'TINGDISK',
      totalBytes: TINGDISK_TOTAL_BYTES,
      usedBytes: 0,
      freeBytes: TINGDISK_TOTAL_BYTES,
      hasConfigJson: false,
      files: [],
      lastChecked: Date.now()
    };
  }

  /**
   * Opens the macOS Finder directory picker so the user can select /Volumes/TINGDISK
   * directly from the browser (works on GitHub Pages!).
   */
  public async connectViaPicker(): Promise<{ ok: boolean; status?: HardwareStatus; error?: string }> {
    // First check if native macOS bridge already sees the drive
    const bridgeStatus = await this.getStatus();
    if (bridgeStatus.connected && bridgeStatus.mode === 'macos-bridge') {
      return { ok: true, status: bridgeStatus };
    }

    if (!this.supportsFileSystemAccess()) {
      return {
        ok: false,
        error:
          'Your browser does not support direct USB volume access (File System Access API). Please use Chrome, Brave, Arc, or Edge on macOS, or run the local dev server.'
      };
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        id: 'ep2350_tingdisk',
        mode: 'readwrite'
      });
      this.dirHandle = handle;
      const status = await this.getStatus();
      return { ok: true, status };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { ok: false, error: 'Selection cancelled.' };
      }
      return { ok: false, error: err?.message || 'Failed to open TINGDISK volume.' };
    }
  }

  public disconnect(): void {
    this.dirHandle = null;
  }

  /**
   * Reads config.json directly from the connected EP-2350 TINGDISK volume.
   */
  public async fetchConfigFromMic(): Promise<{ ok: boolean; rawJson?: string; error?: string }> {
    const status = await this.getStatus();
    if (!status.connected) {
      return { ok: false, error: 'EP-2350 TINGDISK is not connected or mounted.' };
    }

    if (status.mode === 'macos-bridge' && this.bridgeBaseUrl) {
      try {
        const res = await fetch(`${this.bridgeBaseUrl}/config`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Failed to read config.json from /Volumes/TINGDISK.' };
        }
        return { ok: true, rawJson: data.rawJson };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Error reading from macOS bridge.' };
      }
    }

    if (status.mode === 'fs-access' && this.dirHandle) {
      try {
        const fileHandle = await this.dirHandle.getFileHandle('config.json', { create: false });
        const file: File = await fileHandle.getFile();
        const rawJson = await file.text();
        return { ok: true, rawJson };
      } catch (err: any) {
        return {
          ok: false,
          error:
            err?.name === 'NotFoundError'
              ? 'No config.json found on TINGDISK (mic may be using factory defaults).'
              : `Failed to read config.json: ${err?.message || 'Unknown error'}`
        };
      }
    }

    return { ok: false, error: 'No active connection to TINGDISK.' };
  }

  /**
   * Writes config.json directly to the connected EP-2350 TINGDISK volume.
   * Automatically backs up the existing config.json on the mic before overwriting!
   */
  public async uploadConfigToMic(newRawJson: string): Promise<{
    ok: boolean;
    backedUpPrevious?: boolean;
    error?: string;
  }> {
    // Verify valid JSON syntax before touching hardware flash
    try {
      JSON.parse(newRawJson);
    } catch (err: any) {
      return { ok: false, error: `Invalid JSON syntax (aborted to protect hardware): ${err?.message}` };
    }

    const status = await this.getStatus();
    if (!status.connected) {
      return { ok: false, error: 'EP-2350 TINGDISK is not connected or mounted.' };
    }

    // 1. Read and auto-backup whatever is currently on the mic before overwriting
    let backedUpPrevious = false;
    if (status.hasConfigJson) {
      const existing = await this.fetchConfigFromMic();
      if (existing.ok && existing.rawJson) {
        this.saveBackup(existing.rawJson, 'PRE-UPLOAD AUTO-BACKUP');
        backedUpPrevious = true;
      }
    }

    // 2. Write via macOS native bridge
    if (status.mode === 'macos-bridge' && this.bridgeBaseUrl) {
      try {
        const res = await fetch(`${this.bridgeBaseUrl}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawJson: newRawJson })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Failed to write config.json to /Volumes/TINGDISK.' };
        }
        return { ok: true, backedUpPrevious };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Network error writing to macOS bridge.' };
      }
    }

    // 3. Write via Web File System Access API
    if (status.mode === 'fs-access' && this.dirHandle) {
      try {
        const fileHandle = await this.dirHandle.getFileHandle('config.json', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(newRawJson);
        await writable.close();

        // Attempt to remove macOS AppleDouble ._config.json if present
        try {
          await this.dirHandle.removeEntry('._config.json');
        } catch {
          // Ignore if ._config.json doesn't exist
        }

        return { ok: true, backedUpPrevious };
      } catch (err: any) {
        return { ok: false, error: `Failed to write config.json to TINGDISK: ${err?.message || 'Permission denied'}` };
      }
    }

    return { ok: false, error: 'No active writable connection to TINGDISK.' };
  }

  /**
   * Safely ejects /Volumes/TINGDISK on macOS (available when connected via macOS bridge)
   * so the microcontroller reboots cleanly with the updated config.json.
   */
  public async ejectMicVolume(): Promise<{ ok: boolean; message?: string; error?: string }> {
    if (this.bridgeBaseUrl) {
      try {
        const res = await fetch(`${this.bridgeBaseUrl}/eject`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.ok) {
          this.dirHandle = null;
          return { ok: true, message: data.message || 'TINGDISK safely ejected! Push the mic handle to restart.' };
        }
        return { ok: false, error: data.error || 'Failed to eject TINGDISK.' };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Failed to communicate with macOS bridge.' };
      }
    }
    this.dirHandle = null;
    return {
      ok: true,
      message: 'Disconnected from browser. Please click Eject next to TINGDISK in macOS Finder before unplugging.'
    };
  }

  // ============================================================================
  // BACKUP VAULT MANAGEMENT (LocalStorage + Downloadable .json Snapshots)
  // ============================================================================

  public getBackups(): ConfigBackupEntry[] {
    try {
      const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
      let list: ConfigBackupEntry[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];

      // Ensure the hardware baseline ("BROKEN RADIO PACK") is always present if vault is empty
      if (list.length === 0) {
        const baseline = this.createBackupEntry(
          HARDWARE_BASELINE_CONFIG_JSON,
          'FACTORY / MIC BASELINE',
          Date.now()
        );
        list = [baseline];
        localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(list));
      }
      return list;
    } catch {
      return [];
    }
  }

  private createBackupEntry(
    rawJson: string,
    label: ConfigBackupEntry['label'],
    timestamp = Date.now()
  ): ConfigBackupEntry {
    let packName = 'UNTITLED PACK';
    let presetNames: string[] = [];
    try {
      const parsed = JSON.parse(rawJson);
      if (typeof parsed.name === 'string' && parsed.name.trim()) {
        packName = parsed.name.trim();
      }
      if (Array.isArray(parsed.presets)) {
        presetNames = parsed.presets.map(
          (p: any, idx: number) => p.name || `PRESET ${(typeof p.pos === 'number' ? p.pos : idx) + 1}`
        );
      }
    } catch {
      // Fallback
    }

    return {
      id: `bkp-${timestamp}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      label,
      packName,
      presetNames,
      rawJson,
      sizeBytes: new Blob([rawJson]).size
    };
  }

  public saveBackup(
    rawJson: string,
    label: ConfigBackupEntry['label'] = 'MANUAL BACKUP'
  ): ConfigBackupEntry {
    const existing = this.getBackups();

    // Avoid duplicate consecutive auto-backups with identical normalized JSON
    const latest = existing[0];
    if (
      latest &&
      label !== 'MANUAL BACKUP' &&
      latest.rawJson.trim().replace(/\r\n/g, '\n') === rawJson.trim().replace(/\r\n/g, '\n')
    ) {
      return latest;
    }

    const entry = this.createBackupEntry(rawJson, label);
    const updated = [entry, ...existing].slice(0, MAX_BACKUPS);
    try {
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota issues
    }
    return entry;
  }

  public deleteBackup(id: string): ConfigBackupEntry[] {
    const existing = this.getBackups().filter((b) => b.id !== id);
    try {
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(existing));
    } catch {
      // Ignore
    }
    return existing;
  }

  public downloadBackupFile(entry: ConfigBackupEntry): void {
    const safeName = entry.packName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const dateStr = new Date(entry.timestamp)
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 16);
    const filename = `ep2350-backup-${safeName}-${dateStr}.json`;

    const blob = new Blob([entry.rawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const hardwareService = new Ep2350HardwareService();
