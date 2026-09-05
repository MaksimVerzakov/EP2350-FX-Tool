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
    <div className="min-h-screen flex flex-col items-center px-4 py-4 md:px-8 md:py-6 font-mono select-none">
      <div className="max-w-[1240px] w-full flex flex-col gap-6">
        
        {/* 1. TOP BANNER (Modular Badge & Cable) */}
        <TopBanner
          packName={pack.name}
          onUpdatePackName={(name) => setPack({ ...pack, name })}
          onImportJson={handleImportJson}
          onExportJson={handleExportJson}
        />

        {/* 2. MAIN TWO-COLUMN WORKBENCH DESK */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Hardware Mic Device + Compact Audition Player */}
          <div className="lg:col-span-5 flex flex-col items-center gap-2">
            <MicDevice
              activeSlot={activeSlot}
              onSelectSlot={setActiveSlot}
              handlePos={handlePos}
              onHandleChange={handleHandleChange}
              onShakeTrigger={handleShakeTrigger}
            />

            <AudioPlayerCompact onShakeTrigger={handleShakeTrigger} />

            {/* Minimalist [ HELP ] button (matching ep-sample-tool bottom button) */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="mt-4 bg-[#dbdddb] border border-[#18191a] text-[10px] font-mono font-bold px-4 py-1 hover:bg-[#fff] shadow-sm flex items-center gap-1.5"
            >
              <HelpCircle className="w-3 h-3" /> HELP
            </button>
          </div>

          {/* RIGHT COLUMN: Preset Details Ledger Sheet */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <PresetLedger
              preset={activePreset}
              onUpdatePreset={handleUpdateActivePreset}
            />
          </div>
        </div>
      </div>

      {/* HELP & HARDWARE INSTRUCTIONS MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="te-ledger-card max-w-lg w-full bg-[#f8f9f8] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b-2 border-[#18191a] pb-2">
              <span className="font-mono font-bold text-xs uppercase tracking-wider text-[#f15a22]">
                EP–2350 HARDWARE GUIDE & INSTALLATION
              </span>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 text-[#18191a] hover:text-[#f15a22]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] font-mono leading-relaxed text-[#232424] flex flex-col gap-2.5">
              <p>
                <strong>HOW TO INSTALL YOUR CONFIG ON THE MIC:</strong>
                <br />
                1. Connect your EP–2350 fx mic via USB-C to your computer.
                <br />
                2. Power on by pressing the handle. A disk called <code>fx-mic disk</code> will appear.
                <br />
                3. Click <strong>EXPORT CONFIG.JSON</strong> and save the file into the root folder of <code>fx-mic disk</code>.
                <br />
                4. Eject <code>fx-mic disk</code>. The mic will restart and load your presets.
              </p>

              <p>
                <strong>PRESET SWITCHING:</strong>
                <br />
                Click the orange button or the 4 vertical LEDs on the mic grille to switch between the 4 presets.
              </p>

              <p>
                <strong>RECOVERY MODE:</strong>
                <br />
                If the device freezes due to any broken file, connect to computer and hold the <strong>WHITE + GREY</strong> buttons during startup.
              </p>
            </div>

            <div className="pt-2 border-t border-[#18191a] flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="te-btn te-btn-orange text-xs py-1 px-4"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
