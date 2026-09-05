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
    <div className="w-[240px] h-[56px] bg-[#ffffff] border border-[#141617] shadow-xs p-2 flex items-center justify-center select-none">
      <button
        onClick={togglePlayback}
        className={`te-btn w-full h-full text-[11px] font-bold tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 ${
          isPlaying ? 'te-btn-orange' : 'bg-[#222324] text-white hover:bg-black'
        }`}
        title={isPlaying ? 'Stop speech playback' : 'Audition preset with speech sample'}
      >
        {isPlaying ? (
          <>
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>STOP</span>
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>PLAY</span>
          </>
        )}
      </button>
    </div>
  );
};
