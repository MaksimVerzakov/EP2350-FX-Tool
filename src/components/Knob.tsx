import React, { useRef, useState, useCallback, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  displayValue?: string;
  onChange: (val: number) => void;
  onReset?: () => void;
  accentColor?: string;
  size?: number;
  isModulated?: boolean;
  modulationSource?: string;
}

export const Knob: React.FC<KnobProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit = '',
  displayValue,
  onChange,
  onReset,
  accentColor = '#f15a22',
  size = 28,
  isModulated = false,
  modulationSource
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const dragStartY = useRef(0);
  const dragStartVal = useRef(value);

  // Keep internal string in sync when not editing
  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toString());
    }
  }, [value, isEditing]);

  // Map value to angle: -135deg to +135deg (270deg total travel)
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const angle = -135 + normalized * 270;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartVal.current = value;
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const dy = dragStartY.current - e.clientY; // up = increase
      const range = max - min;
      const sensitivity = 140; // 140px for full travel
      const delta = (dy / sensitivity) * range;
      let newVal = dragStartVal.current + delta;
      newVal = Math.max(min, Math.min(max, newVal));

      if (step) {
        newVal = Math.round(newVal / step) * step;
      }
      onChange(Math.round(newVal * 1000) / 1000);
    },
    [isDragging, max, min, onChange, step]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * (step || (max - min) / 100);
    let newVal = Math.max(min, Math.min(max, value + delta));
    if (step) newVal = Math.round(newVal / step) * step;
    onChange(Math.round(newVal * 1000) / 1000);
  };

  const handleCommitInput = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      const rounded = step ? Math.round(clamped / step) * step : clamped;
      onChange(Math.round(rounded * 1000) / 1000);
      setInputValue(rounded.toString());
    } else {
      setInputValue(value.toString());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommitInput();
    } else if (e.key === 'Escape') {
      setInputValue(value.toString());
      setIsEditing(false);
    }
  };

  // Format compact value display
  const renderValueText = () => {
    if (displayValue) return displayValue;
    if (Number.isInteger(value)) return `${value}${unit}`;
    return `${value.toFixed(2)}${unit}`;
  };

  // Radius values
  const rOuter = size / 2;
  const rInner = rOuter * 0.72;
  const rCenter = rOuter * 0.28;

  return (
    <div
      className="flex flex-col items-center select-none group min-w-[56px] px-1 py-0.5"
      title={`${label}: ${displayValue || value + unit} (Drag dial or click value to type)`}
    >
      {/* Parameter Label + Mod Indicator */}
      <div className="flex items-center gap-1 mb-1 max-w-[70px]">
        <span className="text-[8.5px] font-te-bold tracking-wider text-[#5b6670] uppercase truncate leading-none">
          {label}
        </span>
        {isModulated && (
          <span
            className="text-[7px] font-te-bold px-0.5 py-[0.5px] bg-[#f15a22] text-white rounded-[1px] leading-none uppercase"
            title={`Modulated by ${modulationSource || 'source'}`}
          >
            {modulationSource ? modulationSource.slice(0, 3) : 'MOD'}
          </span>
        )}
      </div>

      {/* TE Orthographic Encoder Cap */}
      <div
        className="relative cursor-ns-resize"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onDoubleClick={onReset}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transition-transform duration-75 active:scale-95"
        >
          {/* Subtle Outer Drop Ring */}
          <circle
            cx={rOuter}
            cy={rOuter}
            r={rOuter - 0.5}
            fill="#e2e4e2"
            stroke="#231f20"
            strokeWidth="0.8"
          />

          {/* Color-Coded Bevel Ring */}
          <circle
            cx={rOuter}
            cy={rOuter}
            r={rInner}
            fill={accentColor}
            stroke="#231f20"
            strokeWidth="0.75"
          />

          {/* Center Cap Dimple */}
          <circle
            cx={rOuter}
            cy={rOuter}
            r={rCenter}
            fill="#231f20"
          />

          {/* Precision Indicator Pointer Line */}
          <g transform={`rotate(${angle} ${rOuter} ${rOuter})`}>
            <line
              x1={rOuter}
              y1={rCenter}
              x2={rOuter}
              y2={rOuter - 1.5}
              stroke="#231f20"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      {/* Direct Numeric Input / Click-to-Type Scrubber */}
      <div className="mt-1 h-4 flex items-center justify-center">
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleCommitInput}
            onKeyDown={handleKeyDown}
            className="w-12 text-[9.5px] font-mono font-bold text-[#192a3c] text-center bg-white border border-[#f15a22] rounded-[1px] outline-none px-0.5 py-0 leading-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-[9.5px] font-mono font-medium text-[#192a3c] hover:text-[#f15a22] hover:bg-[#eaeaea] px-1 py-[1px] rounded-[1px] transition-colors leading-none cursor-text truncate max-w-[62px]"
          >
            {renderValueText()}
          </button>
        )}
      </div>
    </div>
  );
};

