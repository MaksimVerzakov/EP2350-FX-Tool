import { describe, expect, it } from 'vitest';
import {
  PitchShiftKernel,
  computeLfoWave,
  cutoffToHz,
  hann,
  makeDistortionCurve,
  makeSoftClipCurve,
  resolveModDepth
} from './math';

describe('cutoffToHz', () => {
  it('maps 0..1 to 20 Hz..20 kHz on a log scale and clamps', () => {
    expect(cutoffToHz(0)).toBe(20);
    expect(cutoffToHz(1)).toBeCloseTo(20000);
    expect(cutoffToHz(0.5)).toBeCloseTo(20 * Math.sqrt(1000));
    expect(cutoffToHz(-1)).toBe(20);
    expect(cutoffToHz(2)).toBeCloseTo(20000);
  });
});

describe('computeLfoWave', () => {
  it('sine starts at 0, peaks at a quarter cycle', () => {
    expect(computeLfoWave('sine', 0, 1)).toBeCloseTo(0);
    expect(computeLfoWave('sine', 0.25, 1)).toBeCloseTo(1);
    expect(computeLfoWave('sine', 0.75, 1)).toBeCloseTo(-1);
  });

  it('square is +1 for the first half cycle and -1 for the second', () => {
    expect(computeLfoWave('square', 0.1, 10)).toBe(1); // phase 0.0
    expect(computeLfoWave('square', 0.06, 10)).toBe(-1); // phase 0.6
  });

  it('sawtooth ramps across [-1, 1)', () => {
    expect(computeLfoWave('sawtooth', 0, 1)).toBeCloseTo(0);
    expect(computeLfoWave('sawtooth', 0.25, 1)).toBeCloseTo(0.5);
    expect(computeLfoWave('sawtooth', 0.75, 1)).toBeCloseTo(-0.5);
  });

  it('random is deterministic, bounded and holds within a cycle', () => {
    const a = computeLfoWave('random', 1.1, 1);
    expect(a).toBe(computeLfoWave('random', 1.9, 1));
    expect(a).not.toBe(computeLfoWave('random', 2.1, 1));
    for (let t = 0; t < 50; t += 0.37) {
      const v = computeLfoWave('random', t, 3);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThan(1);
    }
  });

  it('unknown shapes fall back to sine', () => {
    expect(computeLfoWave('triangle', 0.25, 1)).toBeCloseTo(1);
  });
});

describe('resolveModDepth', () => {
  it('converts normalized percent depths to ratios (1% stays 1%, not 100%)', () => {
    expect(resolveModDepth('LOWPASS', 'cutoff', 1)).toBeCloseTo(0.01);
    expect(resolveModDepth('LOWPASS', 'cutoff', 50)).toBe(0.5);
    expect(resolveModDepth('DIST', 'mix', -100)).toBe(-1);
  });

  it('keeps native-unit depths unchanged', () => {
    expect(resolveModDepth('SSB', 'frequency', 1000)).toBe(1000);
    expect(resolveModDepth('DELAY', 'time', 0.005)).toBe(0.005);
    expect(resolveModDepth('HARMONY', 'pitch', -0.5)).toBe(-0.5);
  });

  it('returns 0 for invalid depths', () => {
    expect(resolveModDepth('LOWPASS', 'cutoff', NaN)).toBe(0);
    expect(resolveModDepth('LOWPASS', 'cutoff', undefined as unknown as number)).toBe(0);
  });
});

describe('waveshaper curves', () => {
  it('distortion curve is odd-symmetric, monotonic and saturates even at amount 0', () => {
    for (const amount of [0, 10, 40]) {
      const c = makeDistortionCurve(amount, 1001);
      expect(c[500]).toBeCloseTo(0);
      expect(c[0]).toBeCloseTo(-c[1000]);
      for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]);
    }
    // amount 0 must not be linear: mid-level gain is higher than full-scale gain
    const c0 = makeDistortionCurve(0, 1001);
    expect(c0[750] / 0.5).toBeGreaterThan(c0[1000] / 1.0);
    // negative amount behaves like 0
    expect(makeDistortionCurve(-5, 101)).toEqual(makeDistortionCurve(0, 101));
  });

  it('soft clip curve is bounded by tanh(1.4)', () => {
    const c = makeSoftClipCurve(513);
    expect(Math.max(...c)).toBeLessThanOrEqual(Math.tanh(1.4) + 1e-6);
    expect(Math.min(...c)).toBeCloseTo(-Math.tanh(1.4));
  });
});

describe('hann', () => {
  it('two grains half a cycle apart sum to 1 (partition of unity)', () => {
    for (let p = 0; p < 1; p += 0.01) {
      expect(hann(p) + hann((p + 0.5) % 1)).toBeCloseTo(1, 12);
    }
  });
});

// ---------------------------------------------------------------------------
// Pitch shifter: verify pitch changes while duration (speed) stays at 1.0x
// ---------------------------------------------------------------------------
const SR = 48000;

function sine(freq: number, seconds = 1): Float32Array {
  const out = new Float32Array(SR * seconds);
  for (let i = 0; i < out.length; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / SR);
  return out;
}

function runKernel(input: Float32Array, pitch: number, block = 512): Float32Array {
  const kernel = new PitchShiftKernel(pitch);
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += block) {
    kernel.process(input.subarray(i, i + block), out.subarray(i, i + block));
  }
  return out;
}

function estimatePitchHz(signal: Float32Array): number {
  const windowLen = 1024;
  const minLag = Math.floor(SR / 800);
  const maxLag = Math.floor(SR / 60);
  const acc = new Float64Array(maxLag + 1);
  for (let f = Math.floor(SR * 0.2); f + windowLen + maxLag < signal.length; f += 512) {
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      for (let i = 0; i < windowLen; i++) s += signal[f + i] * signal[f + i + lag];
      acc[lag] += s;
    }
  }
  let bestLag = minLag;
  let inPeak = false;
  let maxVal = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (!inPeak && acc[lag] < 0 && acc[lag + 1] >= 0) inPeak = true;
    if (inPeak) {
      if (acc[lag] > maxVal) {
        maxVal = acc[lag];
        bestLag = lag;
      } else if (acc[lag] < 0) break;
    }
  }
  return SR / bestLag;
}

describe('PitchShiftKernel', () => {
  const input = sine(220);

  it('is bit-transparent at 1.0x', () => {
    const out = runKernel(input, 1.0);
    for (let i = 0; i < input.length; i++) expect(Math.abs(out[i] - input[i])).toBeLessThan(1e-6);
  });

  it.each([
    [2.0, 440],
    [0.5, 110],
    [1.5, 330]
  ])('shifts 220 Hz by %sx to ~%s Hz at constant duration', (pitch, expectedHz) => {
    const out = runKernel(input, pitch);
    expect(out.length).toBe(input.length);
    expect(Math.abs(estimatePitchHz(out) - expectedHz)).toBeLessThan(expectedHz * 0.03);
  });

  it('clamps pitch to 0.25..4.0 and smooths towards a new target', () => {
    expect(PitchShiftKernel.clampPitch(10)).toBe(4);
    expect(PitchShiftKernel.clampPitch(0.01)).toBe(0.25);
    expect(PitchShiftKernel.clampPitch(0)).toBe(1);

    const k = new PitchShiftKernel(1.0);
    k.setPitch(2.0);
    const buf = new Float32Array(4096);
    k.process(sine(220).subarray(0, 4096), buf);
    expect(k.getPitch()).toBeGreaterThan(1.9);
    expect(k.getPitch()).toBeLessThanOrEqual(2.0);
  });
});
