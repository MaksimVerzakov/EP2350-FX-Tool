import React from 'react';
import {
  HardDrive,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Archive,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Usb,
  LogOut,
  FileAudio,
  FileCode,
  X
} from 'lucide-react';
import { ConfigBackupEntry, HardwareStatus } from '../utils/hardwareService';

interface HardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: HardwareStatus;
  backups: ConfigBackupEntry[];
  isBusy: boolean;
  statusBanner: { type: 'success' | 'error' | 'info'; message: string } | null;
  onConnectMic: () => void;
  onRefreshStatus: () => void;
  onFetchFromMic: () => void;
  onUploadToMic: () => void;
  onCreateManualBackup: () => void;
  onEjectMic: () => void;
  onLoadBackupToEditor: (entry: ConfigBackupEntry) => void;
  onRestoreBackupToMic: (entry: ConfigBackupEntry) => void;
  onDownloadBackup: (entry: ConfigBackupEntry) => void;
  onDeleteBackup: (id: string) => void;
}

export const HardwareModal: React.FC<HardwareModalProps> = ({
  isOpen,
  onClose,
  status,
  backups,
  isBusy,
  statusBanner,
  onConnectMic,
  onRefreshStatus,
  onFetchFromMic,
  onUploadToMic,
  onCreateManualBackup,
  onEjectMic,
  onLoadBackupToEditor,
  onRestoreBackupToMic,
  onDownloadBackup,
  onDeleteBackup
}) => {
  if (!isOpen) return null;

  const usedKb = Math.round(status.usedBytes / 1024);
  const totalKb = Math.round(status.totalBytes / 1024);
  const freeKb = Math.round(status.freeBytes / 1024);
  const usagePct = Math.min(100, Math.round((status.usedBytes / Math.max(1, status.totalBytes)) * 100));

  const visibleFiles = status.files.filter((f) => !f.isHidden && f.name !== 'System Volume Information');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 select-none font-sans">
      <div className="te-ledger-card max-w-2xl w-full bg-[#ffffff] border-2 border-[#141617] shadow-[6px_6px_0px_#141617] flex flex-col max-h-[88vh] overflow-hidden">
        {/* 1. MODAL HEADER */}
        <div className="bg-[#141617] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#141617] shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status.connected
                  ? 'bg-[#00a69c] shadow-[0_0_8px_#00a69c]'
                  : 'bg-[#f15a22]'
              }`}
            />
            <span className="font-mono text-xs font-bold tracking-wider uppercase">
              EP–2350 USB HARDWARE LINK & BACKUP VAULT (macOS)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/70 hover:text-[#f15a22] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STATUS FEEDBACK BANNER */}
        {statusBanner && (
          <div
            className={`px-4 py-2 border-b border-[#141617] font-mono text-[11px] flex items-center gap-2 shrink-0 ${
              statusBanner.type === 'success'
                ? 'bg-[#e6f7f5] text-[#00665e]'
                : statusBanner.type === 'error'
                ? 'bg-[#fdecec] text-[#b91c1c]'
                : 'bg-[#fff8eb] text-[#92400e]'
            }`}
          >
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#00a69c] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#f15a22] shrink-0" />
            )}
            <span className="font-bold">{statusBanner.message}</span>
          </div>
        )}

        {/* SCROLLABLE BODY */}
        <div className="p-4 overflow-y-auto flex flex-col gap-5">
          {/* 2. HARDWARE CONNECTION & TINGDISK TELEMETRY */}
          <div className="border border-[#141617] bg-[#f8f9f8] p-3.5 shadow-[2px_2px_0px_#141617] flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dfe2e0] pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#141617] text-white flex items-center justify-center">
                  <HardDrive className="w-4 h-4 text-[#f15a22]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase text-[#141617]">
                      {status.connected ? status.volumeName : 'TINGDISK NOT CONNECTED'}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase ${
                        status.connected
                          ? 'bg-[#00a69c] text-white'
                          : 'bg-[#d2d5d2] text-[#141617]'
                      }`}
                    >
                      {status.connected
                        ? status.mode === 'macos-bridge'
                          ? 'MOUNTED (/Volumes/TINGDISK)'
                          : 'MOUNTED (BROWSER FS ACCESS)'
                        : 'OFFLINE'}
                    </span>
                  </div>
                  <span className="block font-mono text-[10px] text-[#73787a] mt-0.5">
                    {status.connected
                      ? `${status.mountPath || '/Volumes/TINGDISK'} · FAT12 (4KB clusters)${
                          status.serialPort ? ` · ${status.serialPort}` : ''
                        }`
                      : 'Plug in EP–2350 via USB-C and squeeze handle to mount /Volumes/TINGDISK on macOS'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={onRefreshStatus}
                  disabled={isBusy}
                  className="te-btn bg-white text-[#141617] text-[10px] py-1 px-2.5"
                  title="Rescan /Volumes/TINGDISK"
                >
                  <RefreshCw className={`w-3 h-3 text-[#141617] ${isBusy ? 'animate-spin' : ''}`} />
                </button>
                {!status.connected ? (
                  <button
                    onClick={onConnectMic}
                    disabled={isBusy}
                    className="te-btn te-btn-orange text-[10px] py-1 px-3"
                  >
                    <Usb className="w-3.5 h-3.5" /> SELECT /Volumes/TINGDISK
                  </button>
                ) : (
                  <button
                    onClick={onEjectMic}
                    disabled={isBusy}
                    className="te-btn bg-[#232424] text-white text-[10px] py-1 px-2.5"
                    title="Safely eject TINGDISK to apply changes and reboot mic"
                  >
                    <LogOut className="w-3 h-3" /> EJECT DISK
                  </button>
                )}
              </div>
            </div>

            {/* 1.0 MB HARDWARE FLASH STORAGE METER */}
            {status.connected && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="font-bold text-[#141617] uppercase">
                    RP2350 FLASH STORAGE ({usedKb} KB / {totalKb} KB USED)
                  </span>
                  <span className="text-[#00a69c] font-bold">
                    {freeKb} KB FREE ({100 - usagePct}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-[#e2e4e2] border border-[#141617] overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-300 ${
                      usagePct > 90 ? 'bg-[#e52817]' : 'bg-[#00a69c]'
                    }`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>

                {/* Files currently on TINGDISK */}
                {visibleFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {visibleFiles.map((f) => (
                      <span
                        key={f.name}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-[#c5c8c5] font-mono text-[9.5px] text-[#141617]"
                      >
                        {f.isWav ? (
                          <FileAudio className="w-3 h-3 text-[#f15a22]" />
                        ) : (
                          <FileCode className="w-3 h-3 text-[#00a69c]" />
                        )}
                        <strong className="font-bold">{f.name}</strong>
                        <span className="text-[#73787a]">
                          ({(f.size / 1024).toFixed(1)} KB)
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DIRECT MIC SYNC ACTIONS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                onClick={onFetchFromMic}
                disabled={!status.connected || isBusy}
                className="te-btn bg-[#141617] text-white text-[10px] py-2 px-3 disabled:opacity-40 disabled:pointer-events-none justify-center"
                title="Read config.json from TINGDISK into the editor and save a safety snapshot"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-[#00a69c]" />
                1. FETCH FROM MIC
              </button>

              <button
                onClick={onCreateManualBackup}
                disabled={isBusy}
                className="te-btn bg-white text-[#141617] text-[10px] py-2 px-3 disabled:opacity-40 disabled:pointer-events-none justify-center"
                title="Save a snapshot of current config into the Backup Vault"
              >
                <Archive className="w-3.5 h-3.5 text-[#f15a22]" />
                2. BACKUP CONFIG
              </button>

              <button
                onClick={onUploadToMic}
                disabled={!status.connected || isBusy}
                className="te-btn te-btn-orange text-[10px] py-2 px-3 disabled:opacity-40 disabled:pointer-events-none justify-center"
                title="Auto-backup current mic config and write updated config.json directly to TINGDISK"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                3. UPLOAD TO MIC
              </button>
            </div>
          </div>

          {/* 3. BACKUP VAULT & VERSION HISTORY */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-[#141617] pb-1.5">
              <div className="flex items-center gap-2">
                <Archive className="w-3.5 h-3.5 text-[#f15a22]" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#141617]">
                  CONFIG BACKUP VAULT ({backups.length})
                </span>
              </div>
              <span className="font-mono text-[9.5px] text-[#73787a]">
                Auto-saves before every upload & fetch
              </span>
            </div>

            <div className="flex flex-col gap-2 max-h-[270px] overflow-y-auto pr-1">
              {backups.map((bkp) => {
                const dateStr = new Date(bkp.timestamp).toLocaleString([], {
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                const badgeColor =
                  bkp.label === 'MIC SNAPSHOT'
                    ? 'bg-[#00a69c] text-white'
                    : bkp.label === 'PRE-UPLOAD AUTO-BACKUP'
                    ? 'bg-[#f15a22] text-white'
                    : bkp.label === 'FACTORY / MIC BASELINE'
                    ? 'bg-[#141617] text-white'
                    : 'bg-[#e4e3df] text-[#141617] border border-[#141617]';

                return (
                  <div
                    key={bkp.id}
                    className="border border-[#141617] bg-white p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-[1px_1px_0px_#141617]"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-[8.5px] font-bold px-1.5 py-0.5 uppercase ${badgeColor}`}>
                          {bkp.label}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#141617] uppercase truncate">
                          {bkp.packName}
                        </span>
                        <span className="font-mono text-[9.5px] text-[#73787a]">
                          {dateStr} · {(bkp.sizeBytes / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <div className="font-mono text-[9.5px] text-[#555] truncate">
                        {bkp.presetNames.map((n, i) => `${i + 1}:${n}`).join(' · ')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onLoadBackupToEditor(bkp)}
                        className="px-2 py-1 bg-[#f0f2f0] hover:bg-[#141617] hover:text-white text-[#141617] border border-[#141617] font-mono text-[9.5px] font-bold uppercase transition-colors cursor-pointer"
                        title="Load this backup into the editor workbench"
                      >
                        LOAD IN EDITOR
                      </button>

                      {status.connected && (
                        <button
                          onClick={() => onRestoreBackupToMic(bkp)}
                          disabled={isBusy}
                          className="px-2 py-1 bg-[#f15a22] hover:bg-[#d14612] text-white border border-[#141617] font-mono text-[9.5px] font-bold uppercase transition-colors cursor-pointer"
                          title="Write this backup directly to TINGDISK/config.json"
                        >
                          WRITE TO MIC
                        </button>
                      )}

                      <button
                        onClick={() => onDownloadBackup(bkp)}
                        className="px-2 py-1 bg-white hover:bg-[#eceeed] text-[#141617] border border-[#141617] font-mono text-[9.5px] font-bold uppercase transition-colors cursor-pointer"
                        title="Download backup .json file to your Mac"
                      >
                        .JSON
                      </button>

                      <button
                        onClick={() => onDeleteBackup(bkp.id)}
                        className="p-1 text-[#73787a] hover:text-[#e52817] transition-colors cursor-pointer"
                        title="Delete backup"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. MACOS HARDWARE NOTES */}
          <div className="bg-[#f0f2f0] border border-[#c5c8c5] p-2.5 font-mono text-[10px] text-[#333] leading-relaxed">
            <strong className="text-[#141617] uppercase block mb-0.5">
              macOS TINGDISK Workflow Notes:
            </strong>
            1. When connected via USB-C with the handle pressed, EP–2350 mounts at{' '}
            <code className="bg-white px-1 border border-[#c5c8c5]">/Volumes/TINGDISK</code> (1.0 MB FAT12).
            <br />
            2. Clicking <strong>UPLOAD TO MIC</strong> automatically backs up the mic&apos;s current{' '}
            <code className="bg-white px-1 border border-[#c5c8c5]">config.json</code>, writes your new config, and cleans macOS{' '}
            <code className="bg-white px-1 border border-[#c5c8c5]">._config.json</code> metadata files.
            <br />
            3. Click <strong>EJECT DISK</strong> (or eject in Finder), then press the power button above the USB-C port and squeeze the handle to reboot with your new effects.
          </div>
        </div>
      </div>
    </div>
  );
};
