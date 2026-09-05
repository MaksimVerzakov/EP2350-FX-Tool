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
  size = 52
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartVal = useRef(value);

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
      const sensitivity = 150; // pixels to traverse full range
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

  return (
    <div
      className="flex flex-col items-center select-none"
      style={{ minWidth: size + 16 }}
      onDoubleClick={onReset}
      title={`${label}: ${displayValue || value + unit} (Double click to reset)`}
    >
      <div className="text-[9px] font-bold tracking-wider text-[#656d73] uppercase mb-1 text-center truncate max-w-[80px]">
        {label}
      </div>

      <div
        className="relative cursor-ns-resize"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        {/* Outer Circular Track & Markings */}
        <svg width={size} height={size} viewBox="0 0 100 100">
          {/* Tick marks around bezel */}
          {Array.from({ length: 11 }).map((_, i) => {
            const tickAngle = -135 + i * (270 / 10);
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
                strokeWidth={i % 5 === 0 ? '3' : '1.5'}
                strokeLinecap="round"
                opacity={isLit ? 0.9 : 0.4}
              />
            );
          })}

          {/* Rotary Dial Center */}
          <circle cx="50" cy="50" r="32" fill="#2b2d2f" stroke="#121212" strokeWidth="2" />
          <circle cx="50" cy="50" r="28" fill="#3a3d40" />

          {/* Center cap accent ring */}
          <circle cx="50" cy="50" r="16" fill="#222426" stroke="#18191a" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="6" fill={accentColor} />

          {/* Indicator Dot / Needle */}
          <g transform={`rotate(${angle} 50 50)`}>
            <rect x="47.5" y="24" width="5" height="11" rx="2.5" fill="#f5f5f5" />
          </g>
        </svg>
      </div>

      {/* Numeric LCD style readout */}
      <div className="mt-1 px-1.5 py-0.5 bg-[#000005] border border-[#18191a] text-[#00a69c] text-[10px] font-mono font-semibold tracking-tight text-center min-w-[50px] shadow-inner te-lcd-glow truncate">
        {displayValue || `${value}${unit}`}
      </div>
    </div>
  );
};
