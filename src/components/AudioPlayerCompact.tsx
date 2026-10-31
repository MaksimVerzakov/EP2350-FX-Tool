import React, { useState, useEffect } from 'react';
import { audioEngine } from '../dsp/AudioEngine';
import { Play, Square } from 'lucide-react';
import { ThemeMode } from '../types/config';

interface AudioPlayerCompactProps {
  onShakeTrigger?: () => void;
  theme?: ThemeMode;
  className?: string;
}

export const AudioPlayerCompact: React.FC<AudioPlayerCompactProps> = ({ theme = 'fx', className = '' }) => {
  const isTing = theme === 'ting';
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync state if audio stopped externally
  useEffect(() => {
    const interval = setInterval(() => {
      const running = audioEngine.getIsRunning();
      if (running !== isPlaying) {
        setIsPlaying(running);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlayback = () => {
    const running = audioEngine.togglePlay();
    setIsPlaying(running);
  };

  return (
    <div
      className={`w-[275px] h-[86px] te-hardware-chassis ${
        isTing ? 'bg-[#dbd0b9]' : 'bg-[#dbdddb]'
      } p-2.5 flex flex-col justify-between select-none relative z-10 ${className}`}
    >
      {/* Top status & screw header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5">
          {/* LED indicator */}
          <div
            className={`w-2 h-2 rounded-full border ${
              isTing ? 'border-[#00503a]' : 'border-black'
            } ${
              isPlaying
                ? 'bg-[#ff3b30] shadow-[0_0_5px_#ff3b30]'
                : isTing
                ? 'bg-[#003828]'
                : 'bg-[#2b3034]'
            }`}
          />
          <span
            className={`font-mono text-[9px] font-bold ${
              isTing ? 'text-[#00503a]' : 'text-[#141617]'
            } tracking-wider uppercase`}
          >
            AUDITION MODULE
          </span>
        </div>
        <span
          className={`font-mono text-[8px] ${
            isTing ? 'text-[#5b695e]' : 'text-[#73787a]'
          } tracking-tight`}
        >
          FREE SPEECH SAMPLE
        </span>
      </div>

      {/* Recessed Mechanical Socket Cavity */}
      <div
        className={`${
          isTing ? 'bg-[#003828] border-[#00503a]' : 'bg-[#141617] border-[#000000]'
        } p-1 border shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]`}
      >
        <button
          onClick={togglePlayback}
          className={`w-full h-9 text-[10.5px] font-mono font-bold tracking-wider transition-all duration-75 cursor-pointer flex items-center justify-center gap-2 border ${
            isTing ? 'border-[#00281c]' : 'border-[#000000]'
          } ${
            isPlaying
              ? 'bg-[#f15a22] text-white translate-x-[2px] translate-y-[2px] shadow-none'
              : `${
                  isTing
                    ? 'bg-[#00503a] hover:bg-[#00664a] shadow-[2px_2px_0px_#00281c]'
                    : 'bg-[#232424] hover:bg-[#353839] shadow-[2px_2px_0px_#000000]'
                } text-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`
          }`}
          title={isPlaying ? 'Stop speech playback' : 'Audition preset with speech sample'}
        >
          {isPlaying ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current text-white" />
              <span className="tracking-widest">STOP AUDITION</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current text-white" />
              <span className="tracking-widest">AUDITION (SPEECH)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

