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
  size = 46
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
      const sensitivity = 150;
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

  return (
    <div
      className="flex flex-col items-center select-none"
      style={{ minWidth: size + 16 }}
      title={`${label}: ${displayValue || value + unit} (Double click dial to reset)`}
    >
      <span className="text-[9px] font-bold tracking-tight text-[#656d73] uppercase mb-1 text-center truncate max-w-[76px]">
        {label}
      </span>

      {/* Rotary Dial */}
      <div
        className="relative cursor-ns-resize"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onDoubleClick={onReset}
      >
        <svg width={size} height={size} viewBox="0 0 100 100">
          {/* Tick marks around bezel */}
          {Array.from({ length: 9 }).map((_, i) => {
            const tickAngle = -135 + i * (270 / 8);
            const rad = (tickAngle * Math.PI) / 180;
            const x1 = 50 + 44 * Math.cos(rad);
            const y1 = 50 + 44 * Math.sin(rad);
            const x2 = 50 + 38 * Math.cos(rad);
            const y2 = 50 + 38 * Math.sin(rad);
            const isLit = tickAngle <= angle;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isLit ? accentColor : '#818e95'}
                strokeWidth={i % 4 === 0 ? '3' : '1.5'}
                strokeLinecap="round"
                opacity={isLit ? 0.9 : 0.35}
              />
            );
          })}

          {/* Dial Base */}
          <circle cx="50" cy="50" r="32" fill="#232424" stroke="#121212" strokeWidth="2" />
          <circle cx="50" cy="50" r="28" fill="#323535" />

          {/* Center Cap */}
          <circle cx="50" cy="50" r="16" fill="#222426" stroke="#18191a" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="5" fill={accentColor} />

          {/* Needle Indicator */}
          <g transform={`rotate(${angle} 50 50)`}>
            <rect x="47.5" y="24" width="5" height="11" rx="2.5" fill="#f5f5f5" />
          </g>
        </svg>
      </div>

      {/* Editable Numeric Input Box */}
      <div className="mt-1 flex items-center bg-[#ffffff] border border-[#18191a] shadow-inner px-1 py-0.5 max-w-[66px]">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleCommitInput}
          onKeyDown={handleKeyDown}
          className="w-full text-[10px] font-mono font-bold text-[#18191a] text-center bg-transparent focus:outline-none focus:bg-[#f15a22]/10"
        />
        {unit && (
          <span className="text-[8px] font-mono text-[#818e95] font-semibold select-none">
            {unit}
          </span>
        )}
      </div>

      {/* Scaled display readout if different from raw float */}
      {displayValue && (
        <span className="text-[8px] font-mono text-[#818e95] mt-0.5 truncate max-w-[70px]">
          {displayValue}
        </span>
      )}
    </div>
  );
};
