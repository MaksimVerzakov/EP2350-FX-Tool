export type EffectType =
  | 'DELAY'
  | 'DIST'
  | 'EQUALISER'
  | 'HARMONY'
  | 'LOWPASS'
  | 'HIGHPASS'
  | 'SAMPLE'
  | 'REVERB'
  | 'RING'
  | 'SSB'
  | 'BALANCE';

export type PlayMode = 'oneshot' | 'hold' | 'startstop';

export type LfoShape = 'sine' | 'square' | 'sawtooth' | 'random';

export interface BaseEffect {
  id: string; // Internal unique ID for React keys and drag-and-drop
  effect: EffectType;
  BUS?: 1 | 2;
  [key: string]: any;
}

export interface DelayEffect extends BaseEffect {
  effect: 'DELAY';
  time?: number; // 0.0 - 1.1 s
  'lowpass-cutoff'?: number; // 0.0 - 1.0
  'highpass-cutoff'?: number; // 0.0 - 1.0
  'wet-level'?: number; // 0.0 - 1.0
  'dry-level'?: number; // 0.0 - 1.0
  echo?: number; // 0.0 - 1.0
  'cross-feed'?: number; // 0.0 - 1.0
  balance?: number; // 0.0 - 1.0
}

export interface DistEffect extends BaseEffect {
  effect: 'DIST';
  amount?: number; // 0.0 - 40.0
  'lowpass-cutoff'?: number; // 0.0 - 1.0
  'highpass-cutoff'?: number; // 0.0 - 1.0
  mix?: number; // 0.0 - 1.0
}

export interface EqualiserEffect extends BaseEffect {
  effect: 'EQUALISER';
  CUTOFF?: number; // 0.0 - 1.0
  Q?: number; // 0.0 - 1.0
  GAIN?: number; // -1.0 - 1.0
}

export interface HarmonyEffect extends BaseEffect {
  effect: 'HARMONY';
  'dry-level'?: number; // 0.0 - 1.0
  pitch?: number; // 0.5 - 2.0
}

export interface FilterEffect extends BaseEffect {
  effect: 'LOWPASS' | 'HIGHPASS';
  cutoff?: number; // 0.0 - 1.0
}

export interface SampleEffect extends BaseEffect {
  effect: 'SAMPLE';
  speed?: number; // 0.0 - 4.0
  pitch?: number; // -24.0 - 24.0
  level?: number; // 0.0 - 1.0
  balance?: number; // 0.0 - 1.0
}

export interface ReverbEffect extends BaseEffect {
  effect: 'REVERB';
  'dry-level'?: number; // 0.0 - 1.0
  'wet-level'?: number; // 0.0 - 1.0
  time?: number; // 0.0 - 1.0
  'spring-mix'?: number; // 0.0 - 1.0
  'highpass-cutoff'?: number; // 0.0 - 1.0
}

export interface RingEffect extends BaseEffect {
  effect: 'RING';
  frequency?: number; // 0.0 - 20000.0
  mix?: number; // 0.0 - 1.0
}

export interface SsbEffect extends BaseEffect {
  effect: 'SSB';
  frequency?: number; // -20000.0 - 20000.0
}

export interface BalanceEffect extends BaseEffect {
  effect: 'BALANCE';
  balance?: number; // 0.0 - 1.0
}

export type AnyEffect =
  | DelayEffect
  | DistEffect
  | EqualiserEffect
  | HarmonyEffect
  | FilterEffect
  | SampleEffect
  | ReverbEffect
  | RingEffect
  | SsbEffect
  | BalanceEffect;

export interface ModulationHandle {
  row?: number;
  target?: 'lfo';
  param: string;
  depth: number;
}

export interface ModulationShake {
  row: number;
  param: string;
  depth: number;
}

export interface ModulationLfo {
  row?: number;
  target?: 'lfo';
  param: string;
  depth: number;
  shape: LfoShape;
  speed: number;
  phase?: number;
}

export interface ModulationTrigger {
  row: number;
}

export interface PresetConfig {
  id: string; // Internal ID
  pos: number; // 0, 1, 2, 3
  name?: string;
  comment?: string;
  list: AnyEffect[];
  handle?: ModulationHandle;
  shake?: ModulationShake;
  lfo?: ModulationLfo;
  trigger?: ModulationTrigger;
}

export interface SampleSlotConfig {
  id: string;
  pos: number; // 0, 1, 2, 3
  file: string;
  playmode: PlayMode;
  audioBlobUrl?: string; // Loaded audio for auditioning
  sizeBytes?: number;
}

export interface PackConfig {
  name: string;
  useBuiltInSamples: boolean;
  samples: SampleSlotConfig[];
  presets: PresetConfig[];
}

export interface ParamDef {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultVal: number;
  unit: string;
  displayScale?: (val: number) => string;
}

export interface EffectMeta {
  type: EffectType;
  displayName: string;
  description: string;
  singleInstance: boolean;
  params: ParamDef[];
}
