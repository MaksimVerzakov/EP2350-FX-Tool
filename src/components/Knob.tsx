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
  size = 40,
  isModulated = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const dragStartY = useRef(0);
  const dragStartVal = useRef(value);

  // Sync internal input string when external value changes
  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  // Map value to rotation angle: -135deg to +135deg (total 270 degrees)
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
      const dy = dragStartY.current - e.clientY; // drag up = increase
      const range = max - min;
      const sensitivity = 160;
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
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommitInput();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setInputValue(value.toString());
      (e.target as HTMLInputElement).blur();
    }
  };

  // SVG Arc calculation for clean continuous gauge
  const radius = 16;
  const strokeWidth = 2.5;
  const circumference = 2 * Math.PI * radius;
  // 270 degrees out of 360 degrees = 0.75 arc
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength * (1 - normalized);

  return (
    <div
      className="flex flex-col items-center select-none group"
      style={{ minWidth: size + 16 }}
      title={`${label}: ${displayValue || value + unit} (Double-click to reset)`}
    >
      {/* Parameter Label (Swiss micro-grotesque) */}
      <div className="flex items-center gap-1 mb-1 max-w-[80px]">
        {isModulated && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#f15a22] animate-pulse" title="Modulated parameter" />
        )}
        <span className="text-[9px] font-bold tracking-wider text-[#6a6f73] uppercase text-center truncate">
          {label}
        </span>
      </div>

      {/* Rotary Dial */}
      <div
        className="relative cursor-ns-resize"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onDoubleClick={onReset}
      >
        <svg width={size} height={size} viewBox="0 0 40 40">
          {/* Background Track Arc */}
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="#d8dbd8"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(135 20 20)"
          />

          {/* Active Value Arc */}
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke={accentColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(135 20 20)"
          />

          {/* Dial Center */}
          <circle cx="20" cy="20" r="11" fill="#222324" stroke="#141617" strokeWidth="1" />

          {/* Minimalist Needle Indicator */}
          <g transform={`rotate(${angle} 20 20)`}>
            <line x1="20" y1="11" x2="20" y2="15" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      {/* Direct Numeric Input Box */}
      <div className="mt-1 flex items-center justify-center bg-[#ffffff] border border-[#d2d5d2] hover:border-[#141617] focus-within:border-[#f15a22] transition-colors px-1 py-0.5 max-w-[62px]">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleCommitInput}
          onKeyDown={handleKeyDown}
          className="w-full text-[10px] font-mono font-medium text-[#141617] text-center bg-transparent focus:outline-none"
        />
        {unit && (
          <span className="text-[8px] font-mono text-[#73787a] select-none pl-0.5">
            {unit}
          </span>
        )}
      </div>

      {/* Formatted display scale label (e.g. 500Hz, +2st) */}
      {displayValue && (
        <span className="text-[8px] font-mono text-[#73787a] mt-0.5 truncate max-w-[70px]">
          {displayValue}
        </span>
      )}
    </div>
  );
};
