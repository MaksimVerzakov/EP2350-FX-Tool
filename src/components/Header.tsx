import React, { useRef } from 'react';
import { Download, Upload, RotateCcw, HardDrive } from 'lucide-react';
import { PackConfig } from '../types/config';

interface HeaderProps {
  pack: PackConfig;
  onUpdatePack: (pack: PackConfig) => void;
  onImportJson: (json: string) => void;
  onExportJson: () => void;
  onResetDefault: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pack,
  onUpdatePack,
  onImportJson,
  onExportJson,
  onResetDefault
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
    e.target.value = ''; // reset
  };

  // Estimate total sample size (max 1 MB = 1048576 bytes)
  const totalBytes = pack.samples.reduce((acc, s) => acc + (s.sizeBytes || (pack.useBuiltInSamples ? 0 : 120000)), 0);
  const maxBytes = 1048576; // 1 MB
  const pctUsed = Math.min(100, Math.round((totalBytes / maxBytes) * 100));

  return (
    <header className="te-chassis-panel p-4 border-b-2 border-[#121212] relative select-none">
      {/* 4 Corner Hardware Screws */}
      <span className="te-screw absolute top-2 left-2" />
      <span className="te-screw absolute top-2 right-2" />
      <span className="te-screw absolute bottom-2 left-2" />
      <span className="te-screw absolute bottom-2 right-2" />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-3">
        {/* Logo & Model */}
        <div className="flex items-center gap-3">
          <div className="bg-[#000005] px-2 py-1 border border-[#222]">
            <span className="text-[#f15a22] font-mono font-bold text-xs tracking-widest te-lcd-glow-orange">
              EP–2350
            </span>
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-wider text-[#18191a] uppercase">
              FX MIC CONFIG TOOL
            </h1>
            <p className="text-[9px] font-mono text-[#656d73]">
              TEENAGE ENGINEERING // CHAPTER 7 SPEC COMPLIANT
            </p>
          </div>
        </div>

        {/* Pack Name Field & Built-in toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold text-[#656d73]">PACK:</span>
            <input
              type="text"
              value={pack.name}
              onChange={(e) => onUpdatePack({ ...pack, name: e.target.value.toUpperCase() })}
              className="te-label-tape bg-[#18191a] text-white px-2 py-1 font-mono text-[11px] font-bold tracking-wider uppercase border border-[#000] focus:outline-none focus:ring-1 focus:ring-[#f15a22]"
              placeholder="PACK NAME"
              maxLength={24}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-[#c8cbc8] px-2 py-1 border border-[#18191a] text-[10px] font-mono font-bold">
            <input
              type="checkbox"
              checked={pack.useBuiltInSamples}
              onChange={(e) => onUpdatePack({ ...pack, useBuiltInSamples: e.target.checked })}
              className="accent-[#f15a22]"
            />
            <span>USE BUILT-IN SAMPLES (OMIT "SAMPLES" BLOCK)</span>
          </label>
        </div>

        {/* Memory Meter & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Storage Meter */}
          <div className="flex items-center gap-2 bg-[#000005] px-2.5 py-1.5 border border-[#18191a]">
            <HardDrive className="w-3.5 h-3.5 text-[#00a69c]" />
            <div className="flex flex-col">
              <div className="flex justify-between text-[8px] font-mono text-[#818e95] gap-2">
                <span>STORAGE</span>
                <span className="text-[#00a69c] font-bold te-lcd-glow">
                  {pack.useBuiltInSamples ? 'INTERNAL (1MB FREE)' : `${pctUsed}% / 1MB`}
                </span>
              </div>
              <div className="w-24 h-1.5 bg-[#222] overflow-hidden mt-0.5 border border-[#333]">
                <div
                  className={`h-full ${pctUsed > 90 ? 'bg-[#f15a22]' : 'bg-[#00a69c]'}`}
                  style={{ width: `${pack.useBuiltInSamples ? 0 : pctUsed}%` }}
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="te-btn te-btn-secondary"
              title="Import existing config.json"
            >
              <Upload className="w-3 h-3" /> IMPORT
            </button>

            <button
              onClick={onExportJson}
              className="te-btn te-btn-orange"
              title="Export valid config.json to fx-mic disk"
            >
              <Download className="w-3 h-3" /> EXPORT CONFIG.JSON
            </button>

            <button
              onClick={onResetDefault}
              className="te-btn text-[#818e95] hover:text-white"
              title="Reset all presets to factory defaults"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
