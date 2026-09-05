import { PackConfig } from '../types/config';

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  presetPos?: number;
}

export function validatePackConfig(pack: PackConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!pack.name || pack.name.trim().length === 0) {
    issues.push({ type: 'warning', message: 'Pack name is empty. A descriptive name is recommended.' });
  }

  // Presets validation
  if (!pack.presets || pack.presets.length === 0) {
    issues.push({ type: 'error', message: 'At least one preset is required.' });
  }

  const SINGLE_INSTANCE_EFFECTS = new Set(['DELAY', 'REVERB', 'HARMONY', 'SSB']);

  pack.presets.forEach((preset) => {
    // Check single-use effects
    const seenEffects = new Set<string>();
    let hasSampleBlock = false;

    preset.list.forEach((effect, idx) => {
      if (effect.effect === 'SAMPLE') {
        hasSampleBlock = true;
      }
      if (SINGLE_INSTANCE_EFFECTS.has(effect.effect)) {
        if (seenEffects.has(effect.effect)) {
          issues.push({
            type: 'error',
            message: `Preset ${preset.pos} (${preset.name || 'Unnamed'}): Effect '${effect.effect}' can only be used once per chain.`,
            presetPos: preset.pos
          });
        }
        seenEffects.add(effect.effect);
      }

      // Check row target bounds in modulations
      if (preset.handle && preset.handle.row === idx && preset.handle.target !== 'lfo') {
        // valid
      }
    });

    if (!hasSampleBlock) {
      issues.push({
        type: 'warning',
        message: `Preset ${preset.pos} (${preset.name || 'Unnamed'}): Missing '{ "effect": "SAMPLE" }'. No sound will be generated on this preset.`,
        presetPos: preset.pos
      });
    }

    // Check handle row validity
    if (preset.handle && preset.handle.target !== 'lfo' && typeof preset.handle.row === 'number') {
      if (preset.handle.row < 0 || preset.handle.row >= preset.list.length) {
        issues.push({
          type: 'error',
          message: `Preset ${preset.pos}: Handle targets row ${preset.handle.row}, but chain only has ${preset.list.length} effects.`,
          presetPos: preset.pos
        });
      }
    }

    // Check shake row validity
    if (preset.shake && typeof preset.shake.row === 'number') {
      if (preset.shake.row < 0 || preset.shake.row >= preset.list.length) {
        issues.push({
          type: 'error',
          message: `Preset ${preset.pos}: Shake targets row ${preset.shake.row}, but chain only has ${preset.list.length} effects.`,
          presetPos: preset.pos
        });
      }
    }

    // Check lfo row validity
    if (preset.lfo && preset.lfo.target !== 'lfo' && typeof preset.lfo.row === 'number') {
      if (preset.lfo.row < 0 || preset.lfo.row >= preset.list.length) {
        issues.push({
          type: 'error',
          message: `Preset ${preset.pos}: LFO targets row ${preset.lfo.row}, but chain only has ${preset.list.length} effects.`,
          presetPos: preset.pos
        });
      }
    }
  });

  return issues;
}

export function serializeToConfigJson(pack: PackConfig): string {
  const rootObj: any = {
    name: pack.name.trim() || 'UNTITLED PACK'
  };

  // 1. Samples: if using factory sounds, completely delete the samples array
  if (!pack.useBuiltInSamples && pack.samples && pack.samples.length > 0) {
    rootObj.samples = pack.samples.map((s) => ({
      pos: s.pos,
      file: s.file,
      playmode: s.playmode
    }));
  }

  // 2. Presets
  rootObj.presets = pack.presets.map((p) => {
    const presetObj: any = {
      pos: p.pos
    };

    if (p.name && p.name.trim().length > 0) {
      presetObj.name = p.name.trim();
    }

    if (p.comment && p.comment.trim().length > 0) {
      presetObj.comment = p.comment.trim();
    }

    // Effects list
    presetObj.list = p.list.map((item) => {
      const effectEntry: any = {
        effect: item.effect.toUpperCase()
      };

      if (item.BUS) {
        effectEntry.BUS = item.BUS;
      }

      // Copy all effect-specific numeric parameters
      Object.keys(item).forEach((key) => {
        if (key !== 'id' && key !== 'effect' && key !== 'BUS' && typeof item[key] === 'number') {
          // Clean round numbers to 3 decimal places max
          effectEntry[key] = Math.round(item[key] * 1000) / 1000;
        }
      });

      return effectEntry;
    });

    // Modulations
    if (p.handle) {
      if (p.handle.target === 'lfo') {
        presetObj.handle = {
          target: 'lfo',
          param: p.handle.param,
          depth: Math.round(p.handle.depth * 1000) / 1000
        };
      } else if (typeof p.handle.row === 'number') {
        presetObj.handle = {
          row: p.handle.row,
          param: p.handle.param,
          depth: Math.round(p.handle.depth * 1000) / 1000
        };
      }
    }

    if (p.shake && typeof p.shake.row === 'number') {
      presetObj.shake = {
        row: p.shake.row,
        param: p.shake.param,
        depth: Math.round(p.shake.depth * 1000) / 1000
      };
    }

    if (p.lfo) {
      const lfoEntry: any = {
        param: p.lfo.param,
        shape: p.lfo.shape,
        speed: Math.round(p.lfo.speed * 100) / 100,
        depth: Math.round(p.lfo.depth * 1000) / 1000
      };
      if (p.lfo.target === 'lfo') {
        lfoEntry.target = 'lfo';
      } else if (typeof p.lfo.row === 'number') {
        lfoEntry.row = p.lfo.row;
      }
      if (typeof p.lfo.phase === 'number') {
        lfoEntry.phase = p.lfo.phase;
      }
      presetObj.lfo = lfoEntry;
    }

    if (p.trigger && typeof p.trigger.row === 'number') {
      presetObj.trigger = {
        row: p.trigger.row
      };
    }

    return presetObj;
  });

  return JSON.stringify(rootObj, null, 2);
}
