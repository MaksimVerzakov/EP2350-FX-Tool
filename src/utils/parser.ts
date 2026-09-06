import { AnyEffect, EffectType, PackConfig, PresetConfig, SampleSlotConfig } from '../types/config';
import { isPercentParam } from '../constants/effectsRegistry';

export function parseConfigJson(rawJson: string): { pack?: PackConfig; error?: string } {
  try {
    const data = JSON.parse(rawJson);

    if (typeof data !== 'object' || data === null) {
      return { error: 'Invalid JSON: root must be an object' };
    }

    const name = typeof data.name === 'string' ? data.name : 'IMPORTED PACK';
    const useBuiltInSamples = !Array.isArray(data.samples) || data.samples.length === 0;

    let samples: SampleSlotConfig[] = [];
    if (Array.isArray(data.samples)) {
      samples = data.samples.map((s: any, idx: number) => ({
        id: `imported-s-${idx}-${Date.now()}`,
        pos: typeof s.pos === 'number' ? s.pos : idx,
        file: typeof s.file === 'string' ? s.file : `${idx + 1}.wav`,
        playmode: ['oneshot', 'hold', 'startstop'].includes(s.playmode) ? s.playmode : 'oneshot'
      }));
    } else {
      // Create empty default 4 slots
      samples = [
        { id: 's-0', pos: 0, file: '1.wav', playmode: 'oneshot' },
        { id: 's-1', pos: 1, file: '2.wav', playmode: 'oneshot' },
        { id: 's-2', pos: 2, file: '3.wav', playmode: 'hold' },
        { id: 's-3', pos: 3, file: '4.wav', playmode: 'startstop' }
      ];
    }

    let presets: PresetConfig[] = [];
    if (Array.isArray(data.presets)) {
      presets = data.presets.map((p: any, pIdx: number) => {
        const pos = typeof p.pos === 'number' ? p.pos : pIdx;
        const pName = typeof p.name === 'string' ? p.name : `PRESET ${pos}`;
        const pComment = typeof p.comment === 'string' ? p.comment : '';

        const list: AnyEffect[] = Array.isArray(p.list)
          ? p.list.map((item: any, itemIdx: number) => {
              const effectType = (typeof item.effect === 'string' ? item.effect.toUpperCase() : 'LOWPASS') as EffectType;
              const effectEntry: AnyEffect = {
                id: `fx-${pIdx}-${itemIdx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                effect: effectType,
                ...item
              };
              effectEntry.effect = effectType;

              // Scale percent parameters from JSON (0.0..1.0) to UI percent (0..100)
              Object.keys(effectEntry).forEach((key) => {
                if (isPercentParam(effectType, key) && typeof effectEntry[key] === 'number') {
                  const val = effectEntry[key];
                  if (val <= 1.0) {
                    effectEntry[key] = Math.round(val * 100);
                  }
                }
              });

              return effectEntry;
            })
          : [];

        const preset: PresetConfig = {
          id: `preset-${pos}-${Date.now()}`,
          pos,
          name: pName,
          comment: pComment,
          list
        };

        if (p.handle && typeof p.handle === 'object') {
          const isLfo = p.handle.target === 'lfo';
          let depth = typeof p.handle.depth === 'number' ? p.handle.depth : (isLfo ? 10.0 : 80);
          if (!isLfo && Math.abs(depth) <= 1.0) {
            depth = Math.round(depth * 100);
          }
          preset.handle = {
            target: p.handle.target,
            row: typeof p.handle.row === 'number' ? p.handle.row : undefined,
            param: typeof p.handle.param === 'string' ? p.handle.param : 'cutoff',
            depth
          };
        }

        if (p.shake && typeof p.shake === 'object') {
          let depth = typeof p.shake.depth === 'number' ? p.shake.depth : 50;
          if (Math.abs(depth) <= 1.0) {
            depth = Math.round(depth * 100);
          }
          preset.shake = {
            row: typeof p.shake.row === 'number' ? p.shake.row : 0,
            param: typeof p.shake.param === 'string' ? p.shake.param : 'mix',
            depth
          };
        }

        if (p.lfo && typeof p.lfo === 'object') {
          const isLfo = p.lfo.target === 'lfo';
          let depth = typeof p.lfo.depth === 'number' ? p.lfo.depth : (isLfo ? 1.0 : 20);
          if (!isLfo && Math.abs(depth) <= 1.0) {
            depth = Math.round(depth * 100);
          }
          preset.lfo = {
            target: p.lfo.target,
            row: typeof p.lfo.row === 'number' ? p.lfo.row : 0,
            param: typeof p.lfo.param === 'string' ? p.lfo.param : 'cutoff',
            depth,
            shape: ['sine', 'square', 'sawtooth', 'random'].includes(p.lfo.shape) ? p.lfo.shape : 'sine',
            speed: typeof p.lfo.speed === 'number' ? p.lfo.speed : 2.0,
            phase: typeof p.lfo.phase === 'number' ? p.lfo.phase : 0
          };
        }

        if (p.trigger && typeof p.trigger === 'object') {
          preset.trigger = {
            row: typeof p.trigger.row === 'number' ? p.trigger.row : 0
          };
        }

        return preset;
      });
    }

    // Ensure all 4 slots (0..3) exist
    const slotMap = new Map<number, PresetConfig>();
    presets.forEach((p) => slotMap.set(p.pos, p));
    for (let slot = 0; slot < 4; slot++) {
      if (!slotMap.has(slot)) {
        slotMap.set(slot, {
          id: `preset-fill-${slot}-${Date.now()}`,
          pos: slot,
          name: `PRESET ${slot + 1}`,
          comment: '',
          list: [{ id: `fx-${slot}-s`, effect: 'SAMPLE' }]
        });
      }
    }
    const finalPresets = Array.from(slotMap.values()).sort((a, b) => a.pos - b.pos);

    return {
      pack: {
        name,
        useBuiltInSamples,
        samples,
        presets: finalPresets
      }
    };
  } catch (err: any) {
    return { error: `Failed to parse JSON: ${err.message}` };
  }
}
