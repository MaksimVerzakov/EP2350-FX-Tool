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
    <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4 py-2 select-none">
      {/* 1. Iconic TE Modular Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-stretch border-2 border-[#121212] shadow-[4px_4px_0px_rgba(0,0,0,0.2)]">
          {/* Orange EP Block */}
          <div className="bg-[#f15a22] px-3 py-1 flex items-center justify-center relative border-r-2 border-[#121212]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#18191a] absolute top-1 left-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#18191a] absolute bottom-1 left-1" />
            <span className="text-white font-mono font-bold text-2xl tracking-tighter pr-1">
              EP
            </span>
          </div>

          {/* Tool Block */}
          <div className="bg-[#dbdddb] px-3 py-1 flex flex-col justify-center relative">
            <span className="w-1.5 h-1.5 rounded-full bg-[#18191a] absolute top-1 right-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#18191a] absolute bottom-1 right-1" />
            <span className="text-[11px] font-mono font-bold tracking-widest text-[#18191a] leading-none uppercase">
              FX TOOL
            </span>
            <span className="text-[8px] font-mono text-[#656d73] tracking-wider leading-none mt-1">
              EP–2350 COMPANION
            </span>
          </div>
        </div>

        <span className="text-[10px] font-mono text-[#4e5559] font-semibold">
          v 1.0.0
        </span>
      </div>

      {/* 2. Hanging USB Cable Element (from ep-sample-tool design) */}
      <div className="hidden lg:flex flex-col items-center relative -mt-3">
        <div className="w-2 h-7 bg-[#121212]" />
        <div className="bg-[#f15a22] text-black text-[8px] font-mono font-bold px-2 py-0.5 border border-[#121212] tracking-wider shadow-sm">
          USB: FX-MIC DISK
        </div>
        <div className="w-3.5 h-4 bg-[#dbdddb] border-2 border-[#121212] rounded-b-sm" />
      </div>

      {/* 3. Pack Name Input & Actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-[#dbdddb] px-2 py-1 border-2 border-[#121212] shadow-[2px_2px_0px_rgba(0,0,0,0.15)]">
          <span className="text-[9px] font-mono font-bold text-[#656d73]">PACK:</span>
          <input
            type="text"
            value={packName}
            onChange={(e) => onUpdatePackName(e.target.value.toUpperCase())}
            className="bg-[#18191a] text-white px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase border border-[#000] focus:outline-none focus:ring-1 focus:ring-[#f15a22] max-w-[150px]"
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
