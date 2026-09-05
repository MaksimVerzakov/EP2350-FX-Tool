import React from 'react';
import { AnyEffect } from '../types/config';
import { EFFECTS_REGISTRY } from '../constants/effectsRegistry';
import { Knob } from './Knob';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

interface EffectCardProps {
  effect: AnyEffect;
  rowIdx: number;
  totalRows: number;
  onUpdate: (updated: AnyEffect) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isHandleTarget?: boolean;
  isShakeTarget?: boolean;
  isLfoTarget?: boolean;
}

export const EffectCard: React.FC<EffectCardProps> = ({
  effect,
  rowIdx,
  totalRows,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isHandleTarget = false,
  isShakeTarget = false,
  isLfoTarget = false
}) => {
  const meta = EFFECTS_REGISTRY[effect.effect] || EFFECTS_REGISTRY.LOWPASS;

  const handleParamChange = (paramName: string, val: number) => {
    onUpdate({
      ...effect,
      [paramName]: val
    });
  };

  const handleBusChange = (bus?: 1 | 2) => {
    const updated = { ...effect };
    if (!bus) {
      delete updated.BUS;
    } else {
      updated.BUS = bus;
    }
    onUpdate(updated);
  };

  const isSample = effect.effect === 'SAMPLE';

  return (
    <div
      className={`border-2 p-3 transition-all ${
        isSample
          ? 'bg-[#e4eae4] border-[#00a69c] shadow-sm'
          : 'bg-[#dbdddb] border-[#18191a] shadow-md'
      }`}
    >
      {/* Header bar of Effect Card */}
      <div className="flex items-center justify-between border-b border-[#18191a] pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="bg-[#18191a] text-[#fff] text-[9px] font-mono font-bold px-1.5 py-0.5 tracking-wider">
            ROW {rowIdx}
          </span>
          <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-[#18191a] flex items-center gap-2">
            {meta.displayName}
            {meta.singleInstance && (
              <span className="text-[8px] font-normal text-[#818e95] tracking-tight">
                *1x/CHAIN
              </span>
            )}
          </h3>

          {/* Active modulation badges */}
          <div className="flex items-center gap-1">
            {isHandleTarget && (
              <span className="bg-[#f15a22] text-black text-[8px] font-mono font-bold px-1 py-0.2 rounded-none">
                HANDLE
              </span>
            )}
            {isShakeTarget && (
              <span className="bg-[#232424] text-white text-[8px] font-mono font-bold px-1 py-0.2 rounded-none">
                SHAKE
              </span>
            )}
            {isLfoTarget && (
              <span className="bg-[#00a69c] text-black text-[8px] font-mono font-bold px-1 py-0.2 rounded-none">
                LFO
              </span>
            )}
          </div>
        </div>

        {/* Action Controls: Bus toggle, Reorder, Delete */}
        <div className="flex items-center gap-2">
          {/* BUS Routing selector */}
          <div className="flex items-center border border-[#18191a] bg-[#232424] text-white">
            <button
              onClick={() => handleBusChange(undefined)}
              className={`text-[8px] font-mono font-bold px-1.5 py-0.5 ${
                !effect.BUS ? 'bg-[#00a69c] text-black' : 'text-[#818e95]'
              }`}
              title="Serial signal routing"
            >
              SERIAL
            </button>
            <button
              onClick={() => handleBusChange(1)}
              className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border-l border-[#18191a] ${
                effect.BUS === 1 ? 'bg-[#f15a22] text-black' : 'text-[#818e95]'
              }`}
              title="Route into BUS 1"
            >
              BUS 1
            </button>
            <button
              onClick={() => handleBusChange(2)}
              className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border-l border-[#18191a] ${
                effect.BUS === 2 ? 'bg-[#f15a22] text-black' : 'text-[#818e95]'
              }`}
              title="Route into BUS 2"
            >
              BUS 2
            </button>
          </div>

          {/* Reorder Buttons */}
          <div className="flex items-center border border-[#18191a] bg-[#fff]">
            <button
              disabled={rowIdx === 0}
              onClick={onMoveUp}
              className="p-1 hover:bg-[#eceeec] disabled:opacity-30 disabled:pointer-events-none"
              title="Move earlier in chain"
            >
              <ArrowUp className="w-3 h-3 text-[#18191a]" />
            </button>
            <button
              disabled={rowIdx === totalRows - 1}
              onClick={onMoveDown}
              className="p-1 hover:bg-[#eceeec] disabled:opacity-30 disabled:pointer-events-none border-l border-[#18191a]"
              title="Move later in chain"
            >
              <ArrowDown className="w-3 h-3 text-[#18191a]" />
            </button>
          </div>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="p-1 text-[#656d73] hover:text-[#e05526] hover:bg-[#232424] border border-transparent hover:border-[#18191a] transition-colors"
            title="Remove effect from preset"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Description or Signal notice */}
      <div className="text-[9px] font-mono text-[#656d73] mb-3 flex items-center justify-between">
        <span>{meta.description}</span>
        {isSample && (
          <span className="text-[#00a69c] font-bold">
            {rowIdx === 0
              ? 'AUDIO INJECTED BEFORE ALL EFFECTS'
              : rowIdx === totalRows - 1
              ? 'AUDIO INJECTED CLEAN (POST-EFFECTS)'
              : `AUDIO AFFECTS ONLY ROWS ${rowIdx + 1} TO ${totalRows - 1}`}
          </span>
        )}
      </div>

      {/* Knobs strip */}
      <div className="flex flex-wrap items-center gap-3 justify-start py-1">
        {meta.params.map((param) => {
          const currentVal =
            typeof effect[param.name] === 'number'
              ? effect[param.name]
              : param.defaultVal;

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
              onChange={(v) => handleParamChange(param.name, v)}
              onReset={() => handleParamChange(param.name, param.defaultVal)}
              accentColor={isSample ? '#00a69c' : '#f15a22'}
            />
          );
        })}
      </div>
    </div>
  );
};
