import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, ChevronDown, Check } from 'lucide-react';
import { OFFICIAL_TE_PACKS, OfficialPackPreset } from '../constants/defaultPresets';

interface TopBannerProps {
  packName: string;
  onUpdatePackName: (name: string) => void;
  onSelectDefaultPack: (presetPack: OfficialPackPreset) => void;
  onImportJson: (json: string) => void;
  onExportJson: () => void;
}

export const TopBanner: React.FC<TopBannerProps> = ({
  packName,
  onUpdatePackName,
  onSelectDefaultPack,
  onImportJson,
  onExportJson
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Close pack dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

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

        <span className="text-[10px] font-mono text-[#73787a]">
          v 1.0.0
        </span>
      </div>

      {/* 2. Pack Name Combo Input (Editable Name + Default Pack Dropdown) & Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div ref={dropdownRef} className="relative">
          <div className="flex items-center bg-[#ffffff] pl-2 pr-1 py-1 border border-[#141617] shadow-[1px_1px_0px_#141617]">
            <span className="text-[9px] font-mono font-bold text-[#73787a] mr-1.5">
              PACK:
            </span>
            <div className="flex items-stretch bg-[#141617]">
              <input
                type="text"
                value={packName}
                onChange={(e) => onUpdatePackName(e.target.value.toUpperCase())}
                className="bg-[#141617] text-white px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase border-0 focus:outline-none focus:ring-1 focus:ring-[#f15a22] w-[165px]"
                placeholder="PACK NAME"
                maxLength={24}
              />
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="px-1.5 bg-[#232628] hover:bg-[#f15a22] text-white border-l border-white/20 flex items-center justify-center transition-colors cursor-pointer"
                title="Select an official Teenage Engineering preset pack"
                aria-label="Select default pack"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Official TE Packs Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-72 bg-white border border-[#141617] shadow-[4px_4px_0px_#141617] p-2 z-50 flex flex-col gap-1">
              <div className="flex items-center justify-between border-b border-[#e2e4e2] pb-1 mb-0.5 px-1">
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#f15a22]">
                  OFFICIAL TE PRESET PACKS
                </span>
                <span className="font-mono text-[8px] text-[#73787a]">
                  LOAD DEFAULTS
                </span>
              </div>

              {OFFICIAL_TE_PACKS.map((item) => {
                const isSelected = packName.trim().toUpperCase() === item.name.toUpperCase();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectDefaultPack(item);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-[1px] transition-colors cursor-pointer flex flex-col gap-0.5 group ${
                      isSelected
                        ? 'bg-[#141617] text-white'
                        : 'hover:bg-[#f15a22] hover:text-white text-[#141617]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10.5px] font-bold uppercase tracking-wide">
                        {item.name}
                      </span>
                      {isSelected && (
                        <Check className="w-3 h-3 text-[#f15a22] group-hover:text-white shrink-0" />
                      )}
                    </div>
                    <span
                      className={`font-mono text-[8px] uppercase truncate ${
                        isSelected
                          ? 'text-white/70'
                          : 'text-[#73787a] group-hover:text-white/85'
                      }`}
                    >
                      {item.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
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
          title="Import config.json from TINGDISK"
        >
          <Upload className="w-3 h-3" /> IMPORT
        </button>

        <button
          onClick={onExportJson}
          className="te-btn te-btn-orange text-[10px]"
          title="Export valid config.json to TINGDISK"
        >
          <Download className="w-3 h-3" /> EXPORT CONFIG.JSON
        </button>
      </div>
    </div>
  );
};
