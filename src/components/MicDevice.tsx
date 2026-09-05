import React, { useState, useRef, useEffect, useCallback } from 'react';

interface MicDeviceProps {
  activeSlot: number; // 0, 1, 2, 3
  onSelectSlot: (slot: number) => void;
  handlePos: number; // 0.0 to 1.0
  onHandleChange: (pos: number) => void;
  onShakeTrigger: () => void;
}

export const MicDevice: React.FC<MicDeviceProps> = ({
  activeSlot,
  onSelectSlot,
  handlePos,
  onHandleChange,
  onShakeTrigger
}) => {
  const [isSqueezing, setIsSqueezing] = useState(false);
  const [isShakingFlash, setIsShakingFlash] = useState(false);
  const dragStartY = useRef(0);
  const dragStartVal = useRef(handlePos);

  const cyclePreset = () => {
    onSelectSlot((activeSlot + 1) % 4);
  };

  const triggerShakeWithFlash = () => {
    setIsShakingFlash(true);
    onShakeTrigger();
    setTimeout(() => setIsShakingFlash(false), 250);
  };

  // Handle Drag: Intuitive vertical drag (drag up/down) or squeeze
  const handleHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSqueezing(true);
    dragStartY.current = e.clientY;
    dragStartVal.current = handlePos;
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isSqueezing) return;
      // Moving down = squeezing handle lever in
      const dy = e.clientY - dragStartY.current;
      const sensitivity = 80;
      const delta = dy / sensitivity;
      const newVal = Math.max(0.0, Math.min(1.0, dragStartVal.current + delta));
      onHandleChange(Math.round(newVal * 100) / 100);
    },
    [isSqueezing, onHandleChange]
  );

  const handleMouseUp = useCallback(() => {
    if (!isSqueezing) return;
    setIsSqueezing(false);
    // Smooth spring-return to 0.0
    let current = handlePos;
    const startT = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - startT) / 140;
      if (elapsed < 1.0) {
        onHandleChange(current * (1.0 - elapsed));
        requestAnimationFrame(anim);
      } else {
        onHandleChange(0.0);
      }
    };
    requestAnimationFrame(anim);
  }, [isSqueezing, handlePos, onHandleChange]);

  useEffect(() => {
    if (isSqueezing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isSqueezing, handleMouseMove, handleMouseUp]);

  // Lever squeeze angle (0deg at rest, rotates inward by 8 degrees)
  const leverAngle = handlePos * 8;
  const leverTranslateX = handlePos * 7;

  return (
    <div className="flex flex-col items-center select-none relative">
      {/* Elongated Handheld Baton Silhouette (~200px × 430px) */}
      <div className="relative flex items-center" style={{ width: 250, height: 430 }}>
        
        {/* 1. SQUEEZE LEVER (Integrated Ergonomic Left Lever) */}
        <div
          onMouseDown={handleHandleMouseDown}
          className="absolute left-[3px] top-[115px] w-[34px] h-[210px] cursor-ns-resize active:cursor-grabbing z-20"
          style={{
            transformOrigin: 'bottom right',
            transform: `translateX(${leverTranslateX}px) rotate(${leverAngle}deg)`,
            transition: isSqueezing ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.9, 0.3, 1)'
          }}
          title="Squeeze Handle: Drag up/down to modulate, spring-loaded return"
        >
          <svg width="34" height="210" viewBox="0 0 34 210" fill="none">
            {/* Squeeze Lever profile */}
            <path
              d="M 32 205 C 14 185 4 140 5 45 C 5 20 18 8 32 4 L 32 205 Z"
              fill="#f15a22"
              stroke="#141617"
              strokeWidth="1.5"
            />
            {/* Grip ridges */}
            <line x1="12" y1="65" x2="28" y2="65" stroke="#ba3807" strokeWidth="1.5" />
            <line x1="10" y1="90" x2="28" y2="90" stroke="#ba3807" strokeWidth="1.5" />
            <line x1="9" y1="115" x2="28" y2="115" stroke="#ba3807" strokeWidth="1.5" />
            <line x1="10" y1="140" x2="28" y2="140" stroke="#ba3807" strokeWidth="1.5" />
            <line x1="14" y1="165" x2="28" y2="165" stroke="#ba3807" strokeWidth="1.5" />
          </svg>
        </div>

        {/* 2. RECESSED HARDWARE PRESET BUTTON (Top Right Edge) */}
        <button
          onClick={cyclePreset}
          className="absolute right-[20px] top-[125px] w-3 h-10 bg-[#f15a22] border border-[#141617] rounded-r-xs hover:brightness-110 active:translate-x-[-1px] transition-all z-20 shadow-xs flex items-center justify-center cursor-pointer"
          title="Orange Button: Cycle Preset (0, 1, 2, 3)"
        >
          <span className="w-0.5 h-6 bg-[#ba3807] rounded-full" />
        </button>

        {/* Flush White/Grey Sample Buttons (Right edge below orange button) */}
        <div className="absolute right-[22px] top-[185px] w-2.5 h-8 bg-[#ffffff] border border-[#141617] rounded-r-2xs z-10" />
        <div className="absolute right-[22px] top-[245px] w-2.5 h-10 bg-[#818e95] border border-[#141617] rounded-r-2xs z-10" />

        {/* 3. MAIN MIC CHASSIS (Precision Handheld Proportions 200px × 410px) */}
        <div className="w-[200px] h-[410px] bg-[#e2e4e2] border border-[#141617] shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex flex-col mx-auto relative overflow-hidden">
          
          {/* TOP SECTION: Laser Micro-Perforated Microphone Grille */}
          <div className="h-[235px] bg-[#3a3e42] border-b border-[#141617] relative flex flex-col justify-between overflow-hidden">
            
            {/* Acoustic Laser Perforation Pattern */}
            <div 
              className="absolute inset-0 opacity-85 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#181a1c 1.2px, transparent 1.2px), radial-gradient(#181a1c 1.2px, #3a3e42 1.2px)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 4px 4px'
              }}
            />

            {/* Flush-Drilled Aperture LEDs for Presets (Right Side of Grille) */}
            <div
              className="absolute right-3.5 top-5 bg-[#25282b]/95 border border-[#141617] rounded-full px-1.5 py-3 flex flex-col gap-3 z-30 shadow-inner"
              title="Preset Status LEDs (Click to switch)"
            >
              {[0, 1, 2, 3].map((slot) => {
                const isActive = activeSlot === slot;
                return (
                  <button
                    key={slot}
                    onClick={() => onSelectSlot(slot)}
                    className="group relative flex items-center justify-center cursor-pointer"
                    title={`Select Preset ${slot + 1} (${slot})`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full border border-[#141617] transition-all duration-100 ${
                        isActive ? 'te-led-active' : 'te-led-inactive'
                      }`}
                    />
                    {/* Laser-etched numeral label on hover */}
                    <span className="absolute right-4 text-[8px] font-mono text-[#ffffff] opacity-0 group-hover:opacity-100 pointer-events-none bg-black px-1">
                      {slot + 1}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sample Indicator Dots (Lower right) */}
            <div className="absolute right-3.5 bottom-4 bg-[#25282b]/80 border border-[#141617] rounded-full px-1.5 py-2 flex flex-col gap-2 z-20 opacity-60">
              {[0, 1, 2, 3].map((s) => (
                <div key={s} className="w-2 h-2 rounded-full bg-[#181a1c] border border-[#141617]" />
              ))}
            </div>

            {/* Subtle internal acoustic capsule shadow */}
            <div className="absolute left-6 top-10 w-24 h-24 rounded-full bg-black/20 blur-md pointer-events-none" />
          </div>

          {/* BOTTOM SECTION: Off-White Lower Faceplate (`MIC FX`) */}
          <div
            onClick={triggerShakeWithFlash}
            className={`h-[175px] bg-[#e2e4e2] p-4 flex flex-col justify-between relative cursor-pointer transition-colors ${
              isShakingFlash ? 'bg-[#ffeedd]' : 'hover:bg-[#ebedeb]'
            }`}
            title="Click faceplate to trigger physical accelerometer Shake sensor"
          >
            {/* 4 Precision Milled Corner Screws */}
            <div className="absolute top-2.5 left-2.5 w-2.5 h-2.5 rounded-full border border-[#141617] bg-[#d5d7d5] flex items-center justify-center">
              <span className="w-1.5 h-[1px] bg-[#141617] rotate-45" />
            </div>
            <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full border border-[#141617] bg-[#d5d7d5] flex items-center justify-center">
              <span className="w-1.5 h-[1px] bg-[#141617] rotate-45" />
            </div>
            <div className="absolute bottom-2.5 left-2.5 w-2.5 h-2.5 rounded-full border border-[#141617] bg-[#d5d7d5] flex items-center justify-center">
              <span className="w-1.5 h-[1px] bg-[#141617] rotate-45" />
            </div>
            <div className="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 rounded-full border border-[#141617] bg-[#d5d7d5] flex items-center justify-center">
              <span className="w-1.5 h-[1px] bg-[#141617] rotate-45" />
            </div>

            {/* Authentic TE Typography: MIC FX */}
            <div className="flex items-baseline gap-1 mt-3 ml-1">
              <span className="text-2xl font-bold tracking-tight text-[#141617] font-mono">
                MIC
              </span>
              <span className="text-xs font-bold tracking-wider text-[#f15a22] font-mono -mt-2">
                FX
              </span>
            </div>

            {/* Unit Specifications & Accelerometer Status */}
            <div className="flex flex-col gap-1 ml-1 mr-1 text-[9px] font-mono text-[#73787a] border-t border-[#d2d5d2] pt-2">
              <div className="flex justify-between items-center">
                <span>EP–2350</span>
                <span className="text-[#141617] font-semibold">SLOT {activeSlot + 1}</span>
              </div>
              <div className="flex justify-between items-center text-[8px]">
                <span>SENSOR:</span>
                <span className={isShakingFlash ? 'text-[#f15a22] font-bold animate-pulse' : 'text-[#73787a]'}>
                  {isShakingFlash ? 'SHAKE IMPULSE' : 'READY'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tapered Silicone Cable Relief at Bottom */}
      <div className="w-6 h-12 flex flex-col items-center -mt-6 z-0">
        <div className="w-5 h-2 bg-[#141617]" />
        <div className="w-4 h-2 bg-[#2a2d30] border-x border-[#141617]" />
        <div className="w-3.5 h-2 bg-[#2a2d30] border-x border-[#141617]" />
        <div className="w-3 h-2 bg-[#2a2d30] border-x border-[#141617]" />
        <div className="w-2.5 h-10 bg-[#141617]" />
      </div>

      {/* Minimalist Micro-Readout */}
      <div className="mt-1 flex items-center gap-2 text-[9px] font-mono text-[#73787a]">
        <span>LEVER: <strong className="text-[#141617]">{(handlePos * 100).toFixed(0)}%</strong></span>
        <span>•</span>
        <span>PRESET: <strong className="text-[#f15a22]">{activeSlot + 1} / 4</strong></span>
      </div>
    </div>
  );
};
