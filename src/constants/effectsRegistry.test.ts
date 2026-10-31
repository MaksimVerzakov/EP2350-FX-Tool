import { describe, expect, it } from 'vitest';
import { EFFECTS_REGISTRY, getModDepthConfig, isPercentParam } from './effectsRegistry';

describe('EFFECTS_REGISTRY', () => {
  it.each(['DELAY', 'DIST', 'EQUALISER', 'HARMONY', 'LOWPASS', 'HIGHPASS', 'SAMPLE', 'REVERB', 'RING', 'SSB', 'BALANCE'])(
    'defines %s with sane param ranges',
    (fx) => {
      const meta = EFFECTS_REGISTRY[fx as keyof typeof EFFECTS_REGISTRY];
      expect(meta).toBeDefined();
      for (const p of meta.params) {
        expect(p.min).toBeLessThan(p.max);
        expect(p.defaultVal).toBeGreaterThanOrEqual(p.min);
        expect(p.defaultVal).toBeLessThanOrEqual(p.max);
        expect(typeof p.displayScale!(p.defaultVal)).toBe('string');
      }
    }
  );

  it('limits DELAY.time to the 1.2s hardware maximum', () => {
    expect(EFFECTS_REGISTRY.DELAY.params.find((p) => p.name === 'time')!.max).toBe(1.2);
  });
});

describe('getModDepthConfig', () => {
  it.each([
    ['SSB', 'frequency', 'Hz'],
    ['RING', 'frequency', 'Hz'],
    ['DIST', 'amount', 'x'],
    ['SAMPLE', 'pitch', 'st'],
    ['SAMPLE', 'speed', 'x'],
    ['HARMONY', 'pitch', 'x'],
    ['DELAY', 'time', 's']
  ])('%s.%s uses native unit %s', (fx, param, unit) => {
    const cfg = getModDepthConfig(fx, param);
    expect(cfg.isNormalizedPercent).toBe(false);
    expect(cfg.unit).toBe(unit);
    expect(cfg.min).toBe(-cfg.max);
    expect(cfg.displayScale(cfg.defaultVal)).toMatch(/^\+/);
    expect(cfg.displayScale(-cfg.defaultVal)).toMatch(/^-/);
  });

  it.each([
    ['LOWPASS', 'cutoff'],
    ['DIST', 'mix'],
    ['DELAY', 'echo'],
    ['REVERB', 'time'],
    ['REVERB', 'spring-mix'],
    ['BALANCE', 'balance'],
    [undefined, undefined]
  ])('%s.%s is normalized -100..+100%%', (fx, param) => {
    const cfg = getModDepthConfig(fx, param);
    expect(cfg).toMatchObject({ isNormalizedPercent: true, min: -100, max: 100, unit: '%' });
    expect(cfg.displayScale(25)).toBe('+25%');
    expect(cfg.displayScale(-25)).toBe('-25%');
  });
});

describe('isPercentParam', () => {
  it('treats filter cutoff as 0..1, mix-style params as percent', () => {
    expect(isPercentParam('LOWPASS', 'cutoff')).toBe(false);
    expect(isPercentParam('HIGHPASS', 'cutoff')).toBe(false);
    expect(isPercentParam('DIST', 'mix')).toBe(true);
    expect(isPercentParam('DELAY', 'echo')).toBe(true);
    expect(isPercentParam('DIST', 'amount')).toBe(false);
  });
});
