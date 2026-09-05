import React, { useState, useRef } from 'react';
import { audioEngine } from '../dsp/AudioEngine';
import { Play, Square, Upload } from 'lucide-react';

interface AudioPlayerCompactProps {
  onShakeTrigger: () => void;
}

export const AudioPlayerCompact: React.FC<AudioPlayerCompactProps> = ({ onShakeTrigger }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sampleType, setSampleType] = useState<'voice' | 'custom'>('voice');
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const togglePlayback = () => {
    const running = audioEngine.togglePlay();
    setIsPlaying(running);
  };

  const handleSelectVoice = () => {
    setSampleType('voice');
    audioEngine.setSampleType('voice');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSampleType('custom');
    await audioEngine.loadCustomAudioFile(file);
    if (!isPlaying) {
      const running = audioEngine.togglePlay();
      setIsPlaying(running);
    }
  };

  return (
    <div className="w-[280px] bg-[#dbdddb] border-2 border-[#18191a] shadow-[6px_6px_0px_rgba(0,0,0,0.16)] p-3 flex flex-col gap-2.5 select-none mt-2">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#18191a] pb-1.5">
        <span className="text-[10px] font-bold font-mono text-[#18191a] tracking-wider uppercase flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#f15a22] shadow-[0_0_6px_#f15a22]' : 'bg-[#372424]'}`} />
          MIC AUDITION
        </span>
        <button
          onClick={onShakeTrigger}
          className="text-[8px] font-mono font-bold bg-[#f5f5f5] hover:bg-[#fff] px-1.5 py-0.5 border border-[#18191a] text-[#18191a]"
          title="Test physical shake transient"
        >
          👋 SHAKE
        </button>
      </div>

      {/* Main Play / Stop Button */}
      <button
        onClick={togglePlayback}
        className={`te-btn w-full py-2 text-xs font-bold font-mono tracking-wider ${
          isPlaying ? 'te-btn-orange' : 'bg-[#232424] text-white'
        }`}
      >
        {isPlaying ? (
          <>
            <Square className="w-3 h-3 fill-current" /> STOP AUDITION
          </>
        ) : (
          <>
            <Play className="w-3 h-3 fill-current" /> AUDITION EFFECT
          </>
        )}
      </button>

      {/* Two Audio Options: Voice and Custom Upload */}
      <div className="flex items-center gap-1.5 pt-1">
        <button
          onClick={handleSelectVoice}
          className={`flex-1 py-1 text-[9px] font-mono font-bold border border-[#18191a] transition-colors ${
            sampleType === 'voice'
              ? 'bg-[#232424] text-white shadow-sm'
              : 'bg-[#f5f5f5] text-[#18191a] hover:bg-[#fff]'
          }`}
        >
          VOICE SAMPLE
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 py-1 text-[9px] font-mono font-bold border border-[#18191a] flex items-center justify-center gap-1 transition-colors ${
            sampleType === 'custom'
              ? 'bg-[#f15a22] text-black shadow-sm'
              : 'bg-[#f5f5f5] text-[#18191a] hover:bg-[#fff]'
          }`}
          title="Upload your own .WAV audio file"
        >
          <Upload className="w-2.5 h-2.5" /> UPLOAD .WAV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,audio/wav"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {fileName && (
        <div className="text-[8px] font-mono text-[#656d73] truncate text-center">
          FILE: {fileName}
        </div>
      )}
    </div>
  );
};
