import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_PACK } from './constants/defaultPresets';
import { PackConfig, PresetConfig } from './types/config';
import { audioEngine } from './dsp/AudioEngine';
import { serializeToConfigJson, validatePackConfig } from './utils/serializer';
import { parseConfigJson } from './utils/parser';
import {
  hardwareService,
  HardwareStatus,
  ConfigBackupEntry,
  TINGDISK_TOTAL_BYTES
} from './utils/hardwareService';

import { TopBanner } from './components/TopBanner';
import { MicDevice } from './components/MicDevice';
import { AudioPlayerCompact } from './components/AudioPlayerCompact';
import { PresetLedger } from './components/PresetLedger';
import { HardwareModal } from './components/HardwareModal';
import { HelpCircle, X, CheckCircle2, AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  const [pack, setPack] = useState<PackConfig>(() => {
    const saved = localStorage.getItem('ep2350_pack_config');
    if (saved) {
      const parsed = parseConfigJson(saved);
      if (parsed.pack) return parsed.pack;
    }
    return INITIAL_PACK;
  });

  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [handlePos, setHandlePos] = useState<number>(0.0);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showHardwareModal, setShowHardwareModal] = useState<boolean>(false);

  // Hardware & Backup state
  const [hardwareStatus, setHardwareStatus] = useState<HardwareStatus>({
    connected: false,
    mode: 'disconnected',
    volumeName: 'TINGDISK',
    totalBytes: TINGDISK_TOTAL_BYTES,
    usedBytes: 0,
    freeBytes: TINGDISK_TOTAL_BYTES,
    hasConfigJson: false,
    files: [],
    lastChecked: Date.now()
  });
  const [backups, setBackups] = useState<ConfigBackupEntry[]>(() => hardwareService.getBackups());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = useCallback(
    (type: 'success' | 'error' | 'info', message: string) => {
      setStatusBanner({ type, message });
    },
    []
  );

  // Auto-dismiss notification after 6 seconds
  useEffect(() => {
    if (!statusBanner) return;
    const timer = setTimeout(() => setStatusBanner(null), 6000);
    return () => clearTimeout(timer);
  }, [statusBanner]);

  const refreshHardwareStatus = useCallback(async () => {
    const st = await hardwareService.getStatus();
    setHardwareStatus(st);
    return st;
  }, []);

  // Poll for /Volumes/TINGDISK connection status
  useEffect(() => {
    refreshHardwareStatus();
    const interval = setInterval(refreshHardwareStatus, 4000);
    const onFocus = () => refreshHardwareStatus();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshHardwareStatus]);

  const activePreset = pack.presets.find((p) => p.pos === activeSlot) || pack.presets[0];

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('ep2350_pack_config', serializeToConfigJson(pack));
  }, [pack]);

  // Synchronize active preset with DSP engine
  useEffect(() => {
    audioEngine.updatePreset(activePreset);
  }, [activePreset]);

  // Squeeze handle modulation
  const handleHandleChange = useCallback((val: number) => {
    setHandlePos(val);
    audioEngine.updateModulation({ handlePos: val });
  }, []);

  // Shake trigger
  const handleShakeTrigger = useCallback(() => {
    audioEngine.triggerShake(1.0);
  }, []);

  // Spacebar hotkey for shake
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        handleShakeTrigger();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleShakeTrigger]);

  const handleUpdateActivePreset = (updated: PresetConfig) => {
    const updatedPresets = pack.presets.map((p) =>
      p.pos === updated.pos ? updated : p
    );
    setPack({
      ...pack,
      presets: updatedPresets
    });
  };

  const handleImportJson = (rawJson: string) => {
    const parsed = parseConfigJson(rawJson);
    if (parsed.pack) {
      setPack(parsed.pack);
      setActiveSlot(0);
      showNotification('success', `Imported "${parsed.pack.name}" into editor.`);
    } else {
      showNotification('error', `Import error: ${parsed.error}`);
    }
  };

  const handleExportJson = () => {
    const jsonStr = serializeToConfigJson(pack);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'config.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('info', 'Downloaded config.json to your Mac.');
  };

  // ============================================================================
  // USB HARDWARE HANDLERS (FETCH, BACKUP, UPLOAD, EJECT)
  // ============================================================================

  const handleConnectMic = async () => {
    setIsSyncing(true);
    const res = await hardwareService.connectViaPicker();
    setIsSyncing(false);

    if (res.ok && res.status) {
      setHardwareStatus(res.status);
      setShowHardwareModal(true);
      showNotification(
        'success',
        `Connected to ${res.status.volumeName} (${Math.round(res.status.usedBytes / 1024)} KB used). Ready to fetch or upload!`
      );
    } else if (res.error && res.error !== 'Selection cancelled.') {
      setShowHardwareModal(true);
      showNotification('error', res.error);
    }
  };

  const handleFetchFromMic = async () => {
    setIsSyncing(true);
    const res = await hardwareService.fetchConfigFromMic();
    setIsSyncing(false);

    if (!res.ok || !res.rawJson) {
      showNotification('error', res.error || 'Could not read config.json from TINGDISK.');
      return;
    }

    const parsed = parseConfigJson(res.rawJson);
    if (!parsed.pack) {
      showNotification('error', `Mic config.json parse error: ${parsed.error}`);
      return;
    }

    // Save snapshot backup of what was fetched from the mic
    hardwareService.saveBackup(res.rawJson, 'MIC SNAPSHOT');
    setBackups(hardwareService.getBackups());

    setPack(parsed.pack);
    setActiveSlot(0);
    await refreshHardwareStatus();
    showNotification(
      'success',
      `Fetched "${parsed.pack.name}" from TINGDISK and saved a snapshot to Backup Vault!`
    );
  };

  const handleUploadToMic = async () => {
    // 1. Validate pack before writing to hardware
    const issues = validatePackConfig(pack);
    const errors = issues.filter((i) => i.type === 'error');
    if (errors.length > 0) {
      showNotification('error', `Cannot upload invalid config: ${errors[0].message}`);
      return;
    }

    setIsSyncing(true);
    const compiledJson = serializeToConfigJson(pack);
    const res = await hardwareService.uploadConfigToMic(compiledJson);
    setBackups(hardwareService.getBackups());
    await refreshHardwareStatus();
    setIsSyncing(false);

    if (res.ok) {
      showNotification(
        'success',
        `Uploaded "${pack.name}" to /Volumes/TINGDISK/config.json${
          res.backedUpPrevious ? ' (previous mic config auto-backed up)' : ''
        }! Eject TINGDISK to reboot mic.`
      );
    } else {
      showNotification('error', res.error || 'Failed to upload config.json to TINGDISK.');
    }
  };

  const handleCreateManualBackup = () => {
    const compiledJson = serializeToConfigJson(pack);
    const entry = hardwareService.saveBackup(compiledJson, 'MANUAL BACKUP');
    setBackups(hardwareService.getBackups());
    showNotification('success', `Saved backup of "${entry.packName}" to Backup Vault.`);
  };

  const handleEjectMic = async () => {
    setIsSyncing(true);
    const res = await hardwareService.ejectMicVolume();
    await refreshHardwareStatus();
    setIsSyncing(false);

    if (res.ok) {
      showNotification('success', res.message || 'TINGDISK safely ejected!');
    } else {
      showNotification('error', res.error || 'Could not eject TINGDISK.');
    }
  };

  const handleLoadBackupToEditor = (entry: ConfigBackupEntry) => {
    const parsed = parseConfigJson(entry.rawJson);
    if (parsed.pack) {
      setPack(parsed.pack);
      setActiveSlot(0);
      showNotification('success', `Loaded backup "${entry.packName}" into the editor!`);
    } else {
      showNotification('error', `Failed to parse backup: ${parsed.error}`);
    }
  };

  const handleRestoreBackupToMic = async (entry: ConfigBackupEntry) => {
    setIsSyncing(true);
    const res = await hardwareService.uploadConfigToMic(entry.rawJson);
    setBackups(hardwareService.getBackups());
    await refreshHardwareStatus();
    setIsSyncing(false);

    if (res.ok) {
      const parsed = parseConfigJson(entry.rawJson);
      if (parsed.pack) {
        setPack(parsed.pack);
        setActiveSlot(0);
      }
      showNotification(
        'success',
        `Restored "${entry.packName}" directly to TINGDISK/config.json!`
      );
    } else {
      showNotification('error', res.error || 'Failed to write backup to TINGDISK.');
    }
  };

  const handleDownloadBackup = (entry: ConfigBackupEntry) => {
    hardwareService.downloadBackupFile(entry);
    showNotification('info', `Downloaded backup file for "${entry.packName}".`);
  };

  const handleDeleteBackup = (id: string) => {
    const updated = hardwareService.deleteBackup(id);
    setBackups(updated);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-4 md:px-8 md:py-6 select-none font-sans">
      <div className="max-w-[1240px] w-full flex flex-col gap-5">
        {/* 1. TOP BANNER (Modular Badge, Live USB Status & Hardware Actions) */}
        <TopBanner
          packName={pack.name}
          onUpdatePackName={(name) => setPack({ ...pack, name })}
          onImportJson={handleImportJson}
          onExportJson={handleExportJson}
          hardwareStatus={hardwareStatus}
          backupCount={backups.length}
          isSyncing={isSyncing}
          onOpenHardwareModal={() => setShowHardwareModal(true)}
          onConnectMic={handleConnectMic}
          onFetchFromMic={handleFetchFromMic}
          onUploadToMic={handleUploadToMic}
        />

        {/* GLOBAL HARDWARE NOTIFICATION TOAST BAR */}
        {statusBanner && !showHardwareModal && (
          <div
            className={`w-full px-4 py-2 border border-[#141617] shadow-[2px_2px_0px_#141617] font-mono text-[11px] flex items-center justify-between gap-2 ${
              statusBanner.type === 'success'
                ? 'bg-[#e6f7f5] text-[#00665e]'
                : statusBanner.type === 'error'
                ? 'bg-[#fdecec] text-[#b91c1c]'
                : 'bg-[#fff8eb] text-[#92400e]'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#00a69c] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#f15a22] shrink-0" />
              )}
              <span className="font-bold">{statusBanner.message}</span>
            </div>
            <button
              onClick={() => setStatusBanner(null)}
              className="text-xs font-bold px-1 hover:opacity-70 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 2. MAIN TWO-COLUMN WORKBENCH DESK */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Hardware Mic Device + Compact Audition Player */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="flex flex-col items-center gap-3.5">
              <MicDevice
                activeSlot={activeSlot}
                onSelectSlot={setActiveSlot}
                handlePos={handlePos}
                onHandleChange={handleHandleChange}
                onShakeTrigger={handleShakeTrigger}
              />

              <AudioPlayerCompact />
            </div>

            {/* Minimalist [ HELP ] button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="mt-3 bg-[#ffffff] border border-[#141617] text-[10px] font-mono font-bold px-4 py-1 hover:bg-[#f5f5f5] shadow-[2px_2px_0px_#141617] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-1.5 transition-all cursor-pointer rounded-[0px]"
            >
              <HelpCircle className="w-3 h-3 text-[#73787a]" /> HELP
            </button>
          </div>

          {/* RIGHT COLUMN: Preset Details Ledger Sheet */}
          <div className="lg:col-span-7 flex flex-col items-center w-full">
            <PresetLedger
              preset={activePreset}
              totalPresets={pack.presets.length}
              onUpdatePreset={handleUpdateActivePreset}
              onSelectPreset={setActiveSlot}
            />
          </div>
        </div>
      </div>

      {/* USB HARDWARE SYNC & BACKUP VAULT MODAL */}
      <HardwareModal
        isOpen={showHardwareModal}
        onClose={() => setShowHardwareModal(false)}
        status={hardwareStatus}
        backups={backups}
        isBusy={isSyncing}
        statusBanner={statusBanner}
        onConnectMic={handleConnectMic}
        onRefreshStatus={refreshHardwareStatus}
        onFetchFromMic={handleFetchFromMic}
        onUploadToMic={handleUploadToMic}
        onCreateManualBackup={handleCreateManualBackup}
        onEjectMic={handleEjectMic}
        onLoadBackupToEditor={handleLoadBackupToEditor}
        onRestoreBackupToMic={handleRestoreBackupToMic}
        onDownloadBackup={handleDownloadBackup}
        onDeleteBackup={handleDeleteBackup}
      />

      {/* HELP & HARDWARE INSTRUCTIONS MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="te-ledger-card max-w-lg w-full bg-[#ffffff] p-6 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e2e4e2] pb-2.5">
              <span className="font-bold text-xs uppercase tracking-wider text-[#f15a22]">
                EP–2350 HARDWARE SETUP & GUIDE
              </span>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 text-[#141617] hover:text-[#f15a22]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[12px] leading-relaxed text-[#141617] flex flex-col gap-3">
              <div>
                <strong className="block text-[11px] uppercase tracking-wide text-[#73787a] mb-1">
                  1. Direct USB Sync on macOS (/Volumes/TINGDISK)
                </strong>
                <p className="text-[#333]">
                  Connect EP–2350 via USB-C and push the handle to power on. macOS mounts{' '}
                  <code className="bg-[#f0f2f0] px-1 py-0.5 border border-[#d2d5d2] font-mono text-[11px]">
                    /Volumes/TINGDISK
                  </code>{' '}
                  (1.0 MB FAT12). Click <strong>CONNECT MIC (USB)</strong> (or run locally for automatic detection) to <strong>Fetch</strong>, <strong>Backup</strong>, and <strong>Upload</strong> directly to the mic.
                </p>
              </div>

              <div>
                <strong className="block text-[11px] uppercase tracking-wide text-[#73787a] mb-1">
                  2. Applying Changes & Rebooting
                </strong>
                <p className="text-[#333]">
                  After clicking <strong>UPLOAD TO MIC</strong>, eject <code className="bg-[#f0f2f0] px-1 py-0.5 border border-[#d2d5d2] font-mono text-[11px]">TINGDISK</code>, press the power button above the USB-C port to turn it off, and squeeze the handle to start with your updated effects.
                </p>
              </div>

              <div>
                <strong className="block text-[11px] uppercase tracking-wide text-[#73787a] mb-1">
                  3. Emergency Recovery Mode
                </strong>
                <p className="text-[#333]">
                  If an invalid configuration prevents startup, hold the <strong>GREEN + WHITE</strong> buttons while starting to bypass <code className="bg-[#f0f2f0] px-1 py-0.5 border border-[#d2d5d2] font-mono text-[11px]">config.json</code> and restore from the <strong>Backup Vault</strong>.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#e2e4e2] flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="te-btn te-btn-orange text-xs py-1.5 px-4"
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
