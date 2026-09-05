import React, { useState, useEffect } from 'react';
import { audioEngine } from '../dsp/AudioEngine';
import { Play, Square } from 'lucide-react';

interface AudioPlayerCompactProps {
  onShakeTrigger?: () => void;
}

export const AudioPlayerCompact: React.FC<AudioPlayerCompactProps> = () => {
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
    <div className="w-[275px] h-[64px] te-hardware-chassis bg-[#ffffff] p-2 flex items-center justify-center select-none">
      <button
        onClick={togglePlayback}
        className={`w-full h-full text-[11px] font-mono font-bold tracking-wider rounded-[2px] transition-all duration-75 cursor-pointer flex items-center justify-center gap-2 border border-[#141617] ${
          isPlaying
            ? 'bg-[#f15a22] text-white shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] active:translate-y-[1px] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]'
            : 'bg-[#202223] text-white hover:bg-[#2c2e30] shadow-[0_2px_3px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-[1px] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.7)]'
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
  );
};
