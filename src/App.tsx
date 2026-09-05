import React, { useState, useEffect, useCallback } from 'react';
import { INITIAL_PACK } from './constants/defaultPresets';
import { PackConfig, PresetConfig } from './types/config';
import { audioEngine } from './dsp/AudioEngine';
import { serializeToConfigJson } from './utils/serializer';
import { parseConfigJson } from './utils/parser';

import { Header } from './components/Header';
import { PresetTabs } from './components/PresetTabs';
import { EffectRack } from './components/EffectRack';
import { ModulationPanel } from './components/ModulationPanel';
import { AudioAuditioner } from './components/AudioAuditioner';
import { JsonPreview } from './components/JsonPreview';

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

  const activePreset = pack.presets.find((p) => p.pos === activeSlot) || pack.presets[0];

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem('ep2350_pack_config', serializeToConfigJson(pack));
  }, [pack]);

  // Synchronize active preset with DSP engine
  useEffect(() => {
    audioEngine.updatePreset(activePreset);
  }, [activePreset]);

  // Handle position modulation
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
      alert('config.json successfully imported!');
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

  const handleResetDefaults = () => {
    if (confirm('Reset all presets to factory defaults? Any unsaved edits will be lost.')) {
      setPack(INITIAL_PACK);
      setActiveSlot(0);
      setHandlePos(0.0);
    }
  };

  return (
    <div className="min-h-screen bg-[#141517] text-[#18191a] flex flex-col p-2 sm:p-4 lg:p-6 font-mono">
      <div className="max-w-[1440px] w-full mx-auto flex flex-col gap-4">
        {/* Header */}
        <Header
          pack={pack}
          onUpdatePack={setPack}
          onImportJson={handleImportJson}
          onExportJson={handleExportJson}
          onResetDefault={handleResetDefaults}
        />

        {/* 4 Preset Slots Bar */}
        <PresetTabs
          presets={pack.presets}
          activeSlot={activeSlot}
          onSelectSlot={setActiveSlot}
          onUpdateActivePreset={handleUpdateActivePreset}
        />

        {/* Main Work Area */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Left Column: Effect Chain Rack + Modulation Panel (7 cols) */}
          <div className="xl:col-span-7 flex flex-col gap-4">
            <EffectRack
              preset={activePreset}
              onUpdatePreset={handleUpdateActivePreset}
            />

            <ModulationPanel
              preset={activePreset}
              handlePos={handlePos}
              onHandleChange={handleHandleChange}
              onShakeTrigger={handleShakeTrigger}
              onUpdatePreset={handleUpdateActivePreset}
            />
          </div>

          {/* Right Column: Live Audio Auditioning & JSON Inspector (5 cols) */}
          <div className="xl:col-span-5 flex flex-col gap-4 sticky top-4">
            <AudioAuditioner onShakeTrigger={handleShakeTrigger} />
            <JsonPreview pack={pack} onExport={handleExportJson} />
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[9px] text-[#656d73] py-2 border-t border-[#232424] flex flex-wrap justify-between items-center px-2">
          <span>TEENAGE ENGINEERING EP–2350 COMPANION // WEB DSP ENGINE</span>
          <span>HOTKEYS: [SPACEBAR] TO TEST SHAKE GESTURE</span>
        </footer>
      </div>
    </div>
  );
};
