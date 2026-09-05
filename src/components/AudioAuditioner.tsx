import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../dsp/AudioEngine';
import { Play, Square, Upload } from 'lucide-react';

interface AudioAuditionerProps {
  onShakeTrigger: () => void;
}

export const AudioAuditioner: React.FC<AudioAuditionerProps> = ({ onShakeTrigger }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sampleType, setSampleType] = useState<'beat' | 'voice' | 'synth' | 'custom'>('beat');
  const [fileName, setFileName] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const togglePlayback = async () => {
    const running = audioEngine.togglePlay();
    setIsPlaying(running);
  };

  const handleSelectSample = (type: 'beat' | 'voice' | 'synth') => {
    setSampleType(type);
    audioEngine.setSampleType(type);
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

  // Oscilloscope Animation Loop
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

      ctx.fillStyle = '#000005';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = 'rgba(0, 166, 156, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      for (let x = 0; x < width; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (!isPlaying || !analyser) {
        // Idle straight line
        ctx.strokeStyle = 'rgba(0, 166, 156, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const timeData = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(timeData);

      // Draw luminescent waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00a69c';
      ctx.shadowColor = '#00a69c';
      ctx.shadowBlur = 6;
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
    <div className="te-chassis-panel p-3 border border-[#18191a] shadow-md flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-[#18191a] pb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isPlaying ? 'bg-[#f15a22] shadow-[0_0_8px_#f15a22]' : 'bg-[#372424]'}`} />
          <span className="text-[11px] font-bold tracking-wider uppercase text-[#18191a]">
            LIVE AUDITION (NO MIC NEEDED)
          </span>
        </div>
        <div className="text-[10px] font-mono text-[#656d73]">
          DSP ENGINE: <strong className="text-[#00a69c]">ACTIVE</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Playback & Audition Controls */}
        <div className="md:col-span-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlayback}
              className={`te-btn flex-1 py-2 text-[11px] font-bold ${
                isPlaying ? 'te-btn-orange' : 'bg-[#232424] text-white'
              }`}
            >
              {isPlaying ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" /> STOP AUDITION
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> PLAY AUDITION
                </>
              )}
            </button>

            <button
              onClick={onShakeTrigger}
              className="te-btn te-btn-secondary px-3 py-2 text-[10px] font-bold"
              title="Trigger physical shake gesture (glitch/splash)"
            >
              👋 SHAKE
            </button>
          </div>

          {/* Sound source selector */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSelectSample('beat')}
              className={`text-[9px] px-2 py-1 font-mono font-bold border border-[#18191a] flex-1 ${
                sampleType === 'beat' ? 'bg-[#232424] text-white' : 'bg-[#dbdddb] text-[#18191a]'
              }`}
            >
              BEAT
            </button>
            <button
              onClick={() => handleSelectSample('voice')}
              className={`text-[9px] px-2 py-1 font-mono font-bold border border-[#18191a] flex-1 ${
                sampleType === 'voice' ? 'bg-[#232424] text-white' : 'bg-[#dbdddb] text-[#18191a]'
              }`}
            >
              VOICE
            </button>
            <button
              onClick={() => handleSelectSample('synth')}
              className={`text-[9px] px-2 py-1 font-mono font-bold border border-[#18191a] flex-1 ${
                sampleType === 'synth' ? 'bg-[#232424] text-white' : 'bg-[#dbdddb] text-[#18191a]'
              }`}
            >
              SYNTH
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`text-[9px] px-2 py-1 font-mono font-bold border border-[#18191a] flex-1 flex items-center justify-center gap-1 ${
                sampleType === 'custom' ? 'bg-[#f15a22] text-black' : 'bg-[#dbdddb] text-[#18191a]'
              }`}
              title="Upload your own .WAV sample"
            >
              <Upload className="w-2.5 h-2.5" /> WAV
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
            <div className="text-[9px] font-mono text-[#656d73] truncate">
              FILE: {fileName}
            </div>
          )}
        </div>

        {/* LCD Oscilloscope & Waveform Display */}
        <div className="md:col-span-8">
          <div className="te-lcd p-1 rounded-none border-2 border-[#18191a]">
            <canvas
              ref={canvasRef}
              width={460}
              height={70}
              className="w-full h-[68px] block"
            />
            <div className="flex justify-between items-center px-1.5 pt-1 text-[8px] font-mono text-[#818e95] border-t border-[#111]">
              <span>OSCILLOSCOPE // POST-FX MONITOR</span>
              <span className="text-[#00a69c] te-lcd-glow">44.1kHz STEREO</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
