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
  const [isShakingAnim, setIsShakingAnim] = useState(false);
  const dragStartY = useRef(0);
  const dragStartVal = useRef(handlePos);

  const cyclePreset = () => {
    onSelectSlot((activeSlot + 1) % 4);
  };

  const triggerShakeWithAnim = () => {
    setIsShakingAnim(true);
    onShakeTrigger();
    setTimeout(() => setIsShakingAnim(false), 350);
  };

  // Handle Drag / Squeeze
  const handleHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSqueezing(true);
    dragStartY.current = e.clientX;
    dragStartVal.current = handlePos;
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isSqueezing) return;
      // Moving right = squeezing handle in toward body
      const dx = e.clientX - dragStartY.current;
      const sensitivity = 60; // 60px to fully squeeze
      const delta = dx / sensitivity;
      const newVal = Math.max(0.0, Math.min(1.0, dragStartVal.current + delta));
      onHandleChange(Math.round(newVal * 100) / 100);
    },
    [isSqueezing, onHandleChange]
  );

  const handleMouseUp = useCallback(() => {
    if (!isSqueezing) return;
    setIsSqueezing(false);
    // Spring back to rest (0.0)
    let current = handlePos;
    const startT = performance.now();
    const anim = () => {
      const elapsed = (performance.now() - startT) / 120;
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

  // Visual deflection angle of orange handle (0deg to -14deg inward)
  const handleDeflection = handlePos * 14;

  return (
    <div className="flex flex-col items-center select-none relative">
      {/* Device Body Container */}
      <div
        className={`relative flex items-center transition-transform duration-100 ${
          isShakingAnim ? 'animate-bounce' : ''
        }`}
        style={{ width: 280, height: 360 }}
      >
        {/* 1. SQUEEZE LEVER (Orange Handle on Left) */}
        <div
          onMouseDown={handleHandleMouseDown}
          className="absolute left-[-24px] top-[90px] w-[58px] h-[170px] cursor-grab active:cursor-grabbing z-10"
          style={{
            transformOrigin: 'bottom right',
            transform: `rotate(${handleDeflection}deg)`,
            transition: isSqueezing ? 'none' : 'transform 0.12s ease-out'
          }}
          title="Squeeze Handle (Drag right to squeeze, spring-loaded return)"
        >
          <svg width="58" height="170" viewBox="0 0 58 170" fill="none">
            {/* Ergonomic curved handle lever */}
            <path
              d="M 50 165 C 20 150 6 110 8 30 C 9 12 25 5 44 2 L 54 2 L 54 165 Z"
              fill="#f15a22"
              stroke="#18191a"
              strokeWidth="2.5"
            />
            {/* Grip ridges */}
            <line x1="20" y1="45" x2="48" y2="45" stroke="#18191a" strokeWidth="2" />
            <line x1="17" y1="65" x2="48" y2="65" stroke="#18191a" strokeWidth="2" />
            <line x1="16" y1="85" x2="48" y2="85" stroke="#18191a" strokeWidth="2" />
            <line x1="18" y1="105" x2="48" y2="105" stroke="#18191a" strokeWidth="2" />
            <line x1="23" y1="125" x2="48" y2="125" stroke="#18191a" strokeWidth="2" />
          </svg>
        </div>

        {/* 2. PHYSICAL ORANGE PRESET BUTTON (Top Right Edge) */}
        <button
          onClick={cyclePreset}
          className="absolute right-[-10px] top-[100px] w-4 h-11 bg-[#f15a22] border-2 border-[#18191a] rounded-r-sm hover:brightness-110 active:translate-x-[-2px] transition-all z-20 shadow-sm flex items-center justify-center cursor-pointer"
          title="Orange Button: Cycle Preset (0, 1, 2, 3)"
        >
          <span className="w-1 h-6 bg-[#d14612] rounded-full" />
        </button>

        {/* White/Grey Sample Buttons (Right edge below orange button) */}
        <div className="absolute right-[-7px] top-[170px] w-3 h-10 bg-[#dbdddb] border-2 border-[#18191a] rounded-r-xs z-10" />
        <div className="absolute right-[-7px] top-[245px] w-3 h-12 bg-[#818e95] border-2 border-[#18191a] rounded-r-xs z-10" />

        {/* 3. MAIN CHASSIS HOUSING */}
        <div className="w-[240px] h-[330px] bg-[#d5d7d5] border-2 border-[#18191a] shadow-[8px_8px_0px_rgba(0,0,0,0.18)] flex flex-col mx-auto relative overflow-hidden">
          
          {/* TOP HALF: Perforated Microphone Grille */}
          <div className="h-[185px] bg-[#4d5158] border-b-2 border-[#18191a] p-3 relative flex flex-col justify-between">
            {/* Background perforation grid of circular dots */}
            <div className="absolute inset-0 p-2.5 grid grid-cols-11 gap-1.5 opacity-90 pointer-events-none">
              {Array.from({ length: 110 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-[#202224] border border-[#3b3e44]"
                />
              ))}
            </div>

            {/* Top right pill: 4 VERTICAL PRESET INDICATOR LEDS (Interactive!) */}
            <div
              className="absolute right-3.5 top-3.5 bg-[#2b2e32] border border-[#18191a] rounded-full px-1.5 py-2 flex flex-col gap-2.5 z-20 shadow-inner"
              title="Preset Indicator LEDs: Click any LED to switch preset"
            >
              {[0, 1, 2, 3].map((slot) => {
                const isActive = activeSlot === slot;
                return (
                  <button
                    key={slot}
                    onClick={() => onSelectSlot(slot)}
                    className="group relative flex items-center justify-center cursor-pointer"
                    title={`Slot ${slot + 1} (Preset ${slot})`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border border-[#18191a] transition-all ${
                        isActive
                          ? 'bg-[#e52817] shadow-[0_0_8px_#e52817,0_0_2px_#ffffff]'
                          : 'bg-[#181a1c] group-hover:bg-[#444]'
                      }`}
                    />
                    {/* Small slot number indicator on hover */}
                    <span className="absolute right-5 text-[8px] font-mono font-bold text-white bg-black px-1 opacity-0 group-hover:opacity-100 pointer-events-none">
                      P{slot}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Lower right pill: 4 Sample dots */}
            <div className="absolute right-3.5 bottom-3.5 bg-[#2b2e32] border border-[#18191a] rounded-full px-1.5 py-2 flex flex-col gap-2 z-20 opacity-70">
              {[0, 1, 2, 3].map((s) => (
                <div key={s} className="w-2.5 h-2.5 rounded-full bg-[#181a1c] border border-[#18191a]" />
              ))}
            </div>
          </div>

          {/* BOTTOM HALF: Lower Faceplate (`MIC FX`) */}
          <div
            onClick={triggerShakeWithAnim}
            className="h-[145px] bg-[#e4e3df] p-4 flex flex-col justify-between relative cursor-pointer hover:bg-[#eae9e6] transition-colors"
            title="Click microphone faceplate to trigger Shake gesture"
          >
            {/* 4 Faceplate Screws */}
            <div className="absolute top-2.5 left-2.5 w-3 h-3 rounded-full border border-[#18191a] bg-[#dbdddb] flex items-center justify-center">
              <span className="w-2 h-[1px] bg-[#18191a] rotate-45" />
            </div>
            <div className="absolute top-2.5 right-2.5 w-3 h-3 rounded-full border border-[#18191a] bg-[#dbdddb] flex items-center justify-center">
              <span className="w-2 h-[1px] bg-[#18191a] rotate-45" />
            </div>
            <div className="absolute bottom-2.5 left-2.5 w-3 h-3 rounded-full border border-[#18191a] bg-[#dbdddb] flex items-center justify-center">
              <span className="w-2 h-[1px] bg-[#18191a] rotate-45" />
            </div>
            <div className="absolute bottom-2.5 right-2.5 w-3 h-3 rounded-full border border-[#18191a] bg-[#dbdddb] flex items-center justify-center">
              <span className="w-2 h-[1px] bg-[#18191a] rotate-45" />
            </div>

            {/* The Printed TE Logo: MIC FX */}
            <div className="flex items-baseline gap-1 mt-4 ml-2">
              <span className="text-3xl font-mono font-bold tracking-tight text-[#18191a]">
                MIC
              </span>
              <span className="text-sm font-mono font-bold tracking-wider text-[#f15a22] -mt-3">
                FX
              </span>
            </div>

            {/* Status Footer */}
            <div className="flex items-center justify-between ml-2 mr-2 text-[8px] font-mono text-[#656d73]">
              <span>EP–2350</span>
              <span className="text-[#18191a] font-bold">PRESET {activeSlot} ACTIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cable Strain Relief at Bottom */}
      <div className="w-7 h-10 flex flex-col items-center -mt-6 z-0">
        <div className="w-6 h-2 bg-[#18191a]" />
        <div className="w-5 h-2 bg-[#2b2e32] border-x border-[#18191a]" />
        <div className="w-4 h-2 bg-[#2b2e32] border-x border-[#18191a]" />
        <div className="w-3 h-8 bg-[#121212]" />
      </div>

      {/* Interactive Helper Legend */}
      <div className="mt-2 text-center text-[9px] font-mono text-[#4e5559] flex items-center gap-2">
        <span className="bg-[#dbdddb] px-1.5 py-0.5 border border-[#18191a] font-bold">
          ORANGE LEVER: {Math.round(handlePos * 100)}%
        </span>
        <span className="bg-[#dbdddb] px-1.5 py-0.5 border border-[#18191a] font-bold">
          LED: PRESET {activeSlot}
        </span>
      </div>
    </div>
  );
};
