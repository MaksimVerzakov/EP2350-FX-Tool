import React, { useRef, useState, useCallback, useEffect } from 'react';

interface FaderHandleProps {
  value: number; // 0.0 to 1.0
  onChange: (val: number) => void;
  paramName?: string;
  depth?: number;
}

export const FaderHandle: React.FC<FaderHandleProps> = ({
  value,
  onChange,
  paramName = 'CUTOFF',
  depth = 0.8
}) => {
  const [springReturn, setSpringReturn] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const updateFromPointer = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      // Track top = 1.0 (fully pushed handle), bottom = 0.0 (rest position)
      const ratio = 1.0 - (clientY - rect.top) / rect.height;
      const clamped = Math.max(0.0, Math.min(1.0, ratio));
      onChange(Math.round(clamped * 100) / 100);
    },
    [onChange]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateFromPointer(e.clientY);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      updateFromPointer(e.clientY);
    },
    [isDragging, updateFromPointer]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (springReturn) {
      // Spring back to 0.0 with smooth animation
      let startVal = value;
      const startT = performance.now();
      const anim = () => {
        const elapsed = (performance.now() - startT) / 150;
        if (elapsed < 1.0) {
          onChange(startVal * (1.0 - elapsed));
          requestAnimationFrame(anim);
        } else {
          onChange(0.0);
        }
      };
      requestAnimationFrame(anim);
    }
  }, [isDragging, springReturn, value, onChange]);

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

  return (
    <div className="flex flex-col items-center bg-[#dbdddb] p-3 border border-[#18191a] shadow-sm select-none">
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-[10px] font-bold tracking-wider text-[#18191a] uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#f15a22]"></span>
          HANDLE LEVER
        </span>
        <button
          onClick={() => setSpringReturn(!springReturn)}
          className={`text-[9px] px-1.5 py-0.5 border border-[#18191a] font-mono font-bold uppercase ${
            springReturn ? 'bg-[#f15a22] text-black' : 'bg-[#232424] text-white'
          }`}
          title="Toggle spring-back vs latched handle"
        >
          {springReturn ? 'SPRING: ON' : 'LATCH'}
        </button>
      </div>

      {/* Fader Track & Paddle */}
      <div className="flex items-center gap-3">
        <div
          ref={trackRef}
          onMouseDown={handleMouseDown}
          className="relative w-12 h-36 bg-[#000005] border-2 border-[#18191a] cursor-pointer shadow-inner overflow-hidden flex justify-center"
        >
          {/* Internal level meter glow */}
          <div
            className="absolute bottom-0 w-full bg-[#f15a22] opacity-35 transition-all duration-75"
            style={{ height: `${value * 100}%` }}
          />

          {/* Center Guide Slot */}
          <div className="absolute top-2 bottom-2 w-1.5 bg-[#1a1b1d] border-x border-[#333]" />

          {/* Graticule Tick Marks */}
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-1 right-1 h-[1px] bg-[#33373b] pointer-events-none"
              style={{ top: `${(i / 8) * 100}%` }}
            />
          ))}

          {/* The Physical TE Squeeze Paddle */}
          <div
            className="absolute w-10 h-7 bg-[#232424] border-2 border-[#121212] shadow-md flex flex-col justify-center items-center cursor-grab active:cursor-grabbing transition-transform duration-75"
            style={{
              bottom: `calc(${value * 100}% - 14px)`,
              boxShadow: '0 3px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
            }}
          >
            {/* Paddle ridges */}
            <div className="w-6 h-[1.5px] bg-[#f15a22] mb-1" />
            <div className="w-6 h-[1px] bg-[#818e95] mb-0.5" />
            <div className="w-6 h-[1px] bg-[#818e95]" />
          </div>
        </div>

        {/* Readout stats */}
        <div className="flex flex-col justify-between h-36 py-1">
          <div className="text-[9px] font-mono text-[#656d73] uppercase leading-tight">
            100% PUSH
          </div>
          <div className="bg-[#000005] border border-[#18191a] p-1.5 text-center min-w-[55px]">
            <div className="text-[12px] font-mono font-bold text-[#f15a22] te-lcd-glow-orange leading-none">
              {(value * 100).toFixed(0)}%
            </div>
            <div className="text-[8px] font-mono text-[#818e95] mt-1 truncate">
              {depth >= 0 ? `+${(value * depth).toFixed(2)}` : (value * depth).toFixed(2)}
            </div>
          </div>
          <div className="text-[9px] font-mono text-[#656d73] uppercase leading-tight">
            0% REST
          </div>
        </div>
      </div>

      <div className="text-[9px] text-[#656d73] font-mono mt-2 text-center">
        MODULATES: <strong className="text-[#18191a]">{paramName}</strong> ({depth >= 0 ? `+${depth}` : depth})
      </div>
    </div>
  );
};
