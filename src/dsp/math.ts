/**
 * Pure, side-effect-free DSP math used by the Web Audio engine.
 * Everything here is deterministic and unit-testable without an AudioContext.
 */
import { getModDepthConfig } from '../constants/effectsRegistry';

export type LfoShape = 'sine' | 'square' | 'sawtooth' | 'random' | string;

/** Map a normalized cutoff (0.0..1.0) to Hz on a log scale (20 Hz .. 20 kHz). */
export function cutoffToHz(normalized: number): number {
  const n = Math.max(0, Math.min(1, normalized));
  return 20 * Math.pow(1000, n);
}

/** Evaluate an LFO waveform in the range [-1, 1] at `time` seconds for `speed` Hz. */
export function computeLfoWave(shape: LfoShape, time: number, speed: number): number {
  const cycles = time * speed;
  const phase = cycles - Math.floor(cycles);
  if (shape === 'square') {
    return phase < 0.5 ? 1 : -1;
  }
  if (shape === 'sawtooth') {
    return 2 * (phase - Math.floor(phase + 0.5));
  }
  if (shape === 'random') {
    // Deterministic sample-and-hold step per cycle
    const stepIndex = Math.floor(cycles);
    const x = Math.sin(stepIndex * 12.9898 + 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }
  return Math.sin(phase * 2 * Math.PI);
}

/**
 * Convert a UI modulation depth into the delta unit the DSP engine applies.
 * - Normalized [0..1] params store depth as -100..+100 (%) in UI -> returns -1..+1.
 * - Native-unit params (Hz, st, x, s) are returned unchanged.
 *
 * Fixes the old `Math.abs(depth) > 1.5 ? depth / 100 : depth` heuristic, which applied
 * a 1% depth as 100%.
 */
export function resolveModDepth(effectType: string | undefined, param: string | undefined, uiDepth: number): number {
  if (typeof uiDepth !== 'number' || Number.isNaN(uiDepth)) return 0;
  const cfg = getModDepthConfig(effectType, param);
  return cfg.isNormalizedPercent ? uiDepth / 100 : uiDepth;
}

/** Waveshaper curve for DIST. Even amount = 0 has base saturation (k = 12). */
export function makeDistortionCurve(amount: number, nSamples = 44100): Float32Array {
  const k = 12 + Math.max(0, amount) * 4;
  const curve = new Float32Array(nSamples);
  const deg = Math.PI / 180;
  for (let i = 0; i < nSamples; ++i) {
    const x = (i * 2) / nSamples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/** tanh soft-clip curve used inside the DELAY feedback loop (tape saturation). */
export function makeSoftClipCurve(nSamples = 8192): Float32Array {
  const curve = new Float32Array(nSamples);
  for (let i = 0; i < nSamples; ++i) {
    const x = (i * 2) / nSamples - 1;
    curve[i] = Math.tanh(x * 1.4);
  }
  return curve;
}

/** Hann window value at grain phase p (0..1). */
export function hann(p: number): number {
  return 0.5 * (1.0 - Math.cos(2.0 * Math.PI * p));
}

/**
 * Constant-speed, phase-aligned dual-grain pitch shifter kernel.
 * Shifts pitch by `pitch` (0.25x..4.0x) while keeping playback duration at 1.0x.
 * Use `process(input, output)` per audio block; `setPitch()` changes the target ratio.
 */
export class PitchShiftKernel {
  private readonly bufferSize = 16384; // ~340ms @ 48kHz, power of 2
  private readonly mask = this.bufferSize - 1;
  private readonly ring = new Float32Array(this.bufferSize);
  private readonly grainSize: number;
  private writeIdx = 0;
  private phase = 0;
  private currentPitch: number;
  private targetPitch: number;
  private delayA: number;
  private delayB: number;

  constructor(initialPitch = 1.0, grainSize = 2048) {
    this.grainSize = grainSize;
    this.currentPitch = PitchShiftKernel.clampPitch(initialPitch);
    this.targetPitch = this.currentPitch;
    this.delayA = 8;
    this.delayB = grainSize * 0.5 + 8;
  }

  static clampPitch(p: number): number {
    return Math.max(0.25, Math.min(4.0, p || 1.0));
  }

  setPitch(p: number): void {
    this.targetPitch = PitchShiftKernel.clampPitch(p);
  }

  getPitch(): number {
    return this.currentPitch;
  }

  /** 4-point Hermite fractional read `delaySamples` behind the write head. */
  private read(delaySamples: number): number {
    const { ring, mask, bufferSize } = this;
    const readPos = this.writeIdx - delaySamples + bufferSize;
    const idx0 = Math.floor(readPos);
    const frac = readPos - idx0;
    const ym1 = ring[(idx0 - 1) & mask];
    const y0 = ring[idx0 & mask];
    const y1 = ring[(idx0 + 1) & mask];
    const y2 = ring[(idx0 + 2) & mask];
    const c1 = 0.5 * (y1 - ym1);
    const c2 = ym1 - 2.5 * y0 + 2.0 * y1 - 0.5 * y2;
    const c3 = 0.5 * (y2 - ym1) + 1.5 * (y0 - y1);
    return ((c3 * frac + c2) * frac + c1) * frac + y0;
  }

  /** Pick a start delay near `baseDelay` whose waveform best matches the active grain. */
  private findPhaseAlignedDelay(baseDelay: number, activeRefDelay: number): number {
    const { ring, mask, bufferSize } = this;
    const ref0 = this.read(activeRefDelay);
    const ref1 = this.read(activeRefDelay + 4);
    const ref2 = this.read(activeRefDelay + 8);
    let bestDelay = baseDelay;
    let bestErr = Infinity;
    for (let offset = 0; offset < 480; offset += 2) {
      const cand = baseDelay + offset;
      const d0 = ring[(this.writeIdx - Math.floor(cand) + bufferSize) & mask] - ref0;
      const d1 = ring[(this.writeIdx - Math.floor(cand + 4) + bufferSize) & mask] - ref1;
      const d2 = ring[(this.writeIdx - Math.floor(cand + 8) + bufferSize) & mask] - ref2;
      const err = d0 * d0 + d1 * d1 + d2 * d2;
      if (err < bestErr) {
        bestErr = err;
        bestDelay = cand;
      }
    }
    return bestDelay;
  }

  process(input: Float32Array, output: Float32Array): void {
    const len = input.length;
    const grain = this.grainSize;
    for (let i = 0; i < len; i++) {
      const x = input[i];
      this.ring[this.writeIdx] = x;

      this.currentPitch += (this.targetPitch - this.currentPitch) * 0.0025;

      const prevPhase = this.phase;
      this.phase += 1.0 / grain;
      const baseStart = this.currentPitch > 1.0 ? grain + 8 : 8;
      if (this.phase >= 1.0) {
        this.phase -= 1.0;
        this.delayA = this.findPhaseAlignedDelay(baseStart, this.delayB);
      }
      if (prevPhase < 0.5 && this.phase >= 0.5) {
        this.delayB = this.findPhaseAlignedDelay(baseStart, this.delayA);
      }

      const delta = 1.0 - this.currentPitch;
      this.delayA = Math.max(4, this.delayA + delta);
      this.delayB = Math.max(4, this.delayB + delta);

      const pA = this.phase;
      const pB = this.phase + 0.5 - Math.floor(this.phase + 0.5);
      const wet = hann(pA) * this.read(this.delayA) + hann(pB) * this.read(this.delayB);

      // Crossfade to dry pass-through when pitch is ~1.0x (bit-transparent at unity)
      const shiftDist = Math.min(1.0, Math.abs(this.currentPitch - 1.0) / 0.015);
      output[i] = x * (1.0 - shiftDist) + wet * shiftDist;

      this.writeIdx = (this.writeIdx + 1) & this.mask;
    }
  }
}
