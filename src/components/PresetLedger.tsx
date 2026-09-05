import React, { useState } from 'react';
import { AnyEffect, EffectType, PresetConfig, LfoShape } from '../types/config';
import { EFFECTS_REGISTRY } from '../constants/effectsRegistry';
import { Knob } from './Knob';
import { Plus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

interface PresetLedgerProps {
  preset: PresetConfig;
  onUpdatePreset: (updated: PresetConfig) => void;
}

// Iconic Teenage Engineering 4-Color Encoder Discipline
const ENCODER_COLORS = ['#f15a22', '#00a69c', '#d99b26', '#4a4e52'];

export const PresetLedger: React.FC<PresetLedgerProps> = ({
  preset,
  onUpdatePreset
}) => {
  const [selectedEffectToAdd, setSelectedEffectToAdd] = useState<EffectType>('DIST');

  const existingTypes = new Set(preset.list.map((e) => e.effect));

  const handleAddEffect = () => {
    const meta = EFFECTS_REGISTRY[selectedEffectToAdd];
    const newEffect: AnyEffect = {
      id: `fx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      effect: selectedEffectToAdd
    };

    meta.params.forEach((p) => {
      newEffect[p.name] = p.defaultVal;
    });

    onUpdatePreset({
      ...preset,
      list: [...preset.list, newEffect]
    });
  };

  const handleUpdateEffect = (idx: number, updated: AnyEffect) => {
    const newList = [...preset.list];
    newList[idx] = updated;
    onUpdatePreset({
      ...preset,
      list: newList
    });
  };

  const handleDeleteEffect = (idx: number) => {
    const newList = preset.list.filter((_, i) => i !== idx);
    const updatedPreset = { ...preset, list: newList };

    if (updatedPreset.handle && updatedPreset.handle.target !== 'lfo' && typeof updatedPreset.handle.row === 'number') {
      if (updatedPreset.handle.row === idx) delete updatedPreset.handle;
      else if (updatedPreset.handle.row > idx) updatedPreset.handle = { ...updatedPreset.handle, row: updatedPreset.handle.row - 1 };
    }

    if (updatedPreset.shake && typeof updatedPreset.shake.row === 'number') {
      if (updatedPreset.shake.row === idx) delete updatedPreset.shake;
      else if (updatedPreset.shake.row > idx) updatedPreset.shake = { ...updatedPreset.shake, row: updatedPreset.shake.row - 1 };
    }

    if (updatedPreset.lfo && updatedPreset.lfo.target !== 'lfo' && typeof updatedPreset.lfo.row === 'number') {
      if (updatedPreset.lfo.row === idx) delete updatedPreset.lfo;
      else if (updatedPreset.lfo.row > idx) updatedPreset.lfo = { ...updatedPreset.lfo, row: updatedPreset.lfo.row - 1 };
    }

    onUpdatePreset(updatedPreset);
  };

  const handleMove = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= preset.list.length) return;
    const newList = [...preset.list];
    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);

    const updatedPreset = { ...preset, list: newList };

    const remapRow = (row?: number) => {
      if (typeof row !== 'number') return undefined;
      if (row === fromIdx) return toIdx;
      if (fromIdx < toIdx && row > fromIdx && row <= toIdx) return row - 1;
      if (fromIdx > toIdx && row >= toIdx && row < fromIdx) return row + 1;
      return row;
    };

    if (updatedPreset.handle && updatedPreset.handle.target !== 'lfo' && typeof updatedPreset.handle.row === 'number') {
      updatedPreset.handle = { ...updatedPreset.handle, row: remapRow(updatedPreset.handle.row)! };
    }
    if (updatedPreset.shake && typeof updatedPreset.shake.row === 'number') {
      updatedPreset.shake = { ...updatedPreset.shake, row: remapRow(updatedPreset.shake.row)! };
    }
    if (updatedPreset.lfo && updatedPreset.lfo.target !== 'lfo' && typeof updatedPreset.lfo.row === 'number') {
      updatedPreset.lfo = { ...updatedPreset.lfo, row: remapRow(updatedPreset.lfo.row)! };
    }

    onUpdatePreset(updatedPreset);
  };

  return (
    <div className="te-ledger-card w-full flex flex-col select-none overflow-hidden min-h-[580px]">
      {/* 1. TOP ORANGE HEADER TAB (styled after SAMPLE LIBRARY in ep-sample-tool) */}
      <div className="bg-[#f15a22] text-white px-4 py-2.5 border-b border-[#141617] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-xs tracking-wider uppercase text-white">
            PRESET {preset.pos + 1}
          </span>
          <span className="text-[10px] font-mono text-white/70 font-medium">
            // SLOT {preset.pos}
          </span>
        </div>

        {/* Harmonious Header Inputs (Balanced dark translucent inputs) */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={preset.name || ''}
            onChange={(e) => onUpdatePreset({ ...preset, name: e.target.value.toUpperCase() })}
            placeholder="PRESET NAME"
            className="bg-black/25 text-white placeholder:text-white/50 px-2 py-1 font-mono text-[11px] font-bold tracking-wider uppercase border border-black/30 focus:outline-none focus:bg-black/40 focus:border-white max-w-[160px]"
            maxLength={20}
          />
          <input
            type="text"
            value={preset.comment || ''}
            onChange={(e) => onUpdatePreset({ ...preset, comment: e.target.value })}
            placeholder="Usage note..."
            className="bg-black/15 text-white placeholder:text-white/50 px-2 py-1 font-mono text-[10px] border border-black/25 focus:outline-none focus:bg-black/30 hidden md:block max-w-[220px]"
          />
        </div>
      </div>

      {/* 2. LEDGER CONTENT (White Paper Ledger Sheet) */}
      <div className="p-4 bg-[#ffffff] flex flex-col gap-4">
        {/* Signal Chain Row Header */}
        <div className="flex items-center justify-between border-b border-[#e2e4e2] pb-1.5 text-[9px] font-mono font-semibold text-[#73787a] uppercase tracking-wider">
          <span>DSP SIGNAL FLOW (ROW 01 &rarr; ROW {preset.list.length.toString().padStart(2, '0')})</span>
          <span>{preset.list.length} EFFECT{preset.list.length !== 1 ? 'S' : ''}</span>
        </div>

        {/* Effects Ledger Rows */}
        {preset.list.length === 0 ? (
          <div className="py-8 text-center text-[#73787a] font-mono text-xs border border-dashed border-[#d2d5d2]">
            NO EFFECTS IN PRESET. INSERT AN EFFECT BELOW.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {preset.list.map((effect, idx) => {
              const meta = EFFECTS_REGISTRY[effect.effect] || EFFECTS_REGISTRY.LOWPASS;
              const isSample = effect.effect === 'SAMPLE';

              const isHandleTarget = preset.handle?.target !== 'lfo' && preset.handle?.row === idx;
              const isShakeTarget = preset.shake?.row === idx;
              const isLfoTarget = preset.lfo?.target !== 'lfo' && preset.lfo?.row === idx;

              return (
                <div
                  key={effect.id}
                  className={`border p-3 transition-colors ${
                    isSample 
                      ? 'bg-[#f4f7f4] border-[#00a69c]/60 shadow-2xs' 
                      : 'bg-[#ffffff] border-[#d2d5d2] hover:border-[#141617] shadow-2xs'
                  }`}
                >
                  {/* Row Header */}
                  <div className="flex items-center justify-between border-b border-[#eceeed] pb-1.5 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-[#f15a22]">
                        {(idx + 1).toString().padStart(2, '0')}.
                      </span>
                      <span className="font-bold text-xs uppercase tracking-tight text-[#141617]">
                        {meta.displayName}
                      </span>
                      {meta.singleInstance && (
                        <span className="text-[8px] font-mono text-[#73787a]">
                          *1x
                        </span>
                      )}

                      {/* In-situ Mod Badges */}
                      <div className="flex items-center gap-1">
                        {isHandleTarget && (
                          <span className="bg-[#f15a22] text-white text-[7px] font-mono font-bold px-1 py-0.2">
                            HANDLE &rarr; {preset.handle?.param?.toUpperCase()}
                          </span>
                        )}
                        {isShakeTarget && (
                          <span className="bg-[#141617] text-white text-[7px] font-mono font-bold px-1 py-0.2">
                            SHAKE &rarr; {preset.shake?.param?.toUpperCase()}
                          </span>
                        )}
                        {isLfoTarget && (
                          <span className="bg-[#00a69c] text-white text-[7px] font-mono font-bold px-1 py-0.2">
                            LFO &rarr; {preset.lfo?.param?.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Controls: Reorder & Delete */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center border border-[#d2d5d2] bg-[#f8f9f8]">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, idx - 1)}
                          className="p-1 hover:bg-[#e8eae8] disabled:opacity-30 disabled:pointer-events-none"
                          title="Move Up"
                        >
                          <ArrowUp className="w-2.5 h-2.5 text-[#141617]" />
                        </button>
                        <button
                          disabled={idx === preset.list.length - 1}
                          onClick={() => handleMove(idx, idx + 1)}
                          className="p-1 hover:bg-[#e8eae8] disabled:opacity-30 disabled:pointer-events-none border-l border-[#d2d5d2]"
                          title="Move Down"
                        >
                          <ArrowDown className="w-2.5 h-2.5 text-[#141617]" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteEffect(idx)}
                        className="p-1 text-[#73787a] hover:text-[#e52817]"
                        title="Remove effect"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Knobs strip with TE 4-color encoder discipline */}
                  <div className="flex flex-wrap items-center gap-4 py-1">
                    {meta.params.map((param, pIdx) => {
                      const currentVal =
                        typeof effect[param.name] === 'number'
                          ? effect[param.name]
                          : param.defaultVal;

                      const isParamModulated =
                        (isHandleTarget && preset.handle?.param === param.name) ||
                        (isShakeTarget && preset.shake?.param === param.name) ||
                        (isLfoTarget && preset.lfo?.param === param.name);

                      const encoderColor = isSample ? '#00a69c' : ENCODER_COLORS[pIdx % ENCODER_COLORS.length];

                      return (
                        <Knob
                          key={param.name}
                          label={param.label}
                          value={currentVal}
                          min={param.min}
                          max={param.max}
                          step={param.step}
                          unit={param.unit}
                          displayValue={
                            param.displayScale ? param.displayScale(currentVal) : undefined
                          }
                          onChange={(v) => handleUpdateEffect(idx, { ...effect, [param.name]: v })}
                          onReset={() => handleUpdateEffect(idx, { ...effect, [param.name]: param.defaultVal })}
                          accentColor={encoderColor}
                          isModulated={isParamModulated}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Insert Effect Bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#e2e4e2]">
          <span className="text-[10px] font-bold text-[#141617] uppercase">
            INSERT EFFECT:
          </span>
          <select
            value={selectedEffectToAdd}
            onChange={(e) => setSelectedEffectToAdd(e.target.value as EffectType)}
            className="bg-[#ffffff] text-[#141617] text-xs font-mono font-medium px-2 py-1 border border-[#d2d5d2] focus:outline-none focus:border-[#141617]"
          >
            {Object.keys(EFFECTS_REGISTRY).map((key) => {
              const meta = EFFECTS_REGISTRY[key as EffectType];
              const isSingleUsed = meta.singleInstance && existingTypes.has(key as EffectType);
              return (
                <option key={key} value={key} disabled={isSingleUsed}>
                  {meta.displayName} {isSingleUsed ? '(1x max)' : ''}
                </option>
              );
            })}
          </select>
          <button
            onClick={handleAddEffect}
            className="te-btn te-btn-orange text-[10px] py-1 px-2.5"
          >
            <Plus className="w-3 h-3" /> ADD
          </button>
        </div>

        {/* 3. COMPACT MODULATION STRIP (Section 7.8 & 7.9) */}
        <div className="mt-1 pt-3 border-t border-[#141617] flex flex-col gap-2 bg-[#f8f9f8] p-3 border border-[#d2d5d2]">
          <span className="text-[9px] font-bold text-[#141617] uppercase tracking-wider">
            MODULATION ROUTING MATRIX:
          </span>

          {/* Handle row */}
          <div className="flex flex-wrap items-center justify-between text-[10px] font-mono gap-2 border-b border-[#e2e4e2] pb-1.5">
            <span className="text-[#f15a22] font-bold">1. HANDLE LEVER:</span>
            <div className="flex items-center gap-2">
              <span>TARGET:</span>
              <select
                value={preset.handle?.target === 'lfo' ? 'lfo' : preset.handle?.row ?? 0}
                onChange={(e) => {
                  if (e.target.value === 'lfo') {
                    onUpdatePreset({
                      ...preset,
                      handle: { target: 'lfo', param: 'speed', depth: 10.0 }
                    });
                  } else {
                    const r = parseInt(e.target.value);
                    const ef = preset.list[r];
                    const m = ef ? EFFECTS_REGISTRY[ef.effect] : null;
                    onUpdatePreset({
                      ...preset,
                      handle: { row: r, param: m?.params[0]?.name || 'cutoff', depth: 0.8 }
                    });
                  }
                }}
                className="bg-[#fff] border border-[#d2d5d2] px-1 py-0.5 text-[9px] font-mono"
              >
                {preset.list.map((fx, i) => (
                  <option key={fx.id} value={i}>
                    Row {i + 1}: {fx.effect}
                  </option>
                ))}
                <option value="lfo">LFO SPEED (ADVANCED)</option>
              </select>

              <span>DEPTH:</span>
              <input
                type="number"
                step="0.1"
                value={preset.handle?.depth ?? 0.8}
                onChange={(e) =>
                  onUpdatePreset({
                    ...preset,
                    handle: {
                      ...(preset.handle || { row: 0, param: 'cutoff', depth: 0.8 }),
                      depth: parseFloat(e.target.value) || 0
                    }
                  })
                }
                className="w-14 bg-[#fff] border border-[#d2d5d2] px-1 py-0.5 text-[9px] font-mono text-center"
              />
            </div>
          </div>

          {/* Shake row */}
          <div className="flex flex-wrap items-center justify-between text-[10px] font-mono gap-2 border-b border-[#e2e4e2] pb-1.5">
            <span className="text-[#141617] font-bold">2. SHAKE SENSOR:</span>
            <div className="flex items-center gap-2">
              <span>TARGET:</span>
              <select
                value={preset.shake?.row ?? 0}
                onChange={(e) => {
                  const r = parseInt(e.target.value);
                  const ef = preset.list[r];
                  const m = ef ? EFFECTS_REGISTRY[ef.effect] : null;
                  onUpdatePreset({
                    ...preset,
                    shake: { row: r, param: m?.params[0]?.name || 'mix', depth: 0.5 }
                  });
                }}
                className="bg-[#fff] border border-[#d2d5d2] px-1 py-0.5 text-[9px] font-mono"
              >
                {preset.list.map((fx, i) => (
                  <option key={fx.id} value={i}>
                    Row {i + 1}: {fx.effect}
                  </option>
                ))}
              </select>

              <span>DEPTH:</span>
              <input
                type="number"
                step="0.05"
                value={preset.shake?.depth ?? 0.5}
                onChange={(e) =>
                  onUpdatePreset({
                    ...preset,
                    shake: {
                      ...(preset.shake || { row: 0, param: 'mix', depth: 0.5 }),
                      depth: parseFloat(e.target.value) || 0
                    }
                  })
                }
                className="w-14 bg-[#fff] border border-[#d2d5d2] px-1 py-0.5 text-[9px] font-mono text-center"
              />
            </div>
          </div>

          {/* LFO row */}
          <div className="flex flex-wrap items-center justify-between text-[10px] font-mono gap-2">
            <span className="text-[#00a69c] font-bold">3. LFO CYCLER:</span>
            <div className="flex items-center gap-2">
              <span>SHAPE:</span>
              <select
                value={preset.lfo?.shape ?? 'sine'}
                onChange={(e) =>
                  onUpdatePreset({
                    ...preset,
                    lfo: {
                      ...(preset.lfo || { row: 0, param: 'cutoff', depth: 0.2, speed: 2.0, shape: 'sine' }),
                      shape: e.target.value as LfoShape
                    }
                  })
                }
                className="bg-[#fff] border border-[#d2d5d2] px-1 py-0.5 text-[9px] font-mono"
              >
                <option value="sine">SINE</option>
                <option value="square">SQUARE</option>
                <option value="sawtooth">SAW</option>
                <option value="random">RANDOM</option>
              </select>

              <span>SPEED:</span>
              <input
                type="number"
                step="0.1"
                value={preset.lfo?.speed ?? 2.0}
                onChange={(e) =>
                  onUpdatePreset({
                    ...preset,
                    lfo: {
                      ...(preset.lfo || { row: 0, param: 'cutoff', depth: 0.2, shape: 'sine', speed: 2.0 }),
                      speed: parseFloat(e.target.value) || 0.1
                    }
                  })
                }
                className="w-12 bg-[#fff] border border-[#d2d5d2] px-1 py-0.5 text-[9px] font-mono text-center"
              />
              <span className="text-[8px] text-[#73787a]">Hz</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
