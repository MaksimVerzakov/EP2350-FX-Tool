import React, { useRef, useState, useCallback, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  displayValue?: string;
  displayScale?: (val: number) => string;
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
  displayScale,
  onChange,
  onReset,
  accentColor = '#f15a22',
  size = 36,
  isModulated = false,
  modulationSource
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [inputText, setInputText] = useState(value.toString());
  const dragStartY = useRef(0);
  const dragStartVal = useRef(value);

  const formatVal = useCallback((val: number): string => {
    if (unit === '%') {
      return `${Math.round(val)}%`;
    }
    if (displayScale) {
      return displayScale(val);
    }
    if (displayValue !== undefined) {
      return displayValue;
    }
    return Number.isInteger(val) ? `${val}` : `${Number(val.toFixed(2))}`;
  }, [displayScale, displayValue, unit]);

  // Keep internal input text in sync with value when not focused / dragging
  useEffect(() => {
    if (!isDragging) {
      setInputText(formatVal(value));
    }
  }, [value, isDragging, formatVal]);

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
      const sensitivity = 130; // 130px for full travel
      const delta = (dy / sensitivity) * range;
      let newVal = dragStartVal.current + delta;
      newVal = Math.max(min, Math.min(max, newVal));

      if (step) {
        newVal = Math.round(newVal / step) * step;
      }
      const rounded = Math.round(newVal * 1000) / 1000;
      onChange(rounded);
      setInputText(formatVal(rounded));
    },
    [isDragging, max, min, onChange, step, formatVal]
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
    const rounded = Math.round(newVal * 1000) / 1000;
    onChange(rounded);
    setInputText(formatVal(rounded));
  };

  const commitValue = (textToCommit: string) => {
    const cleanLower = textToCommit.trim().toLowerCase();
    if (displayScale) {
      const stepVal = step || 1;
      for (let testVal = min; testVal <= max; testVal += stepVal) {
        if (displayScale(testVal).toLowerCase() === cleanLower) {
          onChange(testVal);
          setInputText(formatVal(testVal));
          return;
        }
      }
    }
    const cleanText = textToCommit.replace(/[^\d.-]/g, '');
    let parsed = parseFloat(cleanText);
    if (!isNaN(parsed)) {
      if (unit === '%' && parsed > 0 && parsed <= 1.0 && max >= 100) {
        parsed = parsed * 100;
      }
      const clamped = Math.max(min, Math.min(max, parsed));
      const rounded = step ? Math.round(clamped / step) * step : clamped;
      const finalVal = Math.round(rounded * 1000) / 1000;
      onChange(finalVal);
      setInputText(formatVal(finalVal));
    } else {
      setInputText(formatVal(value));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    const parsed = parseFloat(e.target.value.replace(/[^\d.-]/g, ''));
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      const rounded = step ? Math.round(clamped / step) * step : clamped;
      onChange(Math.round(rounded * 1000) / 1000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue(inputText);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setInputText(formatVal(value));
      (e.target as HTMLInputElement).blur();
    }
  };

  // Radius values
  const rOuter = size / 2;
  const rInner = rOuter * 0.72;
  const rCenter = rOuter * 0.28;

  // Dark accent detection for high-contrast pointer and dimple
  const isDarkAccent =
    accentColor === '#231f20' ||
    accentColor === '#000000' ||
    accentColor === '#141617' ||
    accentColor === '#181a1b';

  return (
    <div
      className="flex flex-col items-center select-none group w-[68px] min-w-[68px] px-0.5 py-0.5"
      title={`${label}: ${displayValue || value + unit} (Drag dial or type in box)`}
    >
      {/* Parameter Label + Mod Indicator */}
      <div className="flex items-center justify-between w-full mb-0.5 px-0.5">
        <span className="text-[8px] font-te-bold tracking-wider text-[#5b6670] uppercase truncate leading-none text-center w-full">
          {label}
        </span>
        {isModulated && (
          <span
            className={`text-[6.5px] font-te-bold px-0.5 py-[0.5px] text-white rounded-[1px] leading-none uppercase shrink-0 ${
              modulationSource === 'LFO'
                ? 'bg-[#00a69c]'
                : modulationSource === 'SHK'
                ? 'bg-[#141617]'
                : 'bg-[#f15a22]'
            }`}
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
            fill={isDarkAccent ? '#141617' : '#231f20'}
            stroke={isDarkAccent ? '#424548' : undefined}
            strokeWidth={isDarkAccent ? '0.5' : undefined}
          />

          {/* Precision Indicator Pointer Line: White on dark knobs, dark on light knobs */}
          <g transform={`rotate(${angle} ${rOuter} ${rOuter})`}>
            <line
              x1={rOuter}
              y1={rCenter}
              x2={rOuter}
              y2={rOuter - 1.5}
              stroke={isDarkAccent ? '#ffffff' : '#231f20'}
              strokeWidth={isDarkAccent ? '1.4' : '1.2'}
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      {/* Always-Visible Direct Numeric Input Field */}
      <div className="mt-1 w-full flex items-center justify-center">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onBlur={() => commitValue(inputText)}
          onKeyDown={handleKeyDown}
          onDoubleClick={onReset}
          className="w-[52px] h-[17px] text-[9px] font-mono font-bold text-[#192a3c] text-center bg-white border border-[#d2d5d2] hover:border-[#141617] focus:border-[#f15a22] rounded-[1px] outline-none px-0.5 py-0 leading-none transition-colors"
        />
      </div>
    </div>
  );
};
