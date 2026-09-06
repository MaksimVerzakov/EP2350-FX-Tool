import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
  GitBranch
} from 'lucide-react';

interface PresetLedgerProps {
  preset: PresetConfig;
  totalPresets?: number;
  onUpdatePreset: (updated: PresetConfig) => void;
  onSelectPreset?: (index: number) => void;
}

// Teenage Engineering EP Sidekick 4-Knob Discipline (Orange, Cream, Slate Gray, Black)
// From EP-136 hardware overview: GAIN (Orange), HIGH (Cream), MID (Slate Gray), LOW (Black)
// For effects with 5 knobs (like REVERB), knob 5 repeats color 1 (#f15a22).
const EP_SIDEKICK_KNOB_COLORS = ['#f15a22', '#e4e3df', '#989fa5', '#231f20'];

export const PresetLedger: React.FC<PresetLedgerProps> = ({
  preset,
  totalPresets = 4,
  onUpdatePreset,
  onSelectPreset
}) => {
  // Dual-Bus Active Tab: Bus 1 (Primary) or Bus 2 (Parallel)
  const [activeBus, setActiveBus] = useState<1 | 2>(1);

  // Auto-scroll target when an effect is newly added or moved
  const [lastAddedEffectId, setLastAddedEffectId] = useState<string | null>(null);

  // Popover state for effect addition with dynamic anchor positioning
  const [addMenuTarget, setAddMenuTarget] = useState<null | {
    triggerId: string;
    insertIndex?: number;
    top: number;
    left: number;
    placement: 'top' | 'bottom';
  }>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newly added or transferred effect
  useEffect(() => {
    if (lastAddedEffectId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`effect-card-${lastAddedEffectId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        setLastAddedEffectId(null);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [preset.list, lastAddedEffectId]);

  // Close popover when clicking outside or switching buses
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('[data-add-effect-trigger]')
      ) {
        setAddMenuTarget(null);
      }
    };
    if (addMenuTarget) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [addMenuTarget]);

  useEffect(() => {
    setAddMenuTarget(null);
  }, [activeBus]);

  // Fine-tune popover top position if opening above the button
  useLayoutEffect(() => {
    if (addMenuTarget && popoverRef.current && addMenuTarget.placement === 'top') {
      const actualHeight = popoverRef.current.offsetHeight;
      if (actualHeight && Math.abs(actualHeight - 280) > 4) {
        const correctedTop = Math.max(8, addMenuTarget.top + (280 - actualHeight));
        popoverRef.current.style.top = `${correctedTop}px`;
      }
    }
  }, [addMenuTarget]);

  // Scroll popover into view if partially obscured
  useEffect(() => {
    if (addMenuTarget && popoverRef.current) {
      popoverRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [addMenuTarget]);

  const openAddMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    insertIndex?: number,
    triggerId: string = 'bottom'
  ) => {
    e.stopPropagation();

    // Toggle closed if clicking the same trigger button
    if (addMenuTarget && addMenuTarget.triggerId === triggerId) {
      setAddMenuTarget(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setAddMenuTarget({
        triggerId,
        insertIndex,
        top: 56,
        left: 100,
        placement: 'bottom'
      });
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const buttonRect = e.currentTarget.getBoundingClientRect();

    const popoverWidth = 288; // w-72 (18rem)
    const popoverHeight = 280;

    // Position relative to canvas scroll container
    const buttonCenterRelX = buttonRect.left - canvasRect.left + buttonRect.width / 2;
    const buttonBottomRelY = buttonRect.bottom - canvasRect.top + canvas.scrollTop;
    const buttonTopRelY = buttonRect.top - canvasRect.top + canvas.scrollTop;

    // Horizontal centering clamped inside canvas
    const canvasWidth = canvas.clientWidth;
    const left = Math.max(12, Math.min(canvasWidth - popoverWidth - 12, buttonCenterRelX - popoverWidth / 2));

    // Vertical placement: check available space below vs above inside visible canvas viewport
    const spaceBelowInViewport = canvasRect.bottom - buttonRect.bottom;
    const spaceAboveInViewport = buttonRect.top - canvasRect.top;

    let top: number;
    let placement: 'top' | 'bottom';

    if (spaceBelowInViewport >= popoverHeight || spaceBelowInViewport >= spaceAboveInViewport) {
      placement = 'bottom';
      top = buttonBottomRelY + 8;
    } else {
      placement = 'top';
      top = Math.max(8, buttonTopRelY - popoverHeight - 8);
    }

    setAddMenuTarget({ triggerId, insertIndex, top, left, placement });
  };

  // Track existing effect types across BOTH buses for single-instance constraints
  const existingEffectsMap = new Map<EffectType, 1 | 2>();
  preset.list.forEach((fx) => {
    const bus = fx.BUS === 2 ? 2 : 1;
    existingEffectsMap.set(fx.effect, bus);
  });

  // Filtered lists for each bus
  const bus1Items = preset.list
    .map((fx, idx) => ({ fx, idx }))
    .filter((item) => item.fx.BUS !== 2);

  const bus2Items = preset.list
    .map((fx, idx) => ({ fx, idx }))
    .filter((item) => item.fx.BUS === 2);

  const currentBusItems = activeBus === 1 ? bus1Items : bus2Items;

  // 1-Click Smart Effect Addition
  const handleAddEffect = (effectType: EffectType, insertBusIndex?: number) => {
    const meta = EFFECTS_REGISTRY[effectType];
    const newEffect: AnyEffect = {
      id: `fx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      effect: effectType
    };

    if (activeBus === 2) {
      newEffect.BUS = 2;
    } // Bus 1 omits BUS property by default

    meta.params.forEach((p) => {
      newEffect[p.name] = p.defaultVal;
    });

    let newList = [...preset.list];

    // Determine insertion position in the global preset.list
    if (typeof insertBusIndex === 'number' && insertBusIndex >= 0 && insertBusIndex < currentBusItems.length) {
      const targetGlobalIndex = currentBusItems[insertBusIndex].idx;
      newList.splice(targetGlobalIndex, 0, newEffect);
    } else if (activeBus === 1) {
      // Append at end of Bus 1 items or start of Bus 2 items
      const lastBus1 = bus1Items[bus1Items.length - 1];
      if (lastBus1) {
        newList.splice(lastBus1.idx + 1, 0, newEffect);
      } else {
        newList.unshift(newEffect);
      }
    } else {
      // Append at end of preset.list
      newList.push(newEffect);
    }

    const updatedPreset: PresetConfig = {
      ...preset,
      list: newList
    };

    // Auto-bind trigger if SAMPLE was added
    if (effectType === 'SAMPLE') {
      const sampleIdx = newList.findIndex((e) => e.effect === 'SAMPLE');
      if (sampleIdx !== -1) {
        updatedPreset.trigger = { row: sampleIdx };
      }
    }

    setLastAddedEffectId(newEffect.id);
    onUpdatePreset(updatedPreset);
    setAddMenuTarget(null);
  };

  const handleUpdateEffect = (globalIdx: number, updated: AnyEffect) => {
    const newList = [...preset.list];
    newList[globalIdx] = updated;
    onUpdatePreset({
      ...preset,
      list: newList
    });
  };

  const handleDeleteEffect = (globalIdx: number) => {
    const deletedFx = preset.list[globalIdx];
    const newList = preset.list.filter((_, i) => i !== globalIdx);
    const updatedPreset: PresetConfig = { ...preset, list: newList };

    // Re-index or clear handle
    if (updatedPreset.handle && updatedPreset.handle.target !== 'lfo' && typeof updatedPreset.handle.row === 'number') {
      if (updatedPreset.handle.row === globalIdx) delete updatedPreset.handle;
      else if (updatedPreset.handle.row > globalIdx) updatedPreset.handle = { ...updatedPreset.handle, row: updatedPreset.handle.row - 1 };
    }

    // Re-index or clear shake
    if (updatedPreset.shake && typeof updatedPreset.shake.row === 'number') {
      if (updatedPreset.shake.row === globalIdx) delete updatedPreset.shake;
      else if (updatedPreset.shake.row > globalIdx) updatedPreset.shake = { ...updatedPreset.shake, row: updatedPreset.shake.row - 1 };
    }

    // Auto-clean trigger if SAMPLE was deleted, or re-index
    if (deletedFx?.effect === 'SAMPLE') {
      delete updatedPreset.trigger;
    } else if (updatedPreset.trigger && typeof updatedPreset.trigger.row === 'number') {
      if (updatedPreset.trigger.row > globalIdx) {
        updatedPreset.trigger = { row: updatedPreset.trigger.row - 1 };
      }
    }

    onUpdatePreset(updatedPreset);
  };

  // Reordering within the active bus
  const handleMoveBusItem = (busItemIdx: number, direction: 'up' | 'down') => {
    const targetBusItemIdx = direction === 'up' ? busItemIdx - 1 : busItemIdx + 1;
    if (targetBusItemIdx < 0 || targetBusItemIdx >= currentBusItems.length) return;

    const fromGlobalIdx = currentBusItems[busItemIdx].idx;
    const toGlobalIdx = currentBusItems[targetBusItemIdx].idx;

    const newList = [...preset.list];
    const [moved] = newList.splice(fromGlobalIdx, 1);
    newList.splice(toGlobalIdx, 0, moved);

    const updatedPreset: PresetConfig = { ...preset, list: newList };

    const remapRow = (row?: number) => {
      if (typeof row !== 'number') return undefined;
      if (row === fromGlobalIdx) return toGlobalIdx;
      if (fromGlobalIdx < toGlobalIdx && row > fromGlobalIdx && row <= toGlobalIdx) return row - 1;
      if (fromGlobalIdx > toGlobalIdx && row >= toGlobalIdx && row < fromGlobalIdx) return row + 1;
      return row;
    };

    if (updatedPreset.handle && updatedPreset.handle.target !== 'lfo' && typeof updatedPreset.handle.row === 'number') {
      updatedPreset.handle = { ...updatedPreset.handle, row: remapRow(updatedPreset.handle.row)! };
    }
    if (updatedPreset.shake && typeof updatedPreset.shake.row === 'number') {
      updatedPreset.shake = { ...updatedPreset.shake, row: remapRow(updatedPreset.shake.row)! };
    }
    if (updatedPreset.trigger && typeof updatedPreset.trigger.row === 'number') {
      updatedPreset.trigger = { row: remapRow(updatedPreset.trigger.row)! };
    }

    onUpdatePreset(updatedPreset);
  };

  // Transfer effect between Bus 1 and Bus 2
  const handleTransferBus = (globalIdx: number) => {
    const fx = preset.list[globalIdx];
    if (!fx) return;
    if (fx.effect === 'SAMPLE' && fx.BUS !== 2) {
      // SAMPLE cannot move to Bus 2
      return;
    }

    const updated: AnyEffect = { ...fx };
    const destinationBus: 1 | 2 = fx.BUS === 2 ? 1 : 2;
    if (fx.BUS === 2) {
      delete updated.BUS; // Moves to Bus 1
    } else {
      updated.BUS = 2; // Moves to Bus 2
    }

    handleUpdateEffect(globalIdx, updated);
    setLastAddedEffectId(fx.id);
    setActiveBus(destinationBus); // Auto-switch tab to see immediate impact
  };

  // In-Situ Modulation Helpers for an effect by its global index
  const isHandleOnRow = (globalIdx: number) =>
    preset.handle?.target !== 'lfo' && preset.handle?.row === globalIdx;

  const isShakeOnRow = (globalIdx: number) =>
    preset.shake?.row === globalIdx;

  const assignHandleToRow = (globalIdx: number) => {
    const ef = preset.list[globalIdx];
    const m = ef ? EFFECTS_REGISTRY[ef.effect] : null;
    const defaultParam = m?.params[0]?.name || 'cutoff';
    onUpdatePreset({
      ...preset,
      handle: { row: globalIdx, param: defaultParam, depth: 80 }
    });
  };

  const removeHandle = () => {
    const copy = { ...preset };
    delete copy.handle;
    onUpdatePreset(copy);
  };

  const assignShakeToRow = (globalIdx: number) => {
    const ef = preset.list[globalIdx];
    const m = ef ? EFFECTS_REGISTRY[ef.effect] : null;
    const defaultParam = m?.params[0]?.name || 'mix';
    onUpdatePreset({
      ...preset,
      shake: { row: globalIdx, param: defaultParam, depth: 50 }
    });
  };

  const removeShake = () => {
    const copy = { ...preset };
    delete copy.shake;
    onUpdatePreset(copy);
  };

  // Render a single effect card
  const renderEffectCard = (item: { fx: AnyEffect; idx: number }, busPosition: number) => {
    const { fx: effect, idx: globalIdx } = item;
    const meta = EFFECTS_REGISTRY[effect.effect] || EFFECTS_REGISTRY.LOWPASS;
    const isSample = effect.effect === 'SAMPLE';

    const isHandleTarget = isHandleOnRow(globalIdx);
    const isShakeTarget = isShakeOnRow(globalIdx);
    const isBus2 = effect.BUS === 2;

    return (
      <div
        id={`effect-card-${effect.id}`}
        key={effect.id}
        className={`w-full border p-3 flex flex-col gap-2 transition-all duration-75 relative rounded-[0px] shadow-[2px_2px_0px_#141617] ${
          isBus2
            ? 'border-l-[4px] border-l-[#d99b26] border-[#141617] bg-[#fffdfa]'
            : isSample
            ? 'border-l-[4px] border-l-[#f15a22] border-[#141617] bg-[#fffcfb]'
            : 'border-l-[4px] border-l-[#00a69c] border-[#141617] bg-[#ffffff] hover:border-[#000000]'
        }`}
      >
        {/* Card Header Bar */}
        <div className="flex items-center justify-between border-b border-[#eceeed] pb-1.5 gap-2">
          {/* Sequential Step Counter & Effect Name (NO visible row numbers) */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] font-bold text-[#f15a22]">
              {(busPosition + 1).toString().padStart(2, '0')}.
            </span>
            <span className="font-bold text-[12px] uppercase tracking-tight text-[#141617] truncate">
              {meta.displayName}
            </span>
          </div>

          {/* Action Controls: Positioned Directional Control Cluster & Delete */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Unified Directional Cluster: [↑][↓][→] on Bus 1, [←][↑][↓] on Bus 2 */}
            <div className="flex items-center border border-[#141617] bg-[#f8f9f8] rounded-[0px] shadow-[1px_1px_0px_#141617] divide-x divide-[#141617]">
              {/* Bus 2: [ ← ] to move to Bus 1 */}
              {activeBus === 2 && (
                <button
                  onClick={() => handleTransferBus(globalIdx)}
                  className="p-1 hover:bg-[#00a69c] hover:text-white text-[#00a69c] active:translate-x-[1px] active:translate-y-[1px] transition-colors cursor-pointer"
                  title="Move effect to Bus 1"
                >
                  <ArrowLeft className="w-3 h-3" />
                </button>
              )}

              {/* Move Up */}
              <button
                disabled={busPosition === 0}
                onClick={() => handleMoveBusItem(busPosition, 'up')}
                className="p-1 hover:bg-[#141617] hover:text-white text-[#141617] disabled:opacity-20 disabled:pointer-events-none active:translate-x-[1px] active:translate-y-[1px] transition-colors cursor-pointer"
                title="Move earlier in signal path"
              >
                <ArrowUp className="w-3 h-3" />
              </button>

              {/* Move Down */}
              <button
                disabled={busPosition === currentBusItems.length - 1}
                onClick={() => handleMoveBusItem(busPosition, 'down')}
                className="p-1 hover:bg-[#141617] hover:text-white text-[#141617] disabled:opacity-20 disabled:pointer-events-none active:translate-x-[1px] active:translate-y-[1px] transition-colors cursor-pointer"
                title="Move later in signal path"
              >
                <ArrowDown className="w-3 h-3" />
              </button>

              {/* Bus 1: [ → ] to move to Bus 2 */}
              {activeBus === 1 && (
                <button
                  disabled={isSample}
                  onClick={() => handleTransferBus(globalIdx)}
                  className="p-1 hover:bg-[#d99b26] hover:text-white text-[#d99b26] disabled:opacity-20 disabled:pointer-events-none active:translate-x-[1px] active:translate-y-[1px] transition-colors cursor-pointer"
                  title={isSample ? 'SAMPLE is restricted to Bus 1' : 'Move effect to Bus 2'}
                >
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Delete button */}
            <button
              onClick={() => handleDeleteEffect(globalIdx)}
              className="p-1 text-[#73787a] hover:text-[#e52817] active:translate-x-[1px] active:translate-y-[1px] transition-colors cursor-pointer ml-0.5"
              title="Delete effect"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* In-Situ Modulation Strip directly on card */}
        <div className="flex flex-wrap items-center gap-1.5 text-[8px] font-mono">
          {/* Handle Modulation */}
          {isHandleTarget ? (
            <div className="flex items-center gap-1 bg-[#f15a22] text-white px-1.5 py-0.5 rounded-[1px] font-bold">
              <span>HNDL:</span>
              <select
                value={preset.handle?.param}
                onChange={(e) =>
                  onUpdatePreset({
                    ...preset,
                    handle: { row: globalIdx, param: e.target.value, depth: preset.handle?.depth ?? 80 }
                  })
                }
                className="bg-black text-white text-[8px] px-1 py-0 border-0 outline-none uppercase"
              >
                {meta.params.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span>DEPTH:</span>
              <div className="flex items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={
                    typeof preset.handle?.depth === 'number'
                      ? (preset.handle.depth <= 1.0 ? Math.round(preset.handle.depth * 100) : Math.round(preset.handle.depth))
                      : 80
                  }
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value) || 0;
                    const clamped = Math.max(0, Math.min(100, parsed));
                    onUpdatePreset({
                      ...preset,
                      handle: {
                        row: globalIdx,
                        param: preset.handle?.param || meta.params[0]?.name || 'cutoff',
                        depth: clamped
                      }
                    });
                  }}
                  className="w-8 bg-black text-white text-center text-[8px] px-0.5 py-0 outline-none font-mono"
                />
                <span className="text-[7.5px] text-white/70 ml-0.5">%</span>
              </div>
              <button
                onClick={removeHandle}
                className="hover:text-black hover:bg-white px-0.5 transition-colors cursor-pointer"
                title="Remove handle modulation"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => assignHandleToRow(globalIdx)}
              className="text-[8px] font-bold border border-dashed border-[#f15a22] text-[#f15a22] hover:bg-[#f15a22] hover:text-white px-1.5 py-0.5 rounded-[1px] transition-colors cursor-pointer"
              title="Assign Squeeze Handle to modulate this effect"
            >
              + HNDL
            </button>
          )}

          {/* Shake Modulation */}
          {isShakeTarget ? (
            <div className="flex items-center gap-1 bg-[#141617] text-white px-1.5 py-0.5 rounded-[1px] font-bold">
              <span>SHK:</span>
              <select
                value={preset.shake?.param}
                onChange={(e) =>
                  onUpdatePreset({
                    ...preset,
                    shake: { row: globalIdx, param: e.target.value, depth: preset.shake?.depth ?? 50 }
                  })
                }
                className="bg-black text-white text-[8px] px-1 py-0 border-0 outline-none uppercase"
              >
                {meta.params.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span>DEPTH:</span>
              <div className="flex items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={
                    typeof preset.shake?.depth === 'number'
                      ? (preset.shake.depth <= 1.0 ? Math.round(preset.shake.depth * 100) : Math.round(preset.shake.depth))
                      : 50
                  }
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value) || 0;
                    const clamped = Math.max(0, Math.min(100, parsed));
                    onUpdatePreset({
                      ...preset,
                      shake: {
                        row: globalIdx,
                        param: preset.shake?.param || meta.params[0]?.name || 'mix',
                        depth: clamped
                      }
                    });
                  }}
                  className="w-8 bg-black text-white text-center text-[8px] px-0.5 py-0 outline-none font-mono"
                />
                <span className="text-[7.5px] text-white/70 ml-0.5">%</span>
              </div>
              <button
                onClick={removeShake}
                className="hover:text-black hover:bg-white px-0.5 transition-colors cursor-pointer"
                title="Remove shake modulation"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => assignShakeToRow(globalIdx)}
              className="text-[8px] font-bold border border-dashed border-[#141617] text-[#141617] hover:bg-[#141617] hover:text-white px-1.5 py-0.5 rounded-[1px] transition-colors cursor-pointer"
              title="Assign Shake Sensor to modulate this effect"
            >
              + SHAKE
            </button>
          )}

          {/* Linked Trigger Indicator for SAMPLE */}
          {isSample && (
            <span className="text-[8px] font-bold bg-[#f15a22]/15 text-[#f15a22] border border-[#f15a22]/30 px-1.5 py-0.5 rounded-[1px] flex items-center gap-1">
              <span>TRIGGER: WHITE BTN</span>
            </span>
          )}
        </div>

        {/* Knobs Strip: 2 lines for DELAY (8 knobs), inline for <= 5 knobs */}
        {meta.params.length > 5 ? (
          <div className="grid grid-cols-4 gap-x-6 gap-y-3.5 pt-1.5 w-fit">
            {meta.params.map((param, pIdx) => {
              const currentVal =
                typeof effect[param.name] === 'number'
                  ? effect[param.name]
                  : param.defaultVal;

              const isParamModulated =
                (isHandleTarget && preset.handle?.param === param.name) ||
                (isShakeTarget && preset.shake?.param === param.name);

              const modSrc =
                isHandleTarget && preset.handle?.param === param.name
                  ? 'HNDL'
                  : isShakeTarget && preset.shake?.param === param.name
                  ? 'SHK'
                  : undefined;

              const encoderColor = EP_SIDEKICK_KNOB_COLORS[pIdx % 4];

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
                  onChange={(v) => handleUpdateEffect(globalIdx, { ...effect, [param.name]: v })}
                  onReset={() => handleUpdateEffect(globalIdx, { ...effect, [param.name]: param.defaultVal })}
                  accentColor={encoderColor}
                  size={36}
                  isModulated={isParamModulated}
                  modulationSource={modSrc}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3.5 pt-1.5">
            {meta.params.map((param, pIdx) => {
              const currentVal =
                typeof effect[param.name] === 'number'
                  ? effect[param.name]
                  : param.defaultVal;

              const isParamModulated =
                (isHandleTarget && preset.handle?.param === param.name) ||
                (isShakeTarget && preset.shake?.param === param.name);

              const modSrc =
                isHandleTarget && preset.handle?.param === param.name
                  ? 'HNDL'
                  : isShakeTarget && preset.shake?.param === param.name
                  ? 'SHK'
                  : undefined;

              const encoderColor = EP_SIDEKICK_KNOB_COLORS[pIdx % 4];

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
                  onChange={(v) => handleUpdateEffect(globalIdx, { ...effect, [param.name]: v })}
                  onReset={() => handleUpdateEffect(globalIdx, { ...effect, [param.name]: param.defaultVal })}
                  accentColor={encoderColor}
                  size={36}
                  isModulated={isParamModulated}
                  modulationSource={modSrc}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="te-ledger-card w-full flex flex-col select-none overflow-hidden h-[624px]">
      {/* 1. TOP ORANGE HEADER TAB (With 45° Extruded Right Binder Facet) */}
      <div className="relative bg-[#f15a22] text-white px-4 py-2 border-b border-[#141617] border-t border-white/25 flex items-center justify-between gap-3 shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
        {/* 45° Extruded Binder Tab Edge on the Right */}
        <div className="absolute -right-[12px] top-0 bottom-0 w-[12px] overflow-hidden pointer-events-none hidden sm:block">
          <svg className="w-full h-full" viewBox="0 0 12 40" preserveAspectRatio="none">
            <polygon points="0,0 12,12 12,40 0,40" fill="#d14612" stroke="#141617" strokeWidth="1" />
          </svg>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Preset Badge with Up/Down Controls */}
          <div className="flex items-center bg-black/40 border border-white/30 rounded-[0px] font-mono shadow-[1px_1px_0px_rgba(0,0,0,0.5)]">
            <span className="px-2.5 py-1 font-bold text-xs tracking-wider uppercase text-white">
              PRESET {preset.pos + 1}
            </span>
            <div className="flex items-center border-l border-white/20 divide-x divide-white/20">
              <button
                onClick={() => onSelectPreset?.((preset.pos - 1 + totalPresets) % totalPresets)}
                className="p-1 hover:bg-white hover:text-black text-white/90 active:translate-x-[1px] active:translate-y-[1px] transition-colors cursor-pointer"
                title={`Previous Preset (Preset ${((preset.pos - 1 + totalPresets) % totalPresets) + 1})`}
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onSelectPreset?.((preset.pos + 1) % totalPresets)}
                className="p-1 hover:bg-white hover:text-black text-white/90 active:translate-x-[1px] active:translate-y-[1px] transition-colors cursor-pointer"
                title={`Next Preset (Preset ${((preset.pos + 1) % totalPresets) + 1})`}
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Name Field Directly Beside Preset Number (No "NAME:" Label) */}
          <input
            type="text"
            value={preset.name || ''}
            onChange={(e) => onUpdatePreset({ ...preset, name: e.target.value.toUpperCase() })}
            placeholder="PRESET NAME"
            className="bg-black text-white placeholder:text-white/40 px-2.5 py-1 font-mono text-xs font-bold tracking-wider uppercase border border-white/30 focus:outline-none focus:border-white w-[200px]"
            maxLength={20}
          />
        </div>
      </div>

      {/* 2. DUAL PARALLEL BUS PHYSICAL SWITCH BAR */}
      <div className="bg-[#eceeed] border-b border-[#141617] flex items-center justify-center px-4 py-2 shrink-0 select-none">
        {/* PHYSICAL TE MECHANICAL DUAL BUS CONSOLE */}
        <div className="flex items-center justify-between bg-[#f8f9f8] px-3 py-1.5 rounded-[0px] border border-[#141617] shadow-[1px_1px_0px_#141617] w-full max-w-[460px]">
          {/* Left Station: BUS 1 */}
          <button
            type="button"
            onClick={() => setActiveBus(1)}
            className="flex items-center gap-2.5 flex-1 justify-start group cursor-pointer focus:outline-none"
            title="Switch to Bus 1 (Primary signal path)"
          >
            <div className="flex items-center gap-1.5">
              {/* Status LED Indicator */}
              <span
                className={`w-2.5 h-2.5 rounded-full border border-black/40 transition-all ${
                  activeBus === 1
                    ? 'bg-[#00a69c] shadow-[0_0_8px_#00a69c]'
                    : 'bg-black/15'
                }`}
              />
              <div className="flex flex-col items-start leading-tight">
                <span
                  className={`font-mono text-[11px] font-bold tracking-wider uppercase transition-colors ${
                    activeBus === 1 ? 'text-[#141617]' : 'text-[#8a9092] group-hover:text-[#141617]'
                  }`}
                >
                  BUS 1
                </span>
                <span className="font-mono text-[8px] text-[#73787a] tracking-tight uppercase">
                  PRIMARY
                </span>
              </div>
            </div>

            {/* Symmetrical TE LCD-Style Tally Counter */}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-bold rounded-[1px] border border-[#141617] shadow-[1px_1px_0px_#141617] transition-all ${
                activeBus === 1
                  ? 'bg-[#00a69c] text-white'
                  : 'bg-[#e4e7e5] text-[#73787a]'
              }`}
            >
              <span>{String(bus1Items.length).padStart(2, '0')}</span>
              <span className="text-[8px] opacity-75 font-normal">FX</span>
            </div>
          </button>

          {/* Center Physical Slider Toggle Switch */}
          <div className="px-3 shrink-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setActiveBus(activeBus === 1 ? 2 : 1)}
              className="relative w-14 h-6 bg-[#181a1b] rounded-[0px] border border-[#000000] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] p-0.5 cursor-pointer flex items-center focus:outline-none"
              title={`Toggle to Bus ${activeBus === 1 ? 2 : 1}`}
              aria-label={`Toggle between Bus 1 and Bus 2, currently Bus ${activeBus}`}
            >
              {/* Recessed slider channel */}
              <div className="absolute inset-x-2 h-[2px] bg-black/90 top-1/2 -translate-y-1/2 rounded-full" />

              {/* Teenage Engineering Orange Switch Cap with 45° Tactile Facet */}
              <div
                className={`w-6 h-5 bg-[#f15a22] rounded-[1px] border border-[#000000] shadow-[2px_2px_0px_#000000,inset_0_1px_0_rgba(255,255,255,0.4)] flex items-center justify-center gap-[2px] transition-transform duration-200 ease-out z-10 ${
                  activeBus === 1 ? 'translate-x-0' : 'translate-x-[26px]'
                }`}
              >
                {/* 3 tactile physical grip micro-ribs */}
                <span className="w-[1.5px] h-3 bg-black/30 rounded-full" />
                <span className="w-[1.5px] h-3 bg-black/30 rounded-full" />
                <span className="w-[1.5px] h-3 bg-black/30 rounded-full" />
              </div>
            </button>
          </div>

          {/* Right Station: BUS 2 */}
          <button
            type="button"
            onClick={() => setActiveBus(2)}
            className="flex items-center gap-2.5 flex-1 justify-end group cursor-pointer focus:outline-none"
            title="Switch to Bus 2 (Parallel signal path)"
          >
            {/* Symmetrical TE LCD-Style Tally Counter */}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-bold rounded-[1px] border border-[#141617] shadow-[1px_1px_0px_#141617] transition-all ${
                activeBus === 2
                  ? 'bg-[#d99b26] text-white'
                  : 'bg-[#e4e7e5] text-[#73787a]'
              }`}
            >
              <span>{String(bus2Items.length).padStart(2, '0')}</span>
              <span className="text-[8px] opacity-75 font-normal">FX</span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex flex-col items-end leading-tight">
                <span
                  className={`font-mono text-[11px] font-bold tracking-wider uppercase transition-colors ${
                    activeBus === 2 ? 'text-[#141617]' : 'text-[#8a9092] group-hover:text-[#141617]'
                  }`}
                >
                  BUS 2
                </span>
                <span className="font-mono text-[8px] text-[#73787a] tracking-tight uppercase">
                  PARALLEL
                </span>
              </div>
              {/* Status LED Indicator */}
              <span
                className={`w-2.5 h-2.5 rounded-full border border-black/40 transition-all ${
                  activeBus === 2
                    ? 'bg-[#d99b26] shadow-[0_0_8px_#d99b26]'
                    : 'bg-black/15'
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* 3. FOCUSED EFFECT CHAIN CANVAS (INTERNAL SCROLL & FULL HEIGHT) */}
      <div ref={canvasRef} className="flex-1 min-h-0 overflow-y-auto p-3 bg-[#ffffff] flex flex-col items-center relative">
        {currentBusItems.length === 0 ? (
          <div className="w-full h-full flex-1 flex flex-col items-center justify-center gap-3 border border-dashed border-[#d2d5d2] bg-[#fbfcfb] rounded-[2px] p-6 text-center">
            <GitBranch className={`w-8 h-8 ${activeBus === 1 ? 'text-[#00a69c]/40' : 'text-[#d99b26]/40'}`} />
            <div className="text-center">
              <span className="block font-mono text-[11px] font-bold text-[#141617]">
                NO EFFECTS IN BUS {activeBus}
              </span>
              <span className="block font-mono text-[9px] text-[#73787a] mt-0.5">
                {activeBus === 1
                  ? 'Bus 1 is the primary audio path. Triggered audio samples also play through this bus.'
                  : 'Bus 2 runs in parallel to Bus 1. Ideal for isolated dry vocal output or parallel saturation.'}
              </span>
            </div>
            <button
              data-add-effect-trigger="true"
              onClick={(e) => openAddMenu(e, undefined, 'empty')}
              className="px-4 py-1.5 text-[10px] font-mono font-bold text-white bg-[#141617] hover:bg-[#f15a22] rounded-[1px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ADD EFFECT</span>
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center max-w-3xl">
            {currentBusItems.map((item, bIdx) => (
              <React.Fragment key={item.fx.id}>
                {renderEffectCard(item, bIdx)}
                {/* Vertical Connector Line & Mid-Chain Insert Plus Button */}
                {bIdx < currentBusItems.length - 1 && (
                  <div className="flex flex-col items-center relative my-1.5">
                    <div
                      className={`w-[2px] h-7 ${
                        activeBus === 1 ? 'bg-[#00a69c]' : 'bg-[#d99b26]'
                      }`}
                    />
                    <button
                      data-add-effect-trigger="true"
                      onClick={(e) => openAddMenu(e, bIdx + 1, `mid-${bIdx + 1}`)}
                      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 flex items-center justify-center shadow-xs cursor-pointer text-[9px] font-bold transition-transform hover:scale-125 z-10 ${
                        activeBus === 1
                          ? 'border-[#00a69c] text-[#00a69c] hover:bg-[#00a69c] hover:text-white'
                          : 'border-[#d99b26] text-[#d99b26] hover:bg-[#d99b26] hover:text-white'
                      }`}
                      title={`Insert effect here in Bus ${activeBus}`}
                    >
                      +
                    </button>
                  </div>
                )}
              </React.Fragment>
            ))}

            {/* Single Add Effect Button at the bottom */}
            <div className="flex flex-col items-center mt-2 mb-3">
              <div
                className={`w-[2px] h-4 ${
                  activeBus === 1 ? 'bg-[#00a69c]' : 'bg-[#d99b26]'
                }`}
              />
              <button
                data-add-effect-trigger="true"
                onClick={(e) => openAddMenu(e, undefined, 'bottom')}
                className="px-4 py-1.5 text-[10px] font-mono font-bold rounded-[0px] border border-[#141617] bg-[#f8f9f8] hover:bg-[#141617] hover:text-white text-[#141617] flex items-center gap-1.5 cursor-pointer transition-colors shadow-[2px_2px_0px_#141617] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD EFFECT</span>
              </button>
            </div>
          </div>
        )}

        {/* SMART 1-CLICK EFFECT ADDITION POPOVER */}
        {addMenuTarget && (
          <div
            ref={popoverRef}
            style={{
              top: `${addMenuTarget.top}px`,
              left: `${addMenuTarget.left}px`
            }}
            className="absolute bg-white border border-[#141617] shadow-[4px_4px_0px_#141617] p-2.5 z-50 w-72 flex flex-col gap-1 rounded-[0px]"
          >
            <div className="flex items-center justify-between border-b border-[#e2e4e2] pb-1 mb-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#f15a22]">
                  ADD EFFECT (BUS {activeBus})
                </span>
                <span className="text-[8px] font-mono text-[#73787a]">
                  {typeof addMenuTarget.insertIndex === 'number'
                    ? `INSERT @ #${addMenuTarget.insertIndex + 1}`
                    : 'APPEND'}
                </span>
              </div>
              <button
                onClick={() => setAddMenuTarget(null)}
                className="text-xs text-[#73787a] hover:text-[#141617] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
              {Object.keys(EFFECTS_REGISTRY).map((key) => {
                const meta = EFFECTS_REGISTRY[key as EffectType];
                const existingBus = existingEffectsMap.get(key as EffectType);
                const isSingleAlreadyUsed = meta.singleInstance && existingBus !== undefined;
                const isSampleOnBus2 = activeBus === 2 && key === 'SAMPLE';

                if (isSampleOnBus2) {
                  return (
                    <div
                      key={key}
                      className="px-2 py-1 text-[9px] font-mono text-[#abb5ba] flex items-center justify-between cursor-not-allowed bg-black/5"
                      title="The SAMPLE primitive is restricted to Bus 1 in firmware"
                    >
                      <span>{meta.displayName}</span>
                      <span className="text-[7.5px] italic text-[#f15a22]">BUS 1 ONLY</span>
                    </div>
                  );
                }

                if (isSingleAlreadyUsed) {
                  return (
                    <div
                      key={key}
                      className="px-2 py-1 text-[9px] font-mono text-[#abb5ba] flex items-center justify-between cursor-not-allowed bg-black/5"
                      title="This effect can only be used once per preset across both buses"
                    >
                      <span>{meta.displayName}</span>
                      <span className="text-[7.5px] italic">
                        1x (IN BUS {existingBus})
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={key}
                    onClick={() => handleAddEffect(key as EffectType, addMenuTarget.insertIndex)}
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

      {/* 5. ADVANCED MODULATION: CHAPTER 7.9 LFO CYCLER */}
      <div className="shrink-0 border-t border-[#141617] bg-[#f8f9f8] p-3 border-x-0 flex flex-col gap-2">
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
                    ...(preset.lfo || { row: 0, param: 'cutoff', depth: 20, speed: 2.0, shape: 'sine' }),
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
                    ...(preset.lfo || { row: 0, param: 'cutoff', depth: 20, shape: 'sine', speed: 2.0 }),
                    speed: parseFloat(e.target.value) || 0.1
                  }
                })
              }
              className="w-12 bg-[#fff] border border-[#d2d5d2] px-1 py-0.5 text-[9px] font-mono text-center"
            />
            <span className="text-[8px] text-[#73787a]">Hz</span>
          </div>

          {/* Handle Modulates LFO Speed */}
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
