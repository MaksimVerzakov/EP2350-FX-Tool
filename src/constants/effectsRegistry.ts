import { EffectMeta, EffectType } from '../types/config';

export const EFFECTS_REGISTRY: Record<EffectType, EffectMeta> = {
  DELAY: {
    type: 'DELAY',
    displayName: 'DELAY (ECHO)',
    description: 'Stereo echo with feedback, cross-feed ping-pong, and damping filters.',
    singleInstance: true,
    params: [
      {
        name: 'time',
        label: 'TIME',
        min: 0.0,
        max: 1.1,
        step: 0.01,
        defaultVal: 0.35,
        unit: 's',
        displayScale: (v) => `${(v * 1000).toFixed(0)}ms`
      },
      {
        name: 'echo',
        label: 'ECHO (FEEDBACK)',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.4,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'cross-feed',
        label: 'CROSS-FEED',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.0,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'lowpass-cutoff',
        label: 'LP CUTOFF',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 1.0,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'highpass-cutoff',
        label: 'HP CUTOFF',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.0,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'wet-level',
        label: 'WET LEVEL',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.5,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'dry-level',
        label: 'DRY LEVEL',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 1.0,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'balance',
        label: 'PAN BALANCE',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.5,
        unit: '',
        displayScale: (v) => (v === 0.5 ? 'CTR' : v < 0.5 ? `L${Math.round((0.5 - v) * 100)}` : `R${Math.round((v - 0.5) * 100)}`)
      }
    ]
  },

  DIST: {
    type: 'DIST',
    displayName: 'DISTORTION',
    description: 'Analog-style warm overdrive and clipping with pre/post tone filtering.',
    singleInstance: false,
    params: [
      {
        name: 'amount',
        label: 'AMOUNT',
        min: 0.0,
        max: 40.0,
        step: 0.1,
        defaultVal: 10.0,
        unit: 'x',
        displayScale: (v) => `${v.toFixed(1)}x`
      },
      {
        name: 'mix',
        label: 'WET MIX',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.5,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'lowpass-cutoff',
        label: 'LP TONE',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 1.0,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'highpass-cutoff',
        label: 'HP TONE',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.0,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      }
    ]
  },

  EQUALISER: {
    type: 'EQUALISER',
    displayName: 'EQUALISER',
    description: 'Parametric peaking EQ for focused frequency boost, cut, and resonance.',
    singleInstance: false,
    params: [
      {
        name: 'CUTOFF',
        label: 'CUTOFF (FREQ)',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.5,
        unit: 'Hz',
        displayScale: (v) => `${Math.round(20 * Math.pow(1000, v))}Hz`
      },
      {
        name: 'Q',
        label: 'Q (RESONANCE)',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.7,
        unit: '',
        displayScale: (v) => (v * 10).toFixed(1)
      },
      {
        name: 'GAIN',
        label: 'GAIN',
        min: -1.0,
        max: 1.0,
        step: 0.02,
        defaultVal: 0.0,
        unit: 'dB',
        displayScale: (v) => `${v > 0 ? '+' : ''}${(v * 15).toFixed(1)}dB`
      }
    ]
  },

  HARMONY: {
    type: 'HARMONY',
    displayName: 'HARMONY (PITCH)',
    description: 'Vocal pitch tracking and pitch shifter with dry blend.',
    singleInstance: true,
    params: [
      {
        name: 'pitch',
        label: 'PITCH RATIO',
        min: 0.5,
        max: 2.0,
        step: 0.01,
        defaultVal: 1.0,
        unit: 'x',
        displayScale: (v) => {
          const semitones = Math.round(12 * Math.log2(v));
          return `${semitones > 0 ? '+' : ''}${semitones}st (${v.toFixed(2)}x)`;
        }
      },
      {
        name: 'dry-level',
        label: 'DRY LEVEL',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 1.0,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      }
    ]
  },

  LOWPASS: {
    type: 'LOWPASS',
    displayName: 'LOWPASS FILTER',
    description: '24dB/oct resonant lowpass filter attenuating higher frequencies.',
    singleInstance: false,
    params: [
      {
        name: 'cutoff',
        label: 'CUTOFF',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 1.0,
        unit: 'Hz',
        displayScale: (v) => `${Math.round(20 * Math.pow(1000, v))}Hz`
      }
    ]
  },

  HIGHPASS: {
    type: 'HIGHPASS',
    displayName: 'HIGHPASS FILTER',
    description: '24dB/oct resonant highpass filter attenuating lower frequencies.',
    singleInstance: false,
    params: [
      {
        name: 'cutoff',
        label: 'CUTOFF',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.0,
        unit: 'Hz',
        displayScale: (v) => `${Math.round(20 * Math.pow(1000, v))}Hz`
      }
    ]
  },

  SAMPLE: {
    type: 'SAMPLE',
    displayName: 'SAMPLE INJECTOR',
    description: 'Injects active audio sample into the signal chain at this position.',
    singleInstance: false,
    params: [
      {
        name: 'speed',
        label: 'SPEED RATE',
        min: 0.0,
        max: 4.0,
        step: 0.05,
        defaultVal: 1.0,
        unit: 'x',
        displayScale: (v) => `${v.toFixed(2)}x`
      },
      {
        name: 'pitch',
        label: 'PITCH (SEMITONES)',
        min: -24.0,
        max: 24.0,
        step: 1.0,
        defaultVal: 0.0,
        unit: 'st',
        displayScale: (v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}st`
      },
      {
        name: 'level',
        label: 'LEVEL (GAIN)',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 1.0,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'balance',
        label: 'BALANCE',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.5,
        unit: '',
        displayScale: (v) => (v === 0.5 ? 'CTR' : v < 0.5 ? `L${Math.round((0.5 - v) * 100)}` : `R${Math.round((v - 0.5) * 100)}`)
      }
    ]
  },

  REVERB: {
    type: 'REVERB',
    displayName: 'REVERB (ROOM)',
    description: 'Acoustic space simulator with metallic spring dispersion simulation.',
    singleInstance: true,
    params: [
      {
        name: 'time',
        label: 'DECAY TIME',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.5,
        unit: 's',
        displayScale: (v) => `${(v * 6).toFixed(1)}s`
      },
      {
        name: 'spring-mix',
        label: 'SPRING BOING',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.0,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'highpass-cutoff',
        label: 'HP ROLLOFF',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.2,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'wet-level',
        label: 'WET LEVEL',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.5,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      },
      {
        name: 'dry-level',
        label: 'DRY LEVEL',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 1.0,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      }
    ]
  },

  RING: {
    type: 'RING',
    displayName: 'RING MODULATOR',
    description: 'Multiplies input signal by an internal oscillator for metallic clangs.',
    singleInstance: false,
    params: [
      {
        name: 'frequency',
        label: 'CARRIER FREQ',
        min: 0.0,
        max: 20000.0,
        step: 5.0,
        defaultVal: 440.0,
        unit: 'Hz',
        displayScale: (v) => `${Math.round(v)}Hz`
      },
      {
        name: 'mix',
        label: 'WET MIX',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.5,
        unit: '%',
        displayScale: (v) => `${(v * 100).toFixed(0)}%`
      }
    ]
  },

  SSB: {
    type: 'SSB',
    displayName: 'SSB FREQ SHIFTER',
    description: 'Single Sideband frequency shifter displacing frequencies linearly in Hz.',
    singleInstance: true,
    params: [
      {
        name: 'frequency',
        label: 'SHIFT (HZ)',
        min: -20000.0,
        max: 20000.0,
        step: 5.0,
        defaultVal: 0.0,
        unit: 'Hz',
        displayScale: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}Hz`
      }
    ]
  },

  BALANCE: {
    type: 'BALANCE',
    displayName: 'BALANCE (PAN)',
    description: 'Stereo balance positioning and output bus leveling.',
    singleInstance: false,
    params: [
      {
        name: 'balance',
        label: 'STEREO PAN',
        min: 0.0,
        max: 1.0,
        step: 0.01,
        defaultVal: 0.5,
        unit: '',
        displayScale: (v) =>
          v === 0.5
            ? 'CTR'
            : v < 0.5
            ? `L ${((0.5 - v) * 2).toFixed(2)}`
            : `R ${((v - 0.5) * 2).toFixed(2)}`
      }
    ]
  }
};
