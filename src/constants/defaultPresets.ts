import { PackConfig, PresetConfig } from '../types/config';

export const DEFAULT_PRESETS: PresetConfig[] = [
  {
    id: 'preset-0',
    pos: 0,
    name: 'BAD RECEPTION',
    comment: 'static noise that clears up when handle is pushed',
    list: [
      { id: 'fx-0-1', effect: 'DIST', amount: 10.0, mix: 0.5 },
      { id: 'fx-0-2', effect: 'LOWPASS', cutoff: 0.2 },
      { id: 'fx-0-3', effect: 'SAMPLE' }
    ],
    handle: { row: 1, param: 'cutoff', depth: 0.8 },
    shake: { row: 0, param: 'mix', depth: 0.5 },
    trigger: { row: 2 }
  },
  {
    id: 'preset-1',
    pos: 1,
    name: 'ECHO CHAMBER',
    comment: 'vintage dub tape echo with handle regeneration swell',
    list: [
      { id: 'fx-1-1', effect: 'SAMPLE' },
      { id: 'fx-1-2', effect: 'DELAY', time: 0.38, echo: 0.45, 'cross-feed': 0.3, 'lowpass-cutoff': 0.7, 'wet-level': 0.6, 'dry-level': 1.0 }
    ],
    handle: { row: 1, param: 'echo', depth: 0.45 },
    shake: { row: 1, param: 'wet-level', depth: 0.4 }
  },
  {
    id: 'preset-2',
    pos: 2,
    name: 'SPRING VERB',
    comment: 'metallic boing spring tank with shake reverb splash',
    list: [
      { id: 'fx-2-1', effect: 'SAMPLE' },
      { id: 'fx-2-2', effect: 'REVERB', time: 0.65, 'spring-mix': 0.75, 'wet-level': 0.7, 'dry-level': 0.9, 'highpass-cutoff': 0.25 }
    ],
    handle: { row: 1, param: 'time', depth: 0.3 },
    shake: { row: 1, param: 'spring-mix', depth: 0.5 }
  },
  {
    id: 'preset-3',
    pos: 3,
    name: 'ROBOT PIXIE',
    comment: 'ring modulated robotic pitch wobble with handle rate control',
    list: [
      { id: 'fx-3-1', effect: 'SAMPLE' },
      { id: 'fx-3-2', effect: 'RING', frequency: 180.0, mix: 0.8 },
      { id: 'fx-3-3', effect: 'HARMONY', pitch: 1.5, 'dry-level': 0.6 }
    ],
    lfo: { row: 1, param: 'frequency', depth: 120.0, shape: 'sine', speed: 2.5, phase: 0 },
    handle: { target: 'lfo', param: 'speed', depth: 10.0 }
  }
];

export const INITIAL_PACK: PackConfig = {
  name: 'EP2350 LIVE PACK',
  useBuiltInSamples: true,
  samples: [
    { id: 's-0', pos: 0, file: '1.wav', playmode: 'oneshot' },
    { id: 's-1', pos: 1, file: '2.wav', playmode: 'oneshot' },
    { id: 's-2', pos: 2, file: '3.wav', playmode: 'hold' },
    { id: 's-3', pos: 3, file: '4.wav', playmode: 'startstop' }
  ],
  presets: DEFAULT_PRESETS
};
