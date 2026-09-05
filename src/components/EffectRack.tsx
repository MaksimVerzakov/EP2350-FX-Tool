import React, { useState } from 'react';
import { AnyEffect, EffectType, PresetConfig } from '../types/config';
import { EffectCard } from './EffectCard';
import { EFFECTS_REGISTRY } from '../constants/effectsRegistry';
import { Plus, Mic, Volume2 } from 'lucide-react';

interface EffectRackProps {
  preset: PresetConfig;
  onUpdatePreset: (updated: PresetConfig) => void;
}

export const EffectRack: React.FC<EffectRackProps> = ({
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

    // Populate defaults
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

    // Adjust modulation target rows if needed
    const updatedPreset = { ...preset, list: newList };

    if (updatedPreset.handle && updatedPreset.handle.target !== 'lfo' && typeof updatedPreset.handle.row === 'number') {
      if (updatedPreset.handle.row === idx) {
        delete updatedPreset.handle;
      } else if (updatedPreset.handle.row > idx) {
        updatedPreset.handle = { ...updatedPreset.handle, row: updatedPreset.handle.row - 1 };
      }
    }

    if (updatedPreset.shake && typeof updatedPreset.shake.row === 'number') {
      if (updatedPreset.shake.row === idx) {
        delete updatedPreset.shake;
      } else if (updatedPreset.shake.row > idx) {
        updatedPreset.shake = { ...updatedPreset.shake, row: updatedPreset.shake.row - 1 };
      }
    }

    if (updatedPreset.lfo && updatedPreset.lfo.target !== 'lfo' && typeof updatedPreset.lfo.row === 'number') {
      if (updatedPreset.lfo.row === idx) {
        delete updatedPreset.lfo;
      } else if (updatedPreset.lfo.row > idx) {
        updatedPreset.lfo = { ...updatedPreset.lfo, row: updatedPreset.lfo.row - 1 };
      }
    }

    onUpdatePreset(updatedPreset);
  };

  const handleMove = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= preset.list.length) return;
    const newList = [...preset.list];
    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);

    // Update modulation row targets so they stick to the effect
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
    <div className="flex flex-col gap-3">
      {/* Signal Chain Start Marker */}
      <div className="flex items-center gap-2 px-3 py-1 bg-[#232424] text-white border border-[#18191a] text-[10px] font-mono font-bold tracking-wider">
        <Mic className="w-3.5 h-3.5 text-[#f15a22]" />
        <span>SIGNAL INPUT (MICROPHONE / AUDITION SAMPLE)</span>
        <div className="flex-1 border-t border-dashed border-[#555] ml-2" />
        <span className="text-[#818e95] text-[9px]">SERIAL SIGNAL FLOW &darr;</span>
      </div>

      {/* Empty State */}
      {preset.list.length === 0 && (
        <div className="p-8 text-center bg-[#dbdddb] border-2 border-dashed border-[#818e95] text-[#656d73] font-mono text-xs">
          NO EFFECTS IN THIS PRESET. ADD AN EFFECT BELOW TO BEGIN ROUTING.
        </div>
      )}

      {/* List of Effect Cards */}
      <div className="flex flex-col gap-2">
        {preset.list.map((effect, idx) => {
          const isHandleTarget =
            preset.handle?.target !== 'lfo' && preset.handle?.row === idx;
          const isShakeTarget = preset.shake?.row === idx;
          const isLfoTarget =
            preset.lfo?.target !== 'lfo' && preset.lfo?.row === idx;

          return (
            <React.Fragment key={effect.id}>
              <EffectCard
                effect={effect}
                rowIdx={idx}
                totalRows={preset.list.length}
                onUpdate={(up) => handleUpdateEffect(idx, up)}
                onDelete={() => handleDeleteEffect(idx)}
                onMoveUp={() => handleMove(idx, idx - 1)}
                onMoveDown={() => handleMove(idx, idx + 1)}
                isHandleTarget={isHandleTarget}
                isShakeTarget={isShakeTarget}
                isLfoTarget={isLfoTarget}
              />
              {idx < preset.list.length - 1 && (
                <div className="flex justify-center items-center h-2">
                  <div className="w-0.5 h-full bg-[#818e95]" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Signal Chain End Marker */}
      <div className="flex items-center gap-2 px-3 py-1 bg-[#232424] text-white border border-[#18191a] text-[10px] font-mono font-bold tracking-wider">
        <Volume2 className="w-3.5 h-3.5 text-[#00a69c]" />
        <span>MASTER OUTPUT BUS</span>
        <div className="flex-1 border-t border-dashed border-[#555] ml-2" />
        <span className="text-[#00a69c] text-[9px]">TO SPEAKERS / LINE OUT</span>
      </div>

      {/* Add Effect Control Bar */}
      <div className="te-chassis-panel p-3 border border-[#18191a] flex flex-wrap items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono font-bold text-[#18191a] uppercase">
            INSERT EFFECT:
          </span>
          <select
            value={selectedEffectToAdd}
            onChange={(e) => setSelectedEffectToAdd(e.target.value as EffectType)}
            className="bg-[#232424] text-white text-xs font-mono font-bold px-2 py-1.5 border border-[#18191a] focus:outline-none focus:ring-1 focus:ring-[#f15a22]"
          >
            {Object.keys(EFFECTS_REGISTRY).map((key) => {
              const meta = EFFECTS_REGISTRY[key as EffectType];
              const isSingleUsed = meta.singleInstance && existingTypes.has(key as EffectType);
              return (
                <option key={key} value={key} disabled={isSingleUsed}>
                  {meta.displayName} {isSingleUsed ? '(Already in chain)' : ''}
                </option>
              );
            })}
          </select>

          <button
            onClick={handleAddEffect}
            className="te-btn te-btn-orange text-xs py-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> ADD TO CHAIN
          </button>
        </div>

        <div className="text-[9px] font-mono text-[#656d73]">
          TOTAL CHAIN: <strong>{preset.list.length}</strong> EFFECTS
        </div>
      </div>
    </div>
  );
};
