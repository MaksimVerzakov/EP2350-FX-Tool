import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseConfigJson } from './parser';
import { serializeToConfigJson, validatePackConfig } from './serializer';
import type { PackConfig } from '../types/config';

const ROOT = path.resolve(__dirname, '../..');
const OFFICIAL_PACKS = [
  'packs/ep-2350_preset_pack-broken_radio/config.json',
  'packs/ep-2350_preset_pack-dub/config.json',
  'packs/ep-2350_preset_pack-mysterious/config.json'
];

describe('official Teenage Engineering packs', () => {
  it.each(OFFICIAL_PACKS)('%s round-trips losslessly with 0 validation errors', (rel) => {
    const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const parsed = parseConfigJson(raw);
    expect(parsed.error).toBeUndefined();
    expect(parsed.pack!.presets).toHaveLength(4);

    const errors = validatePackConfig(parsed.pack!).filter((i) => i.type === 'error');
    expect(errors).toEqual([]);

    expect(JSON.parse(serializeToConfigJson(parsed.pack!))).toEqual(JSON.parse(raw));
  });
});

describe('parseConfigJson', () => {
  it('returns an error for malformed JSON', () => {
    expect(parseConfigJson('not-json').error).toMatch(/Failed to parse JSON/);
  });

  it('returns an error for a non-object root', () => {
    expect(parseConfigJson('null').error).toMatch(/root must be an object/);
    expect(parseConfigJson('42').error).toMatch(/root must be an object/);
  });

  it('fills missing hardware slots 0..3 and defaults name', () => {
    const { pack } = parseConfigJson(JSON.stringify({ presets: [{ pos: 2, list: [] }] }));
    expect(pack!.name).toBe('IMPORTED PACK');
    expect(pack!.presets.map((p) => p.pos)).toEqual([0, 1, 2, 3]);
    expect(pack!.presets[0].list).toEqual([expect.objectContaining({ effect: 'SAMPLE' })]);
  });

  it('uses built-in samples when samples array is absent and creates 4 default slots', () => {
    const { pack } = parseConfigJson(JSON.stringify({ name: 'X', presets: [] }));
    expect(pack!.useBuiltInSamples).toBe(true);
    expect(pack!.samples).toHaveLength(4);
  });

  it('parses custom samples and sanitises invalid playmodes', () => {
    const { pack } = parseConfigJson(
      JSON.stringify({
        name: 'S',
        samples: [{ pos: 0, file: 'a.wav', playmode: 'hold' }, { playmode: 'bogus' }],
        presets: []
      })
    );
    expect(pack!.useBuiltInSamples).toBe(false);
    expect(pack!.samples[0]).toMatchObject({ pos: 0, file: 'a.wav', playmode: 'hold' });
    expect(pack!.samples[1]).toMatchObject({ pos: 1, file: '2.wav', playmode: 'oneshot' });
  });

  it('upper-cases effect names and scales percent params to 0..100', () => {
    const { pack } = parseConfigJson(
      JSON.stringify({ presets: [{ pos: 0, list: [{ effect: 'dist', mix: 0.25, amount: 5 }] }] })
    );
    const fx = pack!.presets[0].list[0];
    expect(fx.effect).toBe('DIST');
    expect(fx.mix).toBe(25);
    expect(fx.amount).toBe(5);
  });

  it('keeps native-unit modulation depths and scales normalized ones (incl. tiny depths)', () => {
    const { pack } = parseConfigJson(
      JSON.stringify({
        presets: [
          {
            pos: 0,
            list: [{ effect: 'SSB', frequency: 0 }, { effect: 'DELAY', time: 0.3 }, { effect: 'LOWPASS', cutoff: 0.5 }],
            handle: { row: 0, param: 'frequency', depth: 1000 },
            shake: { row: 2, param: 'cutoff', depth: -0.005 },
            lfo: { row: 1, param: 'time', depth: 0.005, shape: 'triangle', speed: 0.2 }
          }
        ]
      })
    );
    const p = pack!.presets[0];
    expect(p.handle!.depth).toBe(1000); // Hz
    expect(p.shake!.depth).toBe(-0.5); // -0.5 %
    expect(p.lfo!.depth).toBe(0.005); // seconds
    expect(p.lfo!.shape).toBe('sine'); // unknown shape falls back
    expect(p.lfo).not.toHaveProperty('phase');
  });

  it('applies defaults for incomplete modulation objects', () => {
    const { pack } = parseConfigJson(
      JSON.stringify({
        presets: [
          {
            pos: 0,
            list: [{ effect: 'LOWPASS' }],
            handle: { target: 'lfo' },
            shake: {},
            lfo: {},
            trigger: {}
          }
        ]
      })
    );
    const p = pack!.presets[0];
    expect(p.handle).toMatchObject({ target: 'lfo', param: 'cutoff', depth: 10 });
    expect(p.shake).toMatchObject({ row: 0, param: 'mix', depth: 50 });
    expect(p.lfo).toMatchObject({ row: 0, param: 'cutoff', shape: 'sine', speed: 2 });
    expect(p.trigger).toEqual({ row: 0 });
  });
});

const basePack = (overrides: Partial<PackConfig> = {}): PackConfig => ({
  name: 'TEST',
  useBuiltInSamples: true,
  samples: [],
  presets: [],
  ...overrides
});

describe('serializeToConfigJson', () => {
  it('omits samples when using built-in samples and names untitled packs', () => {
    const out = JSON.parse(serializeToConfigJson(basePack({ name: '   ' })));
    expect(out).toEqual({ name: 'UNTITLED PACK', presets: [] });
  });

  it('serializes custom samples, BUS routing, comments and trigger', () => {
    const out = JSON.parse(
      serializeToConfigJson(
        basePack({
          useBuiltInSamples: false,
          samples: [{ id: 's', pos: 0, file: 'loop.wav', playmode: 'startstop' }],
          presets: [
            {
              id: 'p',
              pos: 0,
              name: ' DUB ',
              comment: ' note ',
              list: [
                { id: 'a', effect: 'DELAY', time: 0.5, echo: 45, BUS: 1 },
                { id: 'b', effect: 'REVERB', 'wet-level': 80, BUS: 2 },
                { id: 'c', effect: 'SAMPLE' }
              ],
              trigger: { row: 2 }
            }
          ]
        })
      )
    );
    expect(out.samples).toEqual([{ pos: 0, file: 'loop.wav', playmode: 'startstop' }]);
    const preset = out.presets[0];
    expect(preset).toMatchObject({ name: 'DUB', comment: 'note', trigger: { row: 2 } });
    expect(preset.list[0]).toEqual({ effect: 'DELAY', BUS: 1, time: 0.5, echo: 0.45 });
    expect(preset.list[1]).toEqual({ effect: 'REVERB', BUS: 2, 'wet-level': 0.8 });
    expect(preset.list[2]).toEqual({ effect: 'SAMPLE' });
  });

  it('serializes bipolar and native-unit modulation depths', () => {
    const out = JSON.parse(
      serializeToConfigJson(
        basePack({
          presets: [
            {
              id: 'p',
              pos: 0,
              name: '',
              comment: '',
              list: [
                { id: 'a', effect: 'LOWPASS', cutoff: 0.8 },
                { id: 'b', effect: 'RING', frequency: 400 }
              ],
              handle: { row: 1, param: 'frequency', depth: -2000 },
              shake: { row: 0, param: 'cutoff', depth: -40 },
              lfo: { row: 0, param: 'cutoff', depth: -50, shape: 'sine', speed: 1.555, phase: 0.25 }
            },
            {
              id: 'q',
              pos: 1,
              name: '',
              comment: '',
              list: [{ id: 'a', effect: 'LOWPASS' }],
              handle: { target: 'lfo', param: 'speed', depth: -8.5 },
              lfo: { target: 'lfo', param: 'speed', depth: 2, shape: 'square', speed: 4 }
            }
          ]
        })
      )
    );
    expect(out.presets[0].handle).toEqual({ row: 1, param: 'frequency', depth: -2000 });
    expect(out.presets[0].shake).toEqual({ row: 0, param: 'cutoff', depth: -0.4 });
    expect(out.presets[0].lfo).toEqual({ row: 0, param: 'cutoff', depth: -0.5, shape: 'sine', speed: 1.56, phase: 0.25 });
    expect(out.presets[1].handle).toEqual({ target: 'lfo', param: 'speed', depth: -8.5 });
    expect(out.presets[1].lfo).toMatchObject({ target: 'lfo', depth: 2 });
  });
});

describe('validatePackConfig', () => {
  it('flags empty name, missing presets', () => {
    const issues = validatePackConfig(basePack({ name: '' }));
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'warning', message: expect.stringMatching(/Pack name is empty/) }),
        expect.objectContaining({ type: 'error', message: expect.stringMatching(/At least one preset/) })
      ])
    );
  });

  it('flags duplicate single-instance effects, missing SAMPLE and out-of-range rows', () => {
    const issues = validatePackConfig(
      basePack({
        presets: [
          {
            id: 'p',
            pos: 0,
            name: 'BROKEN',
            comment: '',
            list: [
              { id: '1', effect: 'DELAY' },
              { id: '2', effect: 'DELAY' },
              { id: '3', effect: 'HARMONY' },
              { id: '4', effect: 'HARMONY' }
            ],
            handle: { row: 9, param: 'cutoff', depth: 50 },
            shake: { row: -1, param: 'mix', depth: 50 },
            lfo: { row: 8, param: 'cutoff', depth: 50, shape: 'sine', speed: 2 }
          }
        ]
      })
    );
    const messages = issues.map((i) => i.message).join('\n');
    expect(messages).toMatch(/'DELAY' can only be used once/);
    expect(messages).toMatch(/'HARMONY' can only be used once/);
    expect(messages).toMatch(/Missing/);
    expect(messages).toMatch(/Handle targets row 9/);
    expect(messages).toMatch(/Shake targets row -1/);
    expect(messages).toMatch(/LFO targets row 8/);
  });

  it('accepts a valid preset with lfo-targeted handle', () => {
    const issues = validatePackConfig(
      basePack({
        presets: [
          {
            id: 'p',
            pos: 0,
            name: 'OK',
            comment: '',
            list: [{ id: '1', effect: 'SAMPLE' }],
            handle: { target: 'lfo', param: 'speed', depth: 5 },
            lfo: { target: 'lfo', param: 'speed', depth: 1, shape: 'sine', speed: 2 }
          }
        ]
      })
    );
    expect(issues).toEqual([]);
  });
});
