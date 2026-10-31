import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, ChevronDown, Check } from 'lucide-react';
import { OFFICIAL_TE_PACKS, OfficialPackPreset } from '../constants/defaultPresets';
import { ThemeMode } from '../types/config';

interface TopBannerProps {
  packName: string;
  onUpdatePackName: (name: string) => void;
  onSelectDefaultPack: (presetPack: OfficialPackPreset) => void;
  onImportJson: (json: string) => void;
  onExportJson: () => void;
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
}

export const TopBanner: React.FC<TopBannerProps> = ({
  packName,
  onUpdatePackName,
  onSelectDefaultPack,
  onImportJson,
  onExportJson,
  theme,
  onChangeTheme
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isTing = theme === 'ting';

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
    <div
      className={`w-full flex flex-col md:flex-row items-center justify-between gap-4 py-2 border-b pb-3 select-none transition-colors ${
        isTing ? 'border-[#00503a]/30' : 'border-[#dfe2e0]'
      }`}
    >
      {/* 1. Iconic TE Modular Badge */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-stretch border ${
            isTing
              ? 'border-[#00503a] shadow-[2px_2px_0px_#003828]'
              : 'border-[#141617] shadow-[2px_2px_0px_#141617]'
          }`}
        >
          {/* Orange EP Block */}
          <div
            className={`w-12 h-10 flex items-center justify-center relative border-r ${
              isTing
                ? 'bg-[#ff681d] border-[#00503a]'
                : 'bg-[#f15a22] border-[#141617]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full absolute top-1.5 left-1.5 ${
                isTing ? 'bg-[#00503a]' : 'bg-[#141617]'
              }`}
            />
            <span
              className={`w-1.5 h-1.5 rounded-full absolute bottom-1.5 left-1.5 ${
                isTing ? 'bg-[#00503a]' : 'bg-[#141617]'
              }`}
            />
            <span className="text-white font-mono font-bold text-lg tracking-tighter">
              EP
            </span>
          </div>

          {/* Tool Block */}
          <div
            className={`px-3 py-1 flex flex-col justify-center relative ${
              isTing ? 'bg-[#e8e9e4]' : 'bg-[#ffffff]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full absolute top-1.5 right-1.5 ${
                isTing ? 'bg-[#00503a]' : 'bg-[#141617]'
              }`}
            />
            <span
              className={`w-1.5 h-1.5 rounded-full absolute bottom-1.5 right-1.5 ${
                isTing ? 'bg-[#00503a]' : 'bg-[#141617]'
              }`}
            />
            <span
              className={`text-[11px] font-bold tracking-widest leading-none uppercase ${
                isTing ? 'text-[#00503a]' : 'text-[#141617]'
              }`}
            >
              {isTing ? 'TING FX TOOL' : 'FX TOOL'}
            </span>
            <span
              className={`text-[8px] font-mono tracking-wider leading-none mt-1 ${
                isTing ? 'text-[#4b6b5d]' : 'text-[#73787a]'
              }`}
            >
              EP–2350 COMPANION
            </span>
          </div>
        </div>

        <span
          className={`text-[10px] font-mono ${
            isTing ? 'text-[#00503a]/75' : 'text-[#73787a]'
          }`}
        >
          v {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
        </span>
      </div>

      {/* 2. Theme Selector, Pack Name Combo Input & Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* Hardware Theme Selector (FX / TING) */}
        <div
          className={`flex items-center pl-2 pr-1 py-1 border ${
            isTing
              ? 'bg-[#e8e9e4] border-[#00503a] shadow-[1px_1px_0px_#003828]'
              : 'bg-[#ffffff] border-[#141617] shadow-[1px_1px_0px_#141617]'
          }`}
          role="group"
          aria-label="Theme selector"
        >
          <span
            className={`text-[9px] font-mono font-bold mr-1.5 uppercase ${
              isTing ? 'text-[#00503a]' : 'text-[#73787a]'
            }`}
          >
            THEME:
          </span>
          <div
            className={`flex items-stretch border p-0.5 gap-0.5 ${
              isTing
                ? 'bg-[#dbd0b9] border-[#00503a]'
                : 'bg-[#e5e6e6] border-[#141617]'
            }`}
          >
            <button
              type="button"
              onClick={() => onChangeTheme('fx')}
              className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                !isTing
                  ? 'bg-[#141617] text-white shadow-[1px_1px_0px_#000000]'
                  : 'text-[#00503a]/70 hover:text-[#00503a] hover:bg-white/40'
              }`}
              title="FX Theme (EP–2350 FX Grey & Orange)"
            >
              <span className="w-2 h-2 rounded-full bg-[#818e95] border border-black/60 shrink-0" />
              <span>FX</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTheme('ting')}
              className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                isTing
                  ? 'bg-[#00503a] text-[#e8e9e4] shadow-[1px_1px_0px_#00291d]'
                  : 'text-[#141617]/70 hover:text-[#141617] hover:bg-white/60'
              }`}
              title="Ting Theme (Original EP–2350 Ting Sand, Green & Orange)"
            >
              <span className="w-2 h-2 rounded-full bg-[#ff681d] border border-[#00503a] shrink-0" />
              <span>TING</span>
            </button>
          </div>
        </div>

        {/* Pack Selector */}
        <div ref={dropdownRef} className="relative">
          <div
            className={`flex items-center pl-2 pr-1 py-1 border ${
              isTing
                ? 'bg-[#e8e9e4] border-[#00503a] shadow-[1px_1px_0px_#003828]'
                : 'bg-[#ffffff] border-[#141617] shadow-[1px_1px_0px_#141617]'
            }`}
          >
            <span
              className={`text-[9px] font-mono font-bold mr-1.5 ${
                isTing ? 'text-[#00503a]' : 'text-[#73787a]'
              }`}
            >
              PACK:
            </span>
            <div
              className={`flex items-stretch ${
                isTing ? 'bg-[#00503a]' : 'bg-[#141617]'
              }`}
            >
              <input
                type="text"
                value={packName}
                onChange={(e) => onUpdatePackName(e.target.value.toUpperCase())}
                className={`text-white px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase border-0 focus:outline-none focus:ring-1 w-[165px] ${
                  isTing
                    ? 'bg-[#00503a] focus:ring-[#ff681d]'
                    : 'bg-[#141617] focus:ring-[#f15a22]'
                }`}
                placeholder="PACK NAME"
                maxLength={24}
              />
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className={`px-1.5 text-white border-l border-white/20 flex items-center justify-center transition-colors cursor-pointer ${
                  isTing
                    ? 'bg-[#003d2c] hover:bg-[#ff681d]'
                    : 'bg-[#232628] hover:bg-[#f15a22]'
                }`}
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
            <div
              className={`absolute right-0 mt-1.5 w-72 border p-2 z-50 flex flex-col gap-1 ${
                isTing
                  ? 'bg-[#f7f5ef] border-[#00503a] shadow-[4px_4px_0px_#003828]'
                  : 'bg-white border-[#141617] shadow-[4px_4px_0px_#141617]'
              }`}
            >
              <div
                className={`flex items-center justify-between border-b pb-1 mb-0.5 px-1 ${
                  isTing ? 'border-[#00503a]/20' : 'border-[#e2e4e2]'
                }`}
              >
                <span
                  className={`font-mono text-[9px] font-bold uppercase tracking-wider ${
                    isTing ? 'text-[#ff681d]' : 'text-[#f15a22]'
                  }`}
                >
                  OFFICIAL TE PRESET PACKS
                </span>
                <span
                  className={`font-mono text-[8px] ${
                    isTing ? 'text-[#4b6b5d]' : 'text-[#73787a]'
                  }`}
                >
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
                        ? isTing
                          ? 'bg-[#00503a] text-white'
                          : 'bg-[#141617] text-white'
                        : isTing
                        ? 'hover:bg-[#ff681d] hover:text-white text-[#00503a]'
                        : 'hover:bg-[#f15a22] hover:text-white text-[#141617]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10.5px] font-bold uppercase tracking-wide">
                        {item.name}
                      </span>
                      {isSelected && (
                        <Check
                          className={`w-3 h-3 group-hover:text-white shrink-0 ${
                            isTing ? 'text-[#ff681d]' : 'text-[#f15a22]'
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`font-mono text-[8px] uppercase truncate ${
                        isSelected
                          ? 'text-white/70'
                          : isTing
                          ? 'text-[#4b6b5d] group-hover:text-white/85'
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
