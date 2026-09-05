import React, { useState, useEffect } from 'react';
import { PresetConfig, LfoShape } from '../types/config';
import { EFFECTS_REGISTRY } from '../constants/effectsRegistry';
import { FaderHandle } from './FaderHandle';
import { Knob } from './Knob';
import { Activity, Sliders, Zap } from 'lucide-react';

interface ModulationPanelProps {
  preset: PresetConfig;
  handlePos: number;
  onHandleChange: (val: number) => void;
  onShakeTrigger: () => void;
  onUpdatePreset: (updated: PresetConfig) => void;
}

export const ModulationPanel: React.FC<ModulationPanelProps> = ({
  preset,
  handlePos,
  onHandleChange,
  onShakeTrigger,
  onUpdatePreset
}) => {
  const [lfoAnimPhase, setLfoAnimPhase] = useState(0);

  // LFO animated preview loop
  useEffect(() => {
    let animId: number;
    const speed = preset.lfo?.speed || 2.0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setLfoAnimPhase((prev) => (prev + dt * speed) % 1);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [preset.lfo?.speed]);

  // Handle configuration helpers
  const handleTargetIsLfo = preset.handle?.target === 'lfo';
  const handleTargetRow = typeof preset.handle?.row === 'number' ? preset.handle.row : 0;
  const targetEffect = preset.list[handleTargetRow];
  const targetMeta = targetEffect ? EFFECTS_REGISTRY[targetEffect.effect] : null;

  const updateHandleConfig = (updates: any) => {
    onUpdatePreset({
      ...preset,
      handle: {
        ...(preset.handle || { param: 'cutoff', depth: 0.8 }),
        ...updates
      }
    });
  };

  const updateShakeConfig = (updates: any) => {
    onUpdatePreset({
      ...preset,
      shake: {
        ...(preset.shake || { row: 0, param: 'mix', depth: 0.5 }),
        ...updates
      }
    });
  };

  const updateLfoConfig = (updates: any) => {
    onUpdatePreset({
      ...preset,
      lfo: {
        ...(preset.lfo || {
          row: 0,
          param: 'cutoff',
          depth: 0.2,
          shape: 'sine',
          speed: 2.0,
          phase: 0
        }),
        ...updates
      }
    });
  };

  return (
    <div className="te-chassis-panel p-4 border border-[#18191a] shadow-md flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-[#18191a] pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#f15a22]" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-[#18191a]">
            MODULATION MATRIX & PHYSICAL CONTROLS
          </h2>
        </div>
        <span className="text-[9px] font-mono text-[#656d73]">
          SECTIONS 7.8 & 7.9 SPEC
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 1. SQUEEZE HANDLE LEVER & ROUTING */}
        <div className="lg:col-span-4 flex flex-col gap-3 bg-[#e0e3e0] p-3 border border-[#18191a]">
          <FaderHandle
            value={handlePos}
            onChange={onHandleChange}
            paramName={preset.handle?.param?.toUpperCase() || 'OFF'}
            depth={preset.handle?.depth || 0.8}
          />

          {/* Handle Routing Config */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#18191a]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-bold text-[#18191a] uppercase">
                HANDLE TARGET:
              </span>
              <div className="flex border border-[#18191a] text-[8px] font-mono font-bold">
                <button
                  onClick={() => updateHandleConfig({ target: undefined, row: 0 })}
                  className={`px-2 py-0.5 ${
                    !handleTargetIsLfo ? 'bg-[#f15a22] text-black' : 'bg-[#232424] text-white'
                  }`}
                >
                  EFFECT ROW
                </button>
                <button
                  onClick={() => updateHandleConfig({ target: 'lfo', param: 'speed' })}
                  className={`px-2 py-0.5 border-l border-[#18191a] ${
                    handleTargetIsLfo ? 'bg-[#f15a22] text-black' : 'bg-[#232424] text-white'
                  }`}
                  title="Section 7.9: Advanced modulation - handle controls LFO speed"
                >
                  LFO SPEED
                </button>
              </div>
            </div>

            {!handleTargetIsLfo && preset.list.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[8px] font-mono text-[#656d73]">TARGET ROW</span>
                  <select
                    value={handleTargetRow}
                    onChange={(e) => {
                      const r = parseInt(e.target.value);
                      const ef = preset.list[r];
                      const m = ef ? EFFECTS_REGISTRY[ef.effect] : null;
                      updateHandleConfig({
                        row: r,
                        param: m?.params[0]?.name || 'cutoff'
                      });
                    }}
                    className="w-full bg-[#232424] text-white text-[10px] font-mono p-1 border border-[#18191a]"
                  >
                    {preset.list.map((fx, i) => (
                      <option key={fx.id} value={i}>
                        Row {i}: {fx.effect}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[8px] font-mono text-[#656d73]">PARAM</span>
                  <select
                    value={preset.handle?.param || targetMeta?.params[0]?.name || ''}
                    onChange={(e) => updateHandleConfig({ param: e.target.value })}
                    className="w-full bg-[#232424] text-white text-[10px] font-mono p-1 border border-[#18191a]"
                  >
                    {targetMeta?.params.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {/* Depth Knob */}
            <div className="flex justify-center pt-2">
              <Knob
                label="HANDLE DEPTH"
                value={preset.handle?.depth || 0.8}
                min={-10.0}
                max={10.0}
                step={0.1}
                unit=""
                displayValue={`${(preset.handle?.depth || 0.8) > 0 ? '+' : ''}${(
                  preset.handle?.depth || 0.8
                ).toFixed(1)}`}
                onChange={(v) => updateHandleConfig({ depth: v })}
                onReset={() => updateHandleConfig({ depth: 0.8 })}
              />
            </div>
          </div>
        </div>

        {/* 2. SHAKE TRIGGER & CONFIG */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-[#e0e3e0] p-3 border border-[#18191a]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-[#18191a] pb-1.5">
              <span className="text-[10px] font-bold text-[#18191a] uppercase flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#f15a22]" /> SHAKE MODULATOR
              </span>
              <button
                onClick={onShakeTrigger}
                className="te-btn te-btn-orange text-[9px] py-1 px-2 font-bold"
              >
                TEST SHAKE
              </button>
            </div>

            <p className="text-[9px] font-mono text-[#656d73]">
              Section 7.8: Triggers parameter transient spikes when the microphone is physically shaken.
            </p>

            {preset.list.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <span className="text-[8px] font-mono text-[#656d73]">TARGET ROW</span>
                  <select
                    value={preset.shake?.row || 0}
                    onChange={(e) => {
                      const r = parseInt(e.target.value);
                      const ef = preset.list[r];
                      const m = ef ? EFFECTS_REGISTRY[ef.effect] : null;
                      updateShakeConfig({
                        row: r,
                        param: m?.params[0]?.name || 'mix'
                      });
                    }}
                    className="w-full bg-[#232424] text-white text-[10px] font-mono p-1 border border-[#18191a]"
                  >
                    {preset.list.map((fx, i) => (
                      <option key={fx.id} value={i}>
                        Row {i}: {fx.effect}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[8px] font-mono text-[#656d73]">PARAM</span>
                  <select
                    value={preset.shake?.param || 'mix'}
                    onChange={(e) => updateShakeConfig({ param: e.target.value })}
                    className="w-full bg-[#232424] text-white text-[10px] font-mono p-1 border border-[#18191a]"
                  >
                    {preset.list[preset.shake?.row || 0] &&
                      EFFECTS_REGISTRY[
                        preset.list[preset.shake?.row || 0].effect
                      ]?.params.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex justify-center pt-3 border-t border-[#18191a] mt-3">
            <Knob
              label="SHAKE DEPTH"
              value={preset.shake?.depth || 0.5}
              min={-5.0}
              max={5.0}
              step={0.05}
              unit=""
              displayValue={`${(preset.shake?.depth || 0.5) > 0 ? '+' : ''}${(
                preset.shake?.depth || 0.5
              ).toFixed(2)}`}
              onChange={(v) => updateShakeConfig({ depth: v })}
              onReset={() => updateShakeConfig({ depth: 0.5 })}
            />
          </div>
        </div>

        {/* 3. LFO (LOW FREQUENCY OSCILLATOR) */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-[#e0e3e0] p-3 border border-[#18191a]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-[#18191a] pb-1.5">
              <span className="text-[10px] font-bold text-[#18191a] uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#00a69c]" /> LFO OSCILLATOR
              </span>
              <span className="text-[9px] font-mono text-[#00a69c] font-bold">
                {preset.lfo?.shape?.toUpperCase() || 'SINE'}
              </span>
            </div>

            {/* Waveform Selector */}
            <div className="flex items-center border border-[#18191a] bg-[#232424]">
              {(['sine', 'square', 'sawtooth', 'random'] as LfoShape[]).map((shape) => (
                <button
                  key={shape}
                  onClick={() => updateLfoConfig({ shape })}
                  className={`flex-1 text-[8px] font-mono font-bold py-1 uppercase ${
                    (preset.lfo?.shape || 'sine') === shape
                      ? 'bg-[#00a69c] text-black'
                      : 'text-white hover:bg-[#333]'
                  }`}
                >
                  {shape}
                </button>
              ))}
            </div>

            {/* Live animated LFO scope */}
            <div className="h-6 bg-[#000005] border border-[#18191a] relative overflow-hidden flex items-center px-2">
              <svg width="100%" height="100%" viewBox="0 0 100 30" preserveAspectRatio="none">
                <path
                  d={
                    (preset.lfo?.shape || 'sine') === 'sine'
                      ? Array.from({ length: 40 })
                          .map((_, i) => {
                            const x = (i / 40) * 100;
                            const y = 15 + 10 * Math.sin(((i / 40) * 2 + lfoAnimPhase) * 2 * Math.PI);
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                          })
                          .join(' ')
                      : (preset.lfo?.shape || 'sine') === 'square'
                      ? `M 0 ${Math.sin(lfoAnimPhase * 2 * Math.PI) > 0 ? 5 : 25} L 50 ${Math.sin(lfoAnimPhase * 2 * Math.PI) > 0 ? 5 : 25} L 50 ${Math.sin(lfoAnimPhase * 2 * Math.PI) > 0 ? 25 : 5} L 100 ${Math.sin(lfoAnimPhase * 2 * Math.PI) > 0 ? 25 : 5}`
                      : `M 0 25 L 50 5 L 50 25 L 100 5`
                  }
                  fill="none"
                  stroke="#00a69c"
                  strokeWidth="1.5"
                />
              </svg>
            </div>

            {/* Target Row & Param */}
            {preset.list.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-[8px] font-mono text-[#656d73]">TARGET ROW</span>
                  <select
                    value={preset.lfo?.row || 0}
                    onChange={(e) => {
                      const r = parseInt(e.target.value);
                      const ef = preset.list[r];
                      const m = ef ? EFFECTS_REGISTRY[ef.effect] : null;
                      updateLfoConfig({
                        row: r,
                        param: m?.params[0]?.name || 'cutoff'
                      });
                    }}
                    className="w-full bg-[#232424] text-white text-[10px] font-mono p-1 border border-[#18191a]"
                  >
                    {preset.list.map((fx, i) => (
                      <option key={fx.id} value={i}>
                        Row {i}: {fx.effect}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[8px] font-mono text-[#656d73]">PARAM</span>
                  <select
                    value={preset.lfo?.param || 'cutoff'}
                    onChange={(e) => updateLfoConfig({ param: e.target.value })}
                    className="w-full bg-[#232424] text-white text-[10px] font-mono p-1 border border-[#18191a]"
                  >
                    {preset.list[preset.lfo?.row || 0] &&
                      EFFECTS_REGISTRY[
                        preset.list[preset.lfo?.row || 0].effect
                      ]?.params.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* LFO Knobs: Speed & Depth */}
          <div className="flex items-center justify-around pt-3 border-t border-[#18191a] mt-2">
            <Knob
              label="SPEED RATE"
              value={preset.lfo?.speed || 2.0}
              min={0.1}
              max={20.0}
              step={0.1}
              unit="Hz"
              displayValue={`${(preset.lfo?.speed || 2.0).toFixed(1)}Hz`}
              onChange={(v) => updateLfoConfig({ speed: v })}
              onReset={() => updateLfoConfig({ speed: 2.0 })}
              accentColor="#00a69c"
            />
            <Knob
              label="LFO DEPTH"
              value={preset.lfo?.depth || 0.2}
              min={0.0}
              max={2.0}
              step={0.02}
              unit=""
              displayValue={(preset.lfo?.depth || 0.2).toFixed(2)}
              onChange={(v) => updateLfoConfig({ depth: v })}
              onReset={() => updateLfoConfig({ depth: 0.2 })}
              accentColor="#00a69c"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
