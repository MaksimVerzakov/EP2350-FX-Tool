import React from 'react';
import { PresetConfig } from '../types/config';

interface PresetTabsProps {
  presets: PresetConfig[];
  activeSlot: number;
  onSelectSlot: (slot: number) => void;
  onUpdateActivePreset: (preset: PresetConfig) => void;
}

export const PresetTabs: React.FC<PresetTabsProps> = ({
  presets,
  activeSlot,
  onSelectSlot,
  onUpdateActivePreset
}) => {
  const currentPreset = presets.find((p) => p.pos === activeSlot) || presets[0];

  return (
    <div className="te-chassis-panel p-3 border border-[#18191a] shadow-sm select-none flex flex-col gap-3">
      {/* The 4 Orange Preset Slot Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#18191a] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#18191a] tracking-wider uppercase">
            ORANGE BUTTON PRESET SLOTS:
          </span>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((slot) => {
              const isActive = slot === activeSlot;
              const preset = presets.find((p) => p.pos === slot);
              return (
                <button
                  key={slot}
                  onClick={() => onSelectSlot(slot)}
                  className={`w-10 h-10 font-mono font-bold text-sm border-2 transition-all flex flex-col items-center justify-center ${
                    isActive
                      ? 'bg-[#f15a22] text-[#000005] border-[#18191a] shadow-md transform -translate-y-0.5'
                      : 'bg-[#232424] text-[#dbdddb] border-[#18191a] hover:bg-[#323434]'
                  }`}
                  title={`Slot ${slot}: ${preset?.name || 'Preset'}`}
                >
                  <span>{slot}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot Name & Comment Fields */}
        <div className="flex-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-[#656d73] uppercase font-bold">NAME:</span>
            <input
              type="text"
              value={currentPreset.name || ''}
              onChange={(e) =>
                onUpdateActivePreset({
                  ...currentPreset,
                  name: e.target.value.toUpperCase()
                })
              }
              placeholder="PRESET NAME"
              className="bg-[#000005] text-[#00a69c] border border-[#18191a] px-2 py-1 font-mono text-[11px] font-bold te-lcd-glow tracking-wider focus:outline-none focus:border-[#f15a22] uppercase min-w-[140px]"
              maxLength={20}
            />
          </div>

          <div className="flex items-center gap-1.5 flex-1 max-w-sm">
            <span className="text-[9px] font-mono text-[#656d73] uppercase font-bold">NOTE:</span>
            <input
              type="text"
              value={currentPreset.comment || ''}
              onChange={(e) =>
                onUpdateActivePreset({
                  ...currentPreset,
                  comment: e.target.value
                })
              }
              placeholder="Notes on how the preset works..."
              className="bg-[#fff] text-[#18191a] border border-[#18191a] px-2 py-1 font-mono text-[10px] focus:outline-none focus:border-[#f15a22] flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
