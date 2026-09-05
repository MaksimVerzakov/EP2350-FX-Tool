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
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const dragStartY = useRef(0);
  const dragStartVal = useRef(handlePos);

  const cyclePreset = () => {
    setIsButtonPressed(true);
    onSelectSlot((activeSlot + 1) % 4);
    setTimeout(() => setIsButtonPressed(false), 150);
  };

  const triggerShakeWithFlash = () => {
    setIsShakingFlash(true);
    onShakeTrigger();
    setTimeout(() => setIsShakingFlash(false), 300);
  };

  // Handle Drag: Mouse or touch drag to squeeze the lever
  const handleHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSqueezing(true);
    dragStartY.current = e.clientY;
    dragStartVal.current = handlePos;
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isSqueezing) return;
      const dy = e.clientY - dragStartY.current;
      const sensitivity = 90;
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

  // Lever squeeze angle: hinges at (338.805, 240.78), rotates inward by up to 7.5 degrees
  const leverAngle = handlePos * 7.5;

  return (
    <div className="flex flex-col items-center select-none relative">
      {/* Container matching Teenage Engineering EP-2350 silhouette */}
      <div 
        className={`relative transition-transform duration-100 ${
          isShakingFlash ? 'scale-[1.02] -rotate-1' : ''
        }`}
        style={{ width: 240, height: 476 }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="280 0 295 585"
          className="w-full h-full drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          fill="none"
        >
          <defs>
            {/* LED Active Red Glow Filter */}
            <filter id="ledGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* LED Ambient Shadow */}
            <radialGradient id="ledShadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1a1c1e" />
              <stop offset="100%" stopColor="#2c3033" />
            </radialGradient>
          </defs>

          {/* 1. SQUEEZE HANDLE LEVER (Hinged at 338.805, 240.78) */}
          <g
            onMouseDown={handleHandleMouseDown}
            className="cursor-ns-resize"
            style={{
              transformOrigin: '338.805px 240.78px',
              transform: `rotate(${leverAngle}deg)`,
              transition: isSqueezing ? 'none' : 'transform 0.12s cubic-bezier(0.18, 0.89, 0.32, 1.28)'
            }}
          >
            {/* Squeeze lever body */}
            <path
              fill="#F15A22"
              d="M338.805 240.78a3.466 3.466 0 0 1-3.465-3.465v-26.173a25.2 25.2 0 0 0-1.164-7.567L292.02 69.755c-1.212-3.85.572-8.034 4.219-9.761 22.007-10.42 46.614-16.249 72.582-16.249"
            />
            <path
              stroke="#000"
              strokeWidth="1.2"
              strokeMiterlimit="10"
              d="M338.805 240.78a3.466 3.466 0 0 1-3.465-3.465v-26.173a25.2 25.2 0 0 0-1.164-7.567L292.02 69.755c-1.212-3.85.572-8.034 4.219-9.761 22.007-10.42 46.614-16.249 72.582-16.249"
            />
            {/* Grip detail lines */}
            <line x1="305" y1="90" x2="318" y2="90" stroke="#ba3807" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="311" y1="115" x2="324" y2="115" stroke="#ba3807" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="318" y1="140" x2="330" y2="140" stroke="#ba3807" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="324" y1="165" x2="334" y2="165" stroke="#ba3807" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* Top circle detail */}
          <path stroke="#000" strokeWidth="1.2" strokeMiterlimit="10" d="M353.679 70.65a9.494 9.494 0 1 0 0-18.99 9.494 9.494 0 0 0 0 18.99Z" />

          {/* 2. RECESSED HARDWARE PRESET BUTTON (Top Right Edge) */}
          <g
            onClick={cyclePreset}
            className="cursor-pointer group"
            style={{
              transform: isButtonPressed ? 'translateX(-2px)' : 'none',
              transition: 'transform 0.08s ease'
            }}
          >
            <path
              fill="#F15A22"
              stroke="#000"
              strokeWidth="1.2"
              strokeMiterlimit="10"
              d="M551.476 38.645h11.249a3.675 3.675 0 0 1 3.673 3.673v22.497a3.675 3.675 0 0 1-3.673 3.674h-11.249z"
              className="group-hover:brightness-110"
            />
            {/* Push button inner ridge */}
            <line x1="557" y1="45" x2="557" y2="60" stroke="#ba3807" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* White button */}
          <path
            fill="#E4E3DF"
            stroke="#000"
            strokeWidth="1.2"
            strokeMiterlimit="10"
            d="M551.476 114.518h11.249a3.674 3.674 0 0 1 3.673 3.673v22.497a3.675 3.675 0 0 1-3.673 3.673h-11.249z"
          />

          {/* Grey button */}
          <path
            fill="#D1D3D4"
            stroke="#000"
            strokeWidth="1.2"
            strokeMiterlimit="10"
            d="M551.476 243.728h11.249a3.675 3.675 0 0 1 3.673 3.673v22.497a3.676 3.676 0 0 1-3.673 3.674h-11.249v-29.845z"
          />

          {/* 3. MICROPHONE GRILLE (Acoustic Top Section) */}
          <path
            fill="#818E95"
            stroke="#000"
            strokeWidth="1.2"
            strokeMiterlimit="10"
            d="M551.475 182.826h-212.67V4.283A3.78 3.78 0 0 1 342.584.5h205.08a3.813 3.813 0 0 1 3.811 3.815z"
          />

          {/* Laser-cut Perforation Pattern Dots */}
          <path fill="#4D5158" stroke="#000" strokeWidth="0.5" strokeMiterlimit="10" d="M352.104 8.097a5.697 5.697 0 1 1-11.394-.002 5.697 5.697 0 0 1 11.394.002ZM367.294 8.097a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001ZM382.483 8.097a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001ZM397.673 8.097a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001ZM412.863 8.097a5.696 5.696 0 1 1-11.392 0 5.696 5.696 0 0 1 11.392 0ZM428.052 8.097a5.696 5.696 0 1 1-11.392 0 5.696 5.696 0 0 1 11.392 0ZM443.242 8.097a5.696 5.696 0 1 1-11.392 0 5.696 5.696 0 0 1 11.392 0ZM458.431 8.097a5.696 5.696 0 1 1-11.392 0 5.696 5.696 0 0 1 11.392 0ZM473.622 8.097a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001ZM488.811 8.097a5.697 5.697 0 1 1-11.394-.002 5.697 5.697 0 0 1 11.394.002ZM504.001 8.097a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001ZM549.571 8.097a5.697 5.697 0 1 1-11.394-.002 5.697 5.697 0 0 1 11.394.002ZM519.191 8.097a5.696 5.696 0 1 1-11.392 0 5.696 5.696 0 0 1 11.392 0ZM534.38 8.097a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001ZM519.191 175.184a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0ZM534.38 175.184a5.697 5.697 0 1 1-11.394-.002 5.697 5.697 0 0 1 11.394.002ZM352.104 23.286a5.697 5.697 0 1 1-11.394-.002 5.697 5.697 0 0 1 11.394.002Z" />
          
          <path fill="#231F20" d="M367.294 23.286a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M382.483 23.286a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M397.673 23.286a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M412.863 23.286a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M428.052 23.286a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M443.242 23.286a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M458.431 23.286a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M473.622 23.286a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M488.811 23.286a5.697 5.697 0 1 1-11.394-.002 5.697 5.697 0 0 1 11.394.002M504.001 23.286a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001" />

          <path fill="#4D5158" stroke="#000" strokeWidth="0.5" strokeMiterlimit="10" d="M549.571 23.286a5.697 5.697 0 1 1-11.394-.002 5.697 5.697 0 0 1 11.394.002ZM352.104 38.476a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001Z" />
          
          <path fill="#231F20" d="M367.294 38.476a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M382.483 38.476a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M397.673 38.476a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M412.863 38.476a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M428.052 38.476a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M443.242 38.476a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M458.431 38.476a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M473.622 38.476a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M488.811 38.476a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M504.001 38.476a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001" />

          <path fill="#4D5158" stroke="#000" strokeWidth="0.5" strokeMiterlimit="10" d="M549.571 53.665a5.697 5.697 0 1 1-11.394-.002 5.697 5.697 0 0 1 11.394.002ZM352.104 53.665a5.697 5.697 0 1 1-11.394-.002 5.697 5.697 0 0 1 11.394.002Z" />
          
          <path fill="#231F20" d="M367.294 53.665a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M382.483 53.665a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M397.673 53.665a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M412.863 53.665a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M428.052 53.665a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M443.242 53.665a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M458.431 53.665a5.696 5.696 0 1 1-11.393 0 5.696 5.696 0 0 1 11.393 0M473.622 53.665a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001M488.811 53.665a5.697 5.697 0 1 1-11.394-.002 5.697 5.697 0 0 1 11.394.002M504.001 53.665a5.697 5.697 0 1 1-11.394-.001 5.697 5.697 0 0 1 11.394.001" />

          {/* 4. FLUSH CAPSULE SLOTS (Vertical slot apertures on right of grille) */}
          <path
            fill="#989FA5"
            stroke="#000"
            strokeWidth="1.2"
            strokeMiterlimit="10"
            d="M521.08 159.389c-3.885 0-7.045-3.16-7.045-7.044v-45.552c0-3.838 3.095-6.843 7.044-6.843s7.045 3.006 7.045 6.843v45.552a7.05 7.05 0 0 1-7.044 7.044ZM521.09 83.503c-3.885 0-7.046-3.16-7.046-7.045V30.977c0-3.838 3.095-6.843 7.046-6.843s7.044 3.006 7.044 6.843v45.481c0 3.885-3.161 7.045-7.044 7.045Z"
          />

          {/* Lower Slot Indicator Dots */}
          <path fill="#4D5158" d="M521.08 156.142a3.798 3.798 0 1 0 0-7.596 3.798 3.798 0 0 0 0 7.596ZM521.08 140.935a3.797 3.797 0 1 0 .002-7.594 3.797 3.797 0 0 0-.002 7.594ZM521.08 125.763a3.798 3.798 0 1 0 0-7.596 3.798 3.798 0 0 0 0 7.596ZM521.08 110.59a3.798 3.798 0 1 0 0-7.596 3.798 3.798 0 0 0 0 7.596Z" />

          {/* UPPER SLOT: 4 INTERACTIVE PRESET LED APERTURES */}
          {[
            { slot: 0, cy: 34.725 },
            { slot: 1, cy: 49.898 },
            { slot: 2, cy: 65.071 },
            { slot: 3, cy: 80.244 }
          ].map(({ slot, cy }) => {
            const isActive = activeSlot === slot;
            return (
              <g
                key={slot}
                onClick={() => onSelectSlot(slot)}
                className="cursor-pointer group"
              >
                <title>{`Preset ${slot + 1}`}</title>
                {/* Hit area */}
                <circle cx={521.08} cy={cy} r={9} fill="transparent" />

                {/* Outer Bezel Rim */}
                <circle
                  cx={521.08}
                  cy={cy}
                  r={4.2}
                  fill="#181a1c"
                  stroke="#000"
                  strokeWidth="0.8"
                />

                {/* Core LED Lamp */}
                <circle
                  cx={521.08}
                  cy={cy}
                  r={3.2}
                  fill={isActive ? '#ff3b30' : '#33383c'}
                  filter={isActive ? 'url(#ledGlow)' : undefined}
                />

                {/* Specular highlight for active LED */}
                {isActive && (
                  <circle cx={520.2} cy={cy - 1} r={1.1} fill="#ffffff" opacity={0.9} />
                )}

                {/* Hover numeral indicator */}
                <text
                  x={506}
                  y={cy + 3}
                  fontSize="7"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={isActive ? '#f15a22' : '#818e95'}
                  className="opacity-60 group-hover:opacity-100 transition-opacity"
                  textAnchor="end"
                >
                  {slot + 1}
                </text>
              </g>
            );
          })}

          {/* 5. LOWER CHASSIS FACEPLATE (Off-white / Light Grey Plate) */}
          <g onClick={triggerShakeWithFlash} className="cursor-pointer group">
            <title>Click to trigger SHAKE SENSOR</title>
            <path
              fill={isShakingFlash ? '#d8ded8' : '#E4E3DF'}
              stroke="#000"
              strokeWidth="1.2"
              strokeMiterlimit="10"
              d="M338.805 182.804h212.67v147.938a3.814 3.814 0 0 1-3.812 3.813H342.617a3.814 3.814 0 0 1-3.812-3.813z"
              className="transition-colors duration-150"
            />

            {/* 4 Precision Corner Screws with 45° angled slot */}
            {[
              { cx: 353.992, cy: 197.79 },
              { cx: 536.269, cy: 197.79 },
              { cx: 353.992, cy: 319.31 },
              { cx: 536.269, cy: 319.31 }
            ].map((screw, i) => (
              <g key={i}>
                <circle
                  cx={screw.cx}
                  cy={screw.cy}
                  r={9.043}
                  fill="#d6d8d7"
                  stroke="#000"
                  strokeWidth="1.2"
                />
                {/* 45° screw slot */}
                <line
                  x1={screw.cx - 5.5}
                  y1={screw.cy - 5.5}
                  x2={screw.cx + 5.5}
                  y2={screw.cy + 5.5}
                  stroke="#141617"
                  strokeWidth="1.5"
                />
              </g>
            ))}

            {/* Authentic 'MIC' Typography (black) */}
            <path
              fill="#000"
              d="M391.474 240.119h-2.43v-23.662l-7.292 13.976h-2.316l-7.292-13.976v23.662h-2.43v-26.587h3.608l7.254 13.901 7.254-13.901h3.647v26.587zM395.382 213.534h2.43v26.586h-2.43zM421.738 231.915l-.265 1.178a8.744 8.744 0 0 1-8.583 7.026h-3.001c-4.824 0-8.773-3.949-8.773-8.773v-9.04c0-4.862 3.95-8.774 8.773-8.774h3.001a8.66 8.66 0 0 1 6.418 2.811 8.65 8.65 0 0 1 2.165 4.216l.265 1.177-2.392.456-.228-1.176a6.3 6.3 0 0 0-1.558-3.039 6.46 6.46 0 0 0-4.671-2.013h-3.001c-3.494 0-6.343 2.848-6.343 6.343v9.04c0 3.494 2.848 6.342 6.343 6.342h3.001c2.999 0 5.621-2.089 6.228-5.052l.227-1.177z"
            />

            {/* Authentic 'FX' Typography (orange #F15A22) */}
            <path
              fill="#F15A22"
              d="M428.052 226.92h1.342v-6.044l6.949.002v-1.343h-6.949v-4.699h8.157v-1.342h-9.499zM448.768 214.701v-1.207h-1.342v.74l-3.861 4.889-3.861-4.889v-.74h-1.342v1.207l4.347 5.506-4.332 5.487-.015.019v1.207h1.342v-.74l3.861-4.89 3.861 4.89v.74h1.342v-1.206l-4.348-5.507 4.333-5.488z"
            />

            {/* Subtle Subtitle */}
            <text
              x="445"
              y="262"
              textAnchor="middle"
              fill="#73787a"
              fontSize="6.5"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.1em"
            >
              TE-EP2350 COMPACT MIC
            </text>
          </g>

          {/* 6. CORRUGATED STRAIN RELIEF & CONNECTOR (Bottom) */}
          <path
            fill="#818E95"
            stroke="#000"
            strokeWidth="1.2"
            strokeMiterlimit="10"
            d="M414.743 380.066h-30.379v7.85h30.379zM414.743 364.866h-30.379v7.606h30.379zM414.743 334.555h-30.379v7.537h30.379zM414.743 349.686h-30.379v7.584h30.379z"
          />
          <path
            fill="#818E95"
            stroke="#000"
            strokeWidth="1.2"
            strokeMiterlimit="10"
            d="M405.237 342.093h-11.393v7.595h11.393zM405.237 357.271h-11.393v7.595h11.393zM405.237 372.466h-11.393v7.594h11.393zM414.403 395.521h-30.379v7.851h30.379zM405.237 387.92h-11.393v7.594h11.393z"
          />

          {/* 7. REINFORCED RUBBER CABLE SEGMENT (Hanging Down) */}
          <path
            fill="#D1D3D4"
            d="M420.295 510.223c5.516-.966 5.987-8.759.601-10.406-9.892-2.092-27.87-3.097-33.629-3.374-.836-.04-1.316-.944-.898-1.671 12.004-20.912 17.838-45.201 18.244-69.249-.006-.243.144-22.135.148-22.382h-10.874l.075 21.819v-.332c.304 17.825-3.899 36.651-10.996 52.973-2.72 7.395-8.888 14.338-9.232 22.35v.185c0 6.587 9.616 6.389 19.533 7.291 9.918.901 18.568 1.658 27.548 2.601"
          />
          <path
            stroke="#000"
            strokeWidth="1.2"
            strokeMiterlimit="10"
            d="M420.295 510.223c5.516-.966 5.987-8.759.601-10.406-9.892-2.092-27.87-3.097-33.629-3.374-.836-.04-1.316-.944-.898-1.671 12.004-20.912 17.838-45.201 18.244-69.249-.006-.243.144-22.135.148-22.382h-10.874l.075 21.819v-.332c.304 17.825-3.899 36.651-10.996 52.973-2.72 7.395-8.888 14.338-9.232 22.35v.185c0 6.587 9.616 6.389 19.533 7.291 9.918.901 18.568 1.658 27.548 2.601"
          />

          {/* Flexible Corrugated Bellows */}
          {[520.391, 530.805, 541.217, 551.674, 562.254, 572.666, 583.124].map((yVal, i) => (
            <path
              key={i}
              fill="#D1D3D4"
              stroke="#000"
              strokeWidth="1.2"
              strokeMiterlimit="10"
              d={`M418.334 ${yVal}c2.18.43 4.533-.372 5.644-2.296 1.606-2.781.325-6.601-3.742-7.781-13.586-2.743-26.006-2.124-39.785-4.675-3.86-.715-7.413 2.827-6.225 6.569.49 1.543 1.658 2.887 3.53 3.457 13.279 3.12 27.142 2.071 40.576 4.726z`}
            />
          ))}
        </svg>
      </div>
    </div>
  );
};
