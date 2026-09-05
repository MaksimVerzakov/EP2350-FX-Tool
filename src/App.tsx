import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_PACK } from './constants/defaultPresets';
import { PackConfig, PresetConfig } from './types/config';
import { audioEngine } from './dsp/AudioEngine';
import { serializeToConfigJson } from './utils/serializer';
import { parseConfigJson } from './utils/parser';

import { TopBanner } from './components/TopBanner';
import { MicDevice } from './components/MicDevice';
import { AudioPlayerCompact } from './components/AudioPlayerCompact';
import { PresetLedger } from './components/PresetLedger';
import { HelpCircle, X } from 'lucide-react';

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
      alert('config.json successfully loaded into EP-2350 tool!');
    } else {
      alert(`Import error: ${parsed.error}`);
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
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-4 md:px-8 md:py-6 select-none font-sans">
      <div className="max-w-[1240px] w-full flex flex-col gap-6">
        
        {/* 1. TOP BANNER (Modular Badge & Action Buttons) */}
        <TopBanner
          packName={pack.name}
          onUpdatePackName={(name) => setPack({ ...pack, name })}
          onImportJson={handleImportJson}
          onExportJson={handleExportJson}
        />

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

            {/* Minimalist [ HELP ] button (matching ep-sample-tool bottom button) */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="mt-3 bg-[#ffffff] border border-[#141617] text-[10px] font-mono font-bold px-4 py-1 hover:bg-[#f5f5f5] shadow-[0_1px_2px_rgba(0,0,0,0.15)] flex items-center gap-1.5 transition-colors cursor-pointer rounded-[1px]"
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
                  1. Installing Configuration to Mic
                </strong>
                <p className="text-[#333]">
                  Connect EP–2350 via USB-C to your computer and push the handle to power on. A disk called <code className="bg-[#f0f2f0] px-1 py-0.5 border border-[#d2d5d2] font-mono text-[11px]">fx-mic disk</code> will mount. Click <strong>EXPORT CONFIG.JSON</strong> and drop the file directly into the root folder. Eject the disk to reboot with the new effects.
                </p>
              </div>

              <div>
                <strong className="block text-[11px] uppercase tracking-wide text-[#73787a] mb-1">
                  2. Preset Selection
                </strong>
                <p className="text-[#333]">
                  Click the physical orange button or the 4 vertical LEDs on the mic grille, or use the Preset up/down controls on the editor to switch between presets 1 through 4.
                </p>
              </div>

              <div>
                <strong className="block text-[11px] uppercase tracking-wide text-[#73787a] mb-1">
                  3. Emergency Recovery
                </strong>
                <p className="text-[#333]">
                  If the device freezes due to a broken file, hold the <strong>WHITE + GREY</strong> buttons during startup to boot into recovery.
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
