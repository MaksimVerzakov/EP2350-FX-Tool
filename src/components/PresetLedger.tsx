import React, { useState, useRef, useEffect } from 'react';
import { AnyEffect, EffectType, PresetConfig, LfoShape } from '../types/config';
import { EFFECTS_REGISTRY } from '../constants/effectsRegistry';
import { Knob } from './Knob';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Sparkles,
  GitBranch,
  Volume2
} from 'lucide-react';

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
  // Popover state for Zapier-style effect addition
  const [addMenuTarget, setAddMenuTarget] = useState<null | { bus?: 1 | 2; insertIndex?: number }>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAddMenuTarget(null);
      }
    };
    if (addMenuTarget) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [addMenuTarget]);

  const existingTypes = new Set(preset.list.map((e) => e.effect));

  // 1-Click Smart Effect Addition
  const handleAddEffect = (effectType: EffectType, bus?: 1 | 2, insertIndex?: number) => {
    const meta = EFFECTS_REGISTRY[effectType];
    const newEffect: AnyEffect = {
      id: `fx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      effect: effectType
    };

    if (bus === 1 || bus === 2) {
      newEffect.BUS = bus;
    }

    meta.params.forEach((p) => {
      newEffect[p.name] = p.defaultVal;
    });

    const newList = [...preset.list];
    if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= newList.length) {
      newList.splice(insertIndex, 0, newEffect);
    } else {
      newList.push(newEffect);
    }

    onUpdatePreset({
      ...preset,
      list: newList
    });

    setAddMenuTarget(null);
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

    // Re-index handle
    if (updatedPreset.handle && updatedPreset.handle.target !== 'lfo' && typeof updatedPreset.handle.row === 'number') {
      if (updatedPreset.handle.row === idx) delete updatedPreset.handle;
      else if (updatedPreset.handle.row > idx) updatedPreset.handle = { ...updatedPreset.handle, row: updatedPreset.handle.row - 1 };
    }

    // Re-index shake
    if (updatedPreset.shake && typeof updatedPreset.shake.row === 'number') {
      if (updatedPreset.shake.row === idx) delete updatedPreset.shake;
      else if (updatedPreset.shake.row > idx) updatedPreset.shake = { ...updatedPreset.shake, row: updatedPreset.shake.row - 1 };
    }

    onUpdatePreset(updatedPreset);
  };

  // 4-Way D-Pad: Sequence Reordering (Up/Down)
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

    onUpdatePreset(updatedPreset);
  };

  // 4-Way D-Pad: Bus Lane Shifting (Left/Right)
  // Left: Bus 2 -> Serial, Serial -> Bus 1
  // Right: Bus 1 -> Serial, Serial -> Bus 2
  const handleShiftBus = (idx: number, direction: 'left' | 'right') => {
    const fx = preset.list[idx];
    if (!fx) return;

    let newBus: 1 | 2 | undefined = fx.BUS;
    if (direction === 'left') {
      if (fx.BUS === 2) newBus = undefined;
      else if (!fx.BUS) newBus = 1;
    } else {
      if (fx.BUS === 1) newBus = undefined;
      else if (!fx.BUS) newBus = 2;
    }

    const updated: AnyEffect = { ...fx };
    if (newBus === 1 || newBus === 2) {
      updated.BUS = newBus;
    } else {
      delete updated.BUS;
    }

    handleUpdateEffect(idx, updated);
  };

  // In-Situ Modulation Helpers for a row
  const isHandleOnRow = (idx: number) =>
    preset.handle?.target !== 'lfo' && preset.handle?.row === idx;

  const isShakeOnRow = (idx: number) =>
    preset.shake?.row === idx;

  const assignHandleToRow = (idx: number) => {
    const ef = preset.list[idx];
    const m = ef ? EFFECTS_REGISTRY[ef.effect] : null;
    const defaultParam = m?.params[0]?.name || 'cutoff';
    onUpdatePreset({
      ...preset,
      handle: { row: idx, param: defaultParam, depth: 0.8 }
    });
  };

  const removeHandle = () => {
    const copy = { ...preset };
    delete copy.handle;
    onUpdatePreset(copy);
  };

  const assignShakeToRow = (idx: number) => {
    const ef = preset.list[idx];
    const m = ef ? EFFECTS_REGISTRY[ef.effect] : null;
    const defaultParam = m?.params[0]?.name || 'mix';
    onUpdatePreset({
      ...preset,
      shake: { row: idx, param: defaultParam, depth: 0.5 }
    });
  };

  const removeShake = () => {
    const copy = { ...preset };
    delete copy.shake;
    onUpdatePreset(copy);
  };

  // Partition effects by branch lane
  const bus1List = preset.list
    .map((fx, idx) => ({ fx, idx }))
    .filter((item) => item.fx.BUS === 1);

  const serialList = preset.list
    .map((fx, idx) => ({ fx, idx }))
    .filter((item) => !item.fx.BUS);

  const bus2List = preset.list
    .map((fx, idx) => ({ fx, idx }))
    .filter((item) => item.fx.BUS === 2);

  // Render a single effect node card
  const renderEffectCard = (item: { fx: AnyEffect; idx: number }) => {
    const { fx: effect, idx } = item;
    const meta = EFFECTS_REGISTRY[effect.effect] || EFFECTS_REGISTRY.LOWPASS;
    const isSample = effect.effect === 'SAMPLE';

    const isHandleTarget = isHandleOnRow(idx);
    const isShakeTarget = isShakeOnRow(idx);
    const busMode = effect.BUS === 1 ? 'bus1' : effect.BUS === 2 ? 'bus2' : 'serial';

    return (
      <div
        key={effect.id}
        className={`w-full border p-2 flex flex-col gap-1.5 transition-all duration-100 shadow-xs relative rounded-[2px] ${
          busMode === 'bus1'
            ? 'border-l-[4px] border-l-[#00a69c] border-[#00a69c]/50 bg-[#f4fcfb]'
            : busMode === 'bus2'
            ? 'border-r-[4px] border-r-[#d99b26] border-[#d99b26]/50 bg-[#fffdf5]'
            : isSample
            ? 'border-l-[4px] border-l-[#141617] bg-[#f6f8f6] border-[#141617]/50'
            : 'border-l-[4px] border-l-[#141617] bg-[#ffffff] border-[#d2d5d2] hover:border-[#141617]'
        }`}
      >
        {/* Top & Bottom Connection Port Dots */}
        <div
          className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-white z-10 ${
            busMode === 'bus1'
              ? 'border-[#00a69c]'
              : busMode === 'bus2'
              ? 'border-[#d99b26]'
              : 'border-[#141617]'
          }`}
        />
        <div
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-white z-10 ${
            busMode === 'bus1'
              ? 'border-[#00a69c]'
              : busMode === 'bus2'
              ? 'border-[#d99b26]'
              : 'border-[#141617]'
          }`}
        />

        {/* Card Header Bar */}
        <div className="flex items-center justify-between border-b border-[#eceeed] pb-1 gap-1">
          {/* Index, Name, and Branch Badge */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-[9.5px] font-bold text-[#f15a22]">
              {(idx + 1).toString().padStart(2, '0')}.
            </span>
            <span className="font-bold text-[11px] uppercase tracking-tight text-[#141617] truncate">
              {meta.displayName}
            </span>
            <span
              className={`text-[7px] font-mono font-bold px-1 rounded-[1px] uppercase shrink-0 ${
                busMode === 'bus1'
                  ? 'bg-[#00a69c]/15 text-[#00a69c]'
                  : busMode === 'bus2'
                  ? 'bg-[#d99b26]/15 text-[#d99b26]'
                  : 'bg-black/5 text-[#73787a]'
              }`}
            >
              {busMode === 'bus1' ? 'BUS 1' : busMode === 'bus2' ? 'BUS 2' : 'SERIAL'}
            </span>
            {meta.singleInstance && (
              <span className="text-[7px] font-mono text-[#73787a] bg-black/5 px-1 rounded-[1px] shrink-0">
                1x
              </span>
            )}
          </div>

          {/* 4-Way D-Pad + Delete */}
          <div className="flex items-center gap-1 shrink-0">
            {/* 4-Way D-Pad: [Left] [Up] [Down] [Right] */}
            <div className="flex items-center border border-[#141617] bg-[#f8f9f8] rounded-[1px] shadow-2xs">
              <button
                disabled={busMode === 'bus1'}
                onClick={() => handleShiftBus(idx, 'left')}
                className="px-1.5 py-0.5 hover:bg-[#00a69c] hover:text-white text-[#00a69c] disabled:opacity-20 disabled:pointer-events-none transition-colors font-mono text-[8px] font-bold flex items-center gap-0.5 cursor-pointer"
                title={busMode === 'bus2' ? 'Shift back to Serial Main' : 'Shift into Bus 1 (Parallel Left)'}
              >
                <ArrowLeft className="w-2.5 h-2.5" />
                <span>{busMode === 'bus2' ? 'MAIN' : 'BUS 1'}</span>
              </button>
              <button
                disabled={idx === 0}
                onClick={() => handleMove(idx, idx - 1)}
                className="p-1 hover:bg-[#141617] hover:text-white text-[#141617] disabled:opacity-20 disabled:pointer-events-none border-l border-[#d2d5d2] transition-colors cursor-pointer"
                title="Move Up earlier in sequence"
              >
                <ArrowUp className="w-2.5 h-2.5" />
              </button>
              <button
                disabled={idx === preset.list.length - 1}
                onClick={() => handleMove(idx, idx + 1)}
                className="p-1 hover:bg-[#141617] hover:text-white text-[#141617] disabled:opacity-20 disabled:pointer-events-none border-l border-[#d2d5d2] transition-colors cursor-pointer"
                title="Move Down later in sequence"
              >
                <ArrowDown className="w-2.5 h-2.5" />
              </button>
              <button
                disabled={busMode === 'bus2'}
                onClick={() => handleShiftBus(idx, 'right')}
                className="px-1.5 py-0.5 hover:bg-[#d99b26] hover:text-white text-[#d99b26] disabled:opacity-20 disabled:pointer-events-none border-l border-[#d2d5d2] transition-colors font-mono text-[8px] font-bold flex items-center gap-0.5 cursor-pointer"
                title={busMode === 'bus1' ? 'Shift back to Serial Main' : 'Shift into Bus 2 (Parallel Right)'}
              >
                <span>{busMode === 'bus1' ? 'MAIN' : 'BUS 2'}</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Remove */}
            <button
              onClick={() => handleDeleteEffect(idx)}
              className="p-1 text-[#73787a] hover:text-[#e52817] transition-colors cursor-pointer"
              title="Delete effect"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* In-Situ Modulation Strip directly on card */}
        <div className="flex flex-wrap items-center gap-1.5 text-[7.5px] font-mono">
          {/* Handle */}
          {isHandleTarget ? (
            <div className="flex items-center gap-1 bg-[#f15a22] text-white px-1 py-0.5 rounded-[1px] font-bold">
              <span>HNDL:</span>
              <select
                value={preset.handle?.param}
                onChange={(e) =>
                  onUpdatePreset({
                    ...preset,
                    handle: { row: idx, param: e.target.value, depth: preset.handle?.depth ?? 0.8 }
                  })
                }
                className="bg-black text-white text-[7.5px] px-0.5 py-0 border-0 outline-none uppercase"
              >
                {meta.params.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span>D:</span>
              <input
                type="number"
                step="0.1"
                value={preset.handle?.depth ?? 0.8}
                onChange={(e) =>
                  onUpdatePreset({
                    ...preset,
                    handle: {
                      row: idx,
                      param: preset.handle?.param || meta.params[0]?.name || 'cutoff',
                      depth: parseFloat(e.target.value) || 0
                    }
                  })
                }
                className="w-8 bg-black text-white text-center text-[7.5px] px-0.5 py-0 outline-none"
              />
              <button
                onClick={removeHandle}
                className="hover:text-black hover:bg-white px-0.5 transition-colors"
                title="Remove handle modulation"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => assignHandleToRow(idx)}
              className="text-[7.5px] font-bold border border-dashed border-[#f15a22] text-[#f15a22] hover:bg-[#f15a22] hover:text-white px-1 py-0.2 rounded-[1px] transition-colors cursor-pointer"
              title="Assign Squeeze Handle to this effect"
            >
              + HNDL
            </button>
          )}

          {/* Shake */}
          {isShakeTarget ? (
            <div className="flex items-center gap-1 bg-[#141617] text-white px-1 py-0.5 rounded-[1px] font-bold">
              <span>SHK:</span>
              <select
                value={preset.shake?.param}
                onChange={(e) =>
                  onUpdatePreset({
                    ...preset,
                    shake: { row: idx, param: e.target.value, depth: preset.shake?.depth ?? 0.5 }
                  })
                }
                className="bg-black text-white text-[7.5px] px-0.5 py-0 border-0 outline-none uppercase"
              >
                {meta.params.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span>D:</span>
              <input
                type="number"
                step="0.05"
                value={preset.shake?.depth ?? 0.5}
                onChange={(e) =>
                  onUpdatePreset({
                    ...preset,
                    shake: {
                      row: idx,
                      param: preset.shake?.param || meta.params[0]?.name || 'mix',
                      depth: parseFloat(e.target.value) || 0
                    }
                  })
                }
                className="w-8 bg-black text-white text-center text-[7.5px] px-0.5 py-0 outline-none"
              />
              <button
                onClick={removeShake}
                className="hover:text-[#f15a22] px-0.5 transition-colors"
                title="Remove shake modulation"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => assignShakeToRow(idx)}
              className="text-[7.5px] font-bold border border-dashed border-[#141617] text-[#141617] hover:bg-[#141617] hover:text-white px-1 py-0.2 rounded-[1px] transition-colors cursor-pointer"
              title="Assign Shake Sensor to this effect"
            >
              + SHAKE
            </button>
          )}
        </div>

        {/* Compact Knobs Strip: 28px dials with always-visible numeric input */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {meta.params.map((param, pIdx) => {
            const currentVal =
              typeof effect[param.name] === 'number'
                ? effect[param.name]
                : param.defaultVal;

            const isParamModulated =
              (isHandleTarget && preset.handle?.param === param.name) ||
              (isShakeTarget && preset.shake?.param === param.name);

            const modSrc = (isHandleTarget && preset.handle?.param === param.name)
              ? 'HNDL'
              : (isShakeTarget && preset.shake?.param === param.name)
              ? 'SHK'
              : undefined;

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
                modulationSource={modSrc}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="te-ledger-card w-full flex flex-col select-none overflow-hidden min-h-[580px]">
      {/* 1. TOP ORANGE HEADER TAB */}
      <div className="bg-[#f15a22] text-white px-4 py-2.5 border-b border-[#141617] flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm tracking-wider uppercase text-white bg-black/30 px-2 py-0.5 rounded-[1px]">
              SLOT {preset.pos + 1}
            </span>
            <span className="text-[10px] font-mono text-white/80 font-medium">
              (OF 4 HARDWARE SLOTS)
            </span>
          </div>

          {/* High-Contrast Slot Name Field */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono font-bold text-white/80">NAME:</span>
            <input
              type="text"
              value={preset.name || ''}
              onChange={(e) => onUpdatePreset({ ...preset, name: e.target.value.toUpperCase() })}
              placeholder="SLOT NAME"
              className="bg-black text-white placeholder:text-white/40 px-2.5 py-1 font-mono text-xs font-bold tracking-wider uppercase border border-white/30 focus:outline-none focus:border-white w-[180px]"
              maxLength={20}
            />
          </div>
        </div>

        {/* Clear, High-Contrast Usage Comment / Description Field */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/20">
          <span className="text-[8.5px] font-mono font-bold text-white/80 shrink-0">NOTE:</span>
          <input
            type="text"
            value={preset.comment || ''}
            onChange={(e) => onUpdatePreset({ ...preset, comment: e.target.value })}
            placeholder="Add preset notes / usage hints (e.g., push handle to open filter)..."
            className="w-full bg-black/30 text-white placeholder:text-white/60 px-2 py-0.5 font-mono text-[10.5px] border border-white/25 focus:outline-none focus:bg-black/50 focus:border-white"
          />
        </div>
      </div>

      {/* 2. ZAPIER-STYLE VISUAL WORKFLOW CANVAS */}
      <div className="w-full p-5 bg-[#ffffff] flex flex-col items-center gap-0 relative border-b border-[#141617] overflow-x-auto">
        {/* Subtle Engineering Dot Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundImage: 'radial-gradient(#141617 1.2px, transparent 1.2px)',
            backgroundSize: '16px 16px'
          }}
        />

        {/* INPUT NODE (Top of Signal Flow) */}
        <div className="flex flex-col items-center relative z-10">
          <div className="bg-[#141617] text-white px-3.5 py-1.5 rounded-[2px] border border-[#141617] text-[10px] font-mono font-bold tracking-wider flex items-center gap-2 shadow-xs">
            <Volume2 className="w-3.5 h-3.5 text-[#f15a22]" />
            <span>AUDIO SOURCE / EP-2350 MIC</span>
          </div>
          {/* Vertical lead into SVG Fork */}
          <div className="w-[2px] h-3 bg-[#141617]" />
        </div>

        {/* SVG VECTOR FORK (Curved Branch Lines to Bus 1, Serial, Bus 2) */}
        <div className="w-full relative z-10 max-w-4xl">
          <svg
            className="w-full h-11 overflow-visible"
            viewBox="0 0 100 44"
            preserveAspectRatio="none"
          >
            {/* Central Vertical Stem */}
            <line
              x1="50"
              y1="0"
              x2="50"
              y2="14"
              stroke="#141617"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Fork Junction Node */}
            <circle cx="50" cy="14" r="3" fill="#141617" />

            {/* Left Branch Wire (Bus 1) */}
            <path
              d="M 50 14 C 50 30, 16.67 26, 16.67 44"
              stroke="#00a69c"
              strokeWidth="2"
              fill="none"
              strokeDasharray={bus1List.length > 0 ? 'none' : '3,3'}
              vectorEffect="non-scaling-stroke"
            />
            {/* Bus 1 Junction Dot */}
            <circle cx="16.67" cy="44" r="2.5" fill="#00a69c" />

            {/* Center Main Wire (Serial Chain) */}
            <line
              x1="50"
              y1="14"
              x2="50"
              y2="44"
              stroke="#141617"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Serial Junction Dot */}
            <circle cx="50" cy="44" r="2.5" fill="#141617" />

            {/* Right Branch Wire (Bus 2) */}
            <path
              d="M 50 14 C 50 30, 83.33 26, 83.33 44"
              stroke="#d99b26"
              strokeWidth="2"
              fill="none"
              strokeDasharray={bus2List.length > 0 ? 'none' : '3,3'}
              vectorEffect="non-scaling-stroke"
            />
            {/* Bus 2 Junction Dot */}
            <circle cx="83.33" cy="44" r="2.5" fill="#d99b26" />
          </svg>
        </div>

        {/* 3 PARALLEL WORKFLOW BRANCH COLUMNS */}
        <div className="w-full max-w-4xl grid grid-cols-3 gap-3 items-start relative z-10">
          {/* COLUMN 1: BUS 1 PARALLEL BRANCH (LEFT) */}
          <div className="flex flex-col items-center w-full min-w-0">
            {bus1List.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-2 w-full">
                <button
                  onClick={() => setAddMenuTarget({ bus: 1 })}
                  className="px-3 py-1.5 rounded-[2px] border border-dashed border-[#00a69c] text-[#00a69c] bg-[#00a69c]/5 hover:bg-[#00a69c] hover:text-white font-mono text-[9px] font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                  title="Add parallel effect to Bus 1"
                >
                  <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                  <span>+ PARALLEL BUS 1</span>
                </button>
                <span className="text-[7.5px] font-mono text-[#73787a] mt-1">
                  (LEFT BRANCH)
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                {/* Branch Header */}
                <div className="w-full bg-[#00a69c] text-white px-2.5 py-1 rounded-[2px] border border-[#00a69c] text-[9.5px] font-mono font-bold tracking-wider flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    <span>BUS 1 (PARALLEL)</span>
                  </div>
                  <button
                    onClick={() => setAddMenuTarget({ bus: 1 })}
                    className="bg-white text-[#00a69c] hover:bg-black hover:text-white px-1.5 py-0.2 text-[8.5px] font-bold rounded-[1px] flex items-center gap-0.5 cursor-pointer transition-colors"
                    title="Add effect to Bus 1"
                  >
                    <Plus className="w-2.5 h-2.5" /> ADD
                  </button>
                </div>

                {/* Wire from Header to First Card */}
                <div className="w-[2px] h-4 bg-[#00a69c]" />

                {/* Bus 1 Cards Stack */}
                {bus1List.map((item, bIdx) => (
                  <React.Fragment key={item.fx.id}>
                    {renderEffectCard(item)}
                    {/* Vertical Connector Line between effects */}
                    {bIdx < bus1List.length - 1 ? (
                      <div className="flex flex-col items-center relative my-1">
                        <div className="w-[2px] h-6 bg-[#00a69c]" />
                        <button
                          onClick={() => setAddMenuTarget({ bus: 1, insertIndex: item.idx + 1 })}
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#00a69c] text-[#00a69c] hover:bg-[#00a69c] hover:text-white flex items-center justify-center shadow-xs cursor-pointer text-[9px] font-bold transition-transform hover:scale-125 z-10"
                          title="Insert effect here in Bus 1"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <div className="w-[2px] h-4 bg-[#00a69c]" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* COLUMN 2: SERIAL CHAIN (CENTER MAIN) */}
          <div className="flex flex-col items-center w-full min-w-0">
            {/* Main Header */}
            <div className="w-full bg-[#141617] text-white px-2.5 py-1 rounded-[2px] border border-[#141617] text-[9.5px] font-mono font-bold tracking-wider flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-1">
                <Volume2 className="w-3 h-3 text-[#f15a22]" />
                <span>SERIAL CHAIN (MAIN)</span>
              </div>
              <button
                onClick={() => setAddMenuTarget({})}
                className="bg-white text-[#141617] hover:bg-[#f15a22] hover:text-white px-1.5 py-0.2 text-[8.5px] font-bold rounded-[1px] flex items-center gap-0.5 cursor-pointer transition-colors"
                title="Add serial effect"
              >
                <Plus className="w-2.5 h-2.5" /> ADD
              </button>
            </div>

            {/* Wire from Header to First Card */}
            <div className="w-[2px] h-4 bg-[#141617]" />

            {/* Serial Cards Stack */}
            {serialList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 w-full">
                <button
                  onClick={() => setAddMenuTarget({})}
                  className="px-3 py-1.5 rounded-[2px] border border-dashed border-[#141617] text-[#141617] bg-black/5 hover:bg-[#141617] hover:text-white font-mono text-[9px] font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                  title="Add effect to Serial chain"
                >
                  <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                  <span>+ ADD SERIAL EFFECT</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                {serialList.map((item, sIdx) => (
                  <React.Fragment key={item.fx.id}>
                    {renderEffectCard(item)}
                    {/* Vertical Connector Line between effects */}
                    {sIdx < serialList.length - 1 ? (
                      <div className="flex flex-col items-center relative my-1">
                        <div className="w-[2px] h-6 bg-[#141617]" />
                        <button
                          onClick={() => setAddMenuTarget({ insertIndex: item.idx + 1 })}
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#141617] text-[#141617] hover:bg-[#f15a22] hover:text-white flex items-center justify-center shadow-xs cursor-pointer text-[9px] font-bold transition-transform hover:scale-125 z-10"
                          title="Insert effect here in Serial chain"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <div className="w-[2px] h-4 bg-[#141617]" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* COLUMN 3: BUS 2 PARALLEL BRANCH (RIGHT) */}
          <div className="flex flex-col items-center w-full min-w-0">
            {bus2List.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-2 w-full">
                <button
                  onClick={() => setAddMenuTarget({ bus: 2 })}
                  className="px-3 py-1.5 rounded-[2px] border border-dashed border-[#d99b26] text-[#d99b26] bg-[#d99b26]/5 hover:bg-[#d99b26] hover:text-white font-mono text-[9px] font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                  title="Add parallel effect to Bus 2"
                >
                  <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                  <span>+ PARALLEL BUS 2</span>
                </button>
                <span className="text-[7.5px] font-mono text-[#73787a] mt-1">
                  (RIGHT BRANCH)
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                {/* Branch Header */}
                <div className="w-full bg-[#d99b26] text-white px-2.5 py-1 rounded-[2px] border border-[#d99b26] text-[9.5px] font-mono font-bold tracking-wider flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    <span>BUS 2 (PARALLEL)</span>
                  </div>
                  <button
                    onClick={() => setAddMenuTarget({ bus: 2 })}
                    className="bg-white text-[#d99b26] hover:bg-black hover:text-white px-1.5 py-0.2 text-[8.5px] font-bold rounded-[1px] flex items-center gap-0.5 cursor-pointer transition-colors"
                    title="Add effect to Bus 2"
                  >
                    <Plus className="w-2.5 h-2.5" /> ADD
                  </button>
                </div>

                {/* Wire from Header to First Card */}
                <div className="w-[2px] h-4 bg-[#d99b26]" />

                {/* Bus 2 Cards Stack */}
                {bus2List.map((item, bIdx) => (
                  <React.Fragment key={item.fx.id}>
                    {renderEffectCard(item)}
                    {/* Vertical Connector Line between effects */}
                    {bIdx < bus2List.length - 1 ? (
                      <div className="flex flex-col items-center relative my-1">
                        <div className="w-[2px] h-6 bg-[#d99b26]" />
                        <button
                          onClick={() => setAddMenuTarget({ bus: 2, insertIndex: item.idx + 1 })}
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#d99b26] text-[#d99b26] hover:bg-[#d99b26] hover:text-white flex items-center justify-center shadow-xs cursor-pointer text-[9px] font-bold transition-transform hover:scale-125 z-10"
                          title="Insert effect here in Bus 2"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <div className="w-[2px] h-4 bg-[#d99b26]" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SVG VECTOR MERGE (Curved Lines Converging into Master Out) */}
        <div className="w-full relative z-10 max-w-4xl">
          <svg
            className="w-full h-11 overflow-visible"
            viewBox="0 0 100 44"
            preserveAspectRatio="none"
          >
            {/* Bus 1 Top Terminal Dot */}
            <circle cx="16.67" cy="0" r="2.5" fill={bus1List.length > 0 ? '#00a69c' : '#d2d5d2'} />
            {/* Serial Top Terminal Dot */}
            <circle cx="50" cy="0" r="2.5" fill="#141617" />
            {/* Bus 2 Top Terminal Dot */}
            <circle cx="83.33" cy="0" r="2.5" fill={bus2List.length > 0 ? '#d99b26' : '#d2d5d2'} />

            {/* Left Branch Merge Wire (Bus 1) */}
            <path
              d="M 16.67 0 C 16.67 18, 50 14, 50 30"
              stroke={bus1List.length > 0 ? '#00a69c' : '#d2d5d2'}
              strokeWidth="2"
              fill="none"
              strokeDasharray={bus1List.length > 0 ? 'none' : '2,2'}
              vectorEffect="non-scaling-stroke"
            />

            {/* Center Main Wire (Serial Chain) */}
            <line
              x1="50"
              y1="0"
              x2="50"
              y2="30"
              stroke="#141617"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />

            {/* Right Branch Merge Wire (Bus 2) */}
            <path
              d="M 83.33 0 C 83.33 18, 50 14, 50 30"
              stroke={bus2List.length > 0 ? '#d99b26' : '#d2d5d2'}
              strokeWidth="2"
              fill="none"
              strokeDasharray={bus2List.length > 0 ? 'none' : '2,2'}
              vectorEffect="non-scaling-stroke"
            />

            {/* Merge Junction Node */}
            <circle cx="50" cy="30" r="3" fill="#141617" />

            {/* Lead Wire to Master Out */}
            <line
              x1="50"
              y1="30"
              x2="50"
              y2="44"
              stroke="#141617"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {/* OUTPUT NODE (Bottom of Signal Flow) */}
        <div className="flex flex-col items-center relative z-10">
          <div className="bg-[#141617] text-white px-3.5 py-1.5 rounded-[2px] border border-[#141617] text-[10px] font-mono font-bold tracking-wider shadow-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00a69c] shadow-[0_0_6px_#00a69c]" />
            <span>SUMMING / MASTER OUT</span>
          </div>
        </div>

        {/* SMART 1-CLICK EFFECT ADDITION POPOVER */}
        {addMenuTarget && (
          <div
            ref={popoverRef}
            className="absolute left-1/2 -translate-x-1/2 bottom-12 bg-white border-2 border-[#141617] shadow-2xl p-2.5 z-50 w-72 flex flex-col gap-1 rounded-[2px]"
          >
            <div className="flex items-center justify-between border-b border-[#e2e4e2] pb-1 mb-1">
              <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#f15a22]">
                INSERT EFFECT TO (
                {addMenuTarget.bus === 1 ? 'BUS 1 LEFT' : addMenuTarget.bus === 2 ? 'BUS 2 RIGHT' : 'SERIAL MAIN'})
              </span>
              <button
                onClick={() => setAddMenuTarget(null)}
                className="text-xs text-[#73787a] hover:text-[#141617] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
              {Object.keys(EFFECTS_REGISTRY).map((key) => {
                const meta = EFFECTS_REGISTRY[key as EffectType];
                const isSingleAlreadyUsed = meta.singleInstance && existingTypes.has(key as EffectType);

                if (isSingleAlreadyUsed) {
                  return (
                    <div
                      key={key}
                      className="px-2 py-1 text-[9.5px] font-mono text-[#abb5ba] flex items-center justify-between cursor-not-allowed bg-black/5"
                      title="This effect can only be used once per chain (Chapter 7 spec)"
                    >
                      <span>{meta.displayName}</span>
                      <span className="text-[7.5px] italic">(already in chain)</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={key}
                    onClick={() => handleAddEffect(key as EffectType, addMenuTarget.bus, addMenuTarget.insertIndex)}
                    className="px-2 py-1 text-[9.5px] font-mono font-bold text-[#141617] hover:bg-[#f15a22] hover:text-white flex items-center justify-between text-left transition-colors cursor-pointer rounded-[1px]"
                  >
                    <span>{meta.displayName}</span>
                    <span className="text-[7.5px] opacity-70">
                      {meta.params.length} params
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. ADVANCED MODULATION: CHAPTER 7.9 LFO CYCLER */}
      <div className="mt-auto border-t border-[#141617] bg-[#f8f9f8] p-3 border-x-0 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-[#e2e4e2] pb-1">
          <span className="text-[9px] font-bold text-[#141617] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[#00a69c]" />
            ADVANCED MODULATION: LFO CYCLER (CHAPTER 7.9)
          </span>
          <span className="text-[8px] font-mono text-[#73787a]">
            GLOBAL AUTOMATION OVER TIME
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[10px] font-mono gap-3">
          {/* LFO Shape & Speed */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#00a69c]">LFO SHAPE:</span>
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
              className="bg-[#fff] border border-[#d2d5d2] px-1.5 py-0.5 text-[9px] font-mono"
            >
              <option value="sine">SINE (SMOOTH)</option>
              <option value="square">SQUARE (ON/OFF CHOP)</option>
              <option value="sawtooth">SAW (RAMP)</option>
              <option value="random">RANDOM (CHAOS)</option>
            </select>

            <span className="font-bold text-[#00a69c]">SPEED:</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="20"
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

          {/* Handle Modulates LFO Speed (Advanced Feature Chapter 7.9) */}
          <div className="flex items-center gap-1.5 bg-white px-2 py-1 border border-[#d2d5d2]">
            <input
              type="checkbox"
              id="handleLfoSpeed"
              checked={preset.handle?.target === 'lfo'}
              onChange={(e) => {
                if (e.target.checked) {
                  onUpdatePreset({
                    ...preset,
                    handle: { target: 'lfo', param: 'speed', depth: 10.0 }
                  });
                } else if (preset.handle?.target === 'lfo') {
                  const copy = { ...preset };
                  delete copy.handle;
                  onUpdatePreset(copy);
                }
              }}
              className="cursor-pointer"
            />
            <label htmlFor="handleLfoSpeed" className="text-[8.5px] font-mono font-bold text-[#141617] cursor-pointer">
              SQUEEZE HANDLE ACCELERATES LFO SPEED
            </label>
            {preset.handle?.target === 'lfo' && (
              <div className="flex items-center gap-1 ml-1 text-[8px]">
                <span>+DEPTH:</span>
                <input
                  type="number"
                  step="1"
                  value={preset.handle?.depth ?? 10.0}
                  onChange={(e) =>
                    onUpdatePreset({
                      ...preset,
                      handle: { target: 'lfo', param: 'speed', depth: parseFloat(e.target.value) || 0 }
                    })
                  }
                  className="w-10 bg-white border border-[#d2d5d2] px-1 py-0 text-center font-mono"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
