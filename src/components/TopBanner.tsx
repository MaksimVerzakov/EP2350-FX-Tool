import React, { useRef } from 'react';
import { Download, Upload } from 'lucide-react';

interface TopBannerProps {
  packName: string;
  onUpdatePackName: (name: string) => void;
  onImportJson: (json: string) => void;
  onExportJson: () => void;
}

export const TopBanner: React.FC<TopBannerProps> = ({
  packName,
  onUpdatePackName,
  onImportJson,
  onExportJson
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

  return (
    <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4 py-2 border-b border-[#dfe2e0] pb-3 select-none">
      {/* 1. Iconic TE Modular Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-stretch border border-[#141617] shadow-xs">
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

        <span className="text-[10px] font-mono text-[#73787a]">
          v 1.0.0
        </span>
      </div>

      {/* 2. Connection Status Indicator */}
      <div className="hidden lg:flex items-center gap-2 bg-[#ffffff] border border-[#d2d5d2] px-3 py-1 text-[10px] font-mono shadow-2xs">
        <span className="w-2 h-2 rounded-full bg-[#00a69c] shadow-[0_0_5px_#00a69c]" />
        <span className="text-[#141617] font-semibold">USB: FX-MIC DISK READY</span>
      </div>

      {/* 3. Pack Name Input & Actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-[#ffffff] px-2 py-1 border border-[#141617] shadow-2xs">
          <span className="text-[9px] font-mono font-bold text-[#73787a]">PACK:</span>
          <input
            type="text"
            value={packName}
            onChange={(e) => onUpdatePackName(e.target.value.toUpperCase())}
            className="bg-[#141617] text-white px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase border-0 focus:outline-none focus:ring-1 focus:ring-[#f15a22] max-w-[150px]"
            placeholder="PACK NAME"
            maxLength={20}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="te-btn te-btn-secondary text-[10px]"
          title="Import config.json"
        >
          <Upload className="w-3 h-3" /> IMPORT
        </button>

        <button
          onClick={onExportJson}
          className="te-btn te-btn-orange text-[10px]"
          title="Export valid config.json to fx-mic disk"
        >
          <Download className="w-3 h-3" /> EXPORT CONFIG.JSON
        </button>
      </div>
    </div>
  );
};
