import React, { useState, useRef, useEffect } from 'react';
import { audioEngine } from '../dsp/AudioEngine';
import { Play, Square, Upload, Activity } from 'lucide-react';

interface AudioPlayerCompactProps {
  onShakeTrigger: () => void;
}

export const AudioPlayerCompact: React.FC<AudioPlayerCompactProps> = ({ onShakeTrigger }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sampleType, setSampleType] = useState<'voice' | 'custom'>('voice');
  const [fileName, setFileName] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  // Real-Time Web Audio Oscilloscope Rendering Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = audioEngine.getAnalyser();

    const draw = () => {
      animId = requestAnimationFrame(draw);
      const width = canvas.width;
      const height = canvas.height;

      // Dark TE LCD surface
      ctx.fillStyle = '#141617';
      ctx.fillRect(0, 0, width, height);

      // Subtle Center Line
      ctx.strokeStyle = 'rgba(0, 166, 156, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (!isPlaying || !analyser) {
        // Idle line
        ctx.strokeStyle = 'rgba(0, 166, 156, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const timeData = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(timeData);

      // Draw luminescent cyan/teal waveform
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#00a69c';
      ctx.shadowColor = '#00a69c';
      ctx.shadowBlur = 4;
      ctx.beginPath();

      const sliceWidth = (width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying]);

  return (
    <div className="w-[240px] bg-[#ffffff] border border-[#141617] shadow-xs p-3 flex flex-col gap-2.5 select-none mt-2">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#e2e4e2] pb-1.5">
        <span className="text-[9px] font-bold text-[#141617] tracking-wider uppercase flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-[#00a69c]" />
          POST-FX AUDITION
        </span>
        <button
          onClick={onShakeTrigger}
          className="text-[8px] font-mono font-semibold bg-[#f0f2f0] hover:bg-[#e2e4e2] px-1.5 py-0.5 border border-[#d2d5d2] text-[#141617] tracking-tight transition-colors cursor-pointer"
          title="Trigger physical accelerometer shake impulse"
        >
          SHAKE SENSOR
        </button>
      </div>

      {/* Real-time Oscilloscope Display */}
      <div className="w-full h-[36px] bg-[#141617] border border-[#141617] overflow-hidden">
        <canvas ref={canvasRef} width={240} height={36} className="w-full h-full block" />
      </div>

      {/* Main Play / Stop Button */}
      <button
        onClick={togglePlayback}
        className={`te-btn w-full py-1.5 text-[10px] font-bold tracking-wider ${
          isPlaying ? 'te-btn-orange' : 'bg-[#222324] text-white'
        }`}
      >
        {isPlaying ? (
          <>
            <Square className="w-3 h-3 fill-current" /> STOP
          </>
        ) : (
          <>
            <Play className="w-3 h-3 fill-current" /> AUDITION
          </>
        )}
      </button>

      {/* Exactly Two Sound Options: Voice and Custom Upload */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleSelectVoice}
          className={`flex-1 py-1 text-[9px] font-mono font-semibold border transition-colors ${
            sampleType === 'voice'
              ? 'bg-[#141617] text-white border-[#141617]'
              : 'bg-[#f7f8f7] text-[#141617] border-[#d2d5d2] hover:bg-[#eef0ee]'
          }`}
        >
          VOICE
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 py-1 text-[9px] font-mono font-semibold border flex items-center justify-center gap-1 transition-colors ${
            sampleType === 'custom'
              ? 'bg-[#f15a22] text-white border-[#f15a22]'
              : 'bg-[#f7f8f7] text-[#141617] border-[#d2d5d2] hover:bg-[#eef0ee]'
          }`}
          title="Upload your own .WAV audio file"
        >
          <Upload className="w-2.5 h-2.5" /> UPLOAD
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
        <div className="text-[8px] font-mono text-[#73787a] truncate text-center">
          {fileName}
        </div>
      )}
    </div>
  );
};
