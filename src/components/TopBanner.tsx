import React, { useRef } from 'react';
import { Download, Upload, Usb, DownloadCloud, UploadCloud, Archive } from 'lucide-react';
import { HardwareStatus } from '../utils/hardwareService';

interface TopBannerProps {
  packName: string;
  onUpdatePackName: (name: string) => void;
  onImportJson: (json: string) => void;
  onExportJson: () => void;
  hardwareStatus: HardwareStatus;
  backupCount: number;
  isSyncing: boolean;
  onOpenHardwareModal: () => void;
  onConnectMic: () => void;
  onFetchFromMic: () => void;
  onUploadToMic: () => void;
}

export const TopBanner: React.FC<TopBannerProps> = ({
  packName,
  onUpdatePackName,
  onImportJson,
  onExportJson,
  hardwareStatus,
  backupCount,
  isSyncing,
  onOpenHardwareModal,
  onConnectMic,
  onFetchFromMic,
  onUploadToMic
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) onImportJson(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const usedKb = Math.round(hardwareStatus.usedBytes / 1024);
  const totalKb = Math.round(hardwareStatus.totalBytes / 1024);

  return (
    <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-3 py-2 border-b border-[#dfe2e0] pb-3 select-none">
      {/* 1. Iconic TE Modular Badge + Live USB Hardware Status */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <div className="flex items-stretch border border-[#141617] shadow-[2px_2px_0px_#141617]">
          {/* Orange EP Block */}
          <div className="w-12 h-10 bg-[#f15a22] flex items-center justify-center relative border-r border-[#141617]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#141617] absolute top-1.5 left-1.5" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#141617] absolute bottom-1.5 left-1.5" />
            <span className="text-white font-mono font-bold text-lg tracking-tighter">
              EP
            </span>
          </div>

          {/* Tool Block */}
          <div className="bg-[#ffffff] px-3 py-1 flex flex-col justify-center relative">
            <span className="w-1.5 h-1.5 rounded-full bg-[#141617] absolute top-1.5 right-1.5" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#141617] absolute bottom-1.5 right-1.5" />
            <span className="text-[11px] font-bold tracking-widest text-[#141617] leading-none uppercase">
              FX TOOL
            </span>
            <span className="text-[8px] font-mono text-[#73787a] tracking-wider leading-none mt-1">
              EP–2350 COMPANION
            </span>
          </div>
        </div>

        {/* Live USB Hardware Pill */}
        <button
          onClick={hardwareStatus.connected ? onOpenHardwareModal : onConnectMic}
          className={`flex items-center gap-2 px-2.5 py-1.5 border border-[#141617] shadow-[2px_2px_0px_#141617] font-mono text-[10px] font-bold uppercase cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
            hardwareStatus.connected
              ? 'bg-[#141617] text-white hover:bg-[#232628]'
              : 'bg-[#ffffff] text-[#141617] hover:bg-[#f5f5f5]'
          }`}
          title={
            hardwareStatus.connected
              ? `Connected to ${hardwareStatus.mountPath || '/Volumes/TINGDISK'} (${usedKb}KB / ${totalKb}KB). Click to open Hardware & Backup Vault.`
              : 'Connect to mounted /Volumes/TINGDISK on macOS'
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${
              hardwareStatus.connected
                ? 'bg-[#00a69c] shadow-[0_0_6px_#00a69c]'
                : 'bg-[#989fa5]'
            }`}
          />
          <Usb className="w-3 h-3 text-[#f15a22]" />
          <span>
            {hardwareStatus.connected
              ? `${hardwareStatus.volumeName} (${usedKb}/${totalKb}KB)`
              : 'CONNECT MIC (USB)'}
          </span>
        </button>
      </div>

      {/* 2. Pack Name Input & Direct Hardware + File Actions */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-1.5 bg-[#ffffff] px-2 py-1 border border-[#141617] shadow-[1px_1px_0px_#141617]">
          <span className="text-[9px] font-mono font-bold text-[#73787a]">PACK:</span>
          <input
            type="text"
            value={packName}
            onChange={(e) => onUpdatePackName(e.target.value.toUpperCase())}
            className="bg-[#141617] text-white px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase border-0 focus:outline-none focus:ring-1 focus:ring-[#f15a22] max-w-[145px]"
            placeholder="PACK NAME"
            maxLength={20}
          />
        </div>

        {/* Direct 1-Click Mic Sync Buttons when connected */}
        {hardwareStatus.connected && (
          <>
            <button
              onClick={onFetchFromMic}
              disabled={isSyncing}
              className="te-btn bg-[#141617] text-white text-[10px] py-1 px-2.5"
              title="Fetch current config.json from TINGDISK and save a safety backup"
            >
              <DownloadCloud className="w-3 h-3 text-[#00a69c]" /> FETCH MIC
            </button>

            <button
              onClick={onUploadToMic}
              disabled={isSyncing}
              className="te-btn te-btn-orange text-[10px] py-1 px-2.5"
              title="Backup mic's current config.json and write updated config directly to TINGDISK"
            >
              <UploadCloud className="w-3 h-3" /> UPLOAD TO MIC
            </button>
          </>
        )}

        {/* Backups & Hardware Vault Button */}
        <button
          onClick={onOpenHardwareModal}
          className="te-btn bg-white text-[#141617] text-[10px] py-1 px-2.5"
          title="Open USB Hardware Inspector & Config Backup Vault"
        >
          <Archive className="w-3 h-3 text-[#f15a22]" /> BACKUPS ({backupCount})
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="te-btn bg-white text-[#141617] text-[10px] py-1 px-2.5"
          title="Import config.json from computer"
        >
          <Upload className="w-3 h-3" /> IMPORT
        </button>

        <button
          onClick={onExportJson}
          className={`te-btn text-[10px] py-1 px-2.5 ${
            hardwareStatus.connected ? 'bg-[#232424] text-white' : 'te-btn-orange'
          }`}
          title="Download config.json file"
        >
          <Download className="w-3 h-3" /> EXPORT .JSON
        </button>
      </div>
    </div>
  );
};
