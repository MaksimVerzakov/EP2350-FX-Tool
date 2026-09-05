import assert from 'node:assert';

// Implementation under test directly in ESM
const SINGLE_INSTANCE_EFFECTS = new Set(['DELAY', 'REVERB', 'HARMONY', 'SSB']);

function validatePackConfig(pack) {
  const issues = [];
  if (!pack.name || pack.name.trim().length === 0) {
    issues.push({ type: 'warning', message: 'Pack name is empty.' });
  }
  if (!pack.presets || pack.presets.length === 0) {
    issues.push({ type: 'error', message: 'At least one preset is required.' });
  }

  pack.presets.forEach((preset) => {
    const seenEffects = new Set();
    let hasSampleBlock = false;

    preset.list.forEach((effect, idx) => {
      if (effect.effect === 'SAMPLE') hasSampleBlock = true;
      if (SINGLE_INSTANCE_EFFECTS.has(effect.effect)) {
        if (seenEffects.has(effect.effect)) {
          issues.push({
            type: 'error',
            message: `Preset ${preset.pos}: Effect '${effect.effect}' can only be used once per chain.`
          });
        }
        seenEffects.add(effect.effect);
      }
    });

    if (!hasSampleBlock) {
      issues.push({
        type: 'warning',
        message: `Preset ${preset.pos}: Missing SAMPLE block.`
      });
    }
  });
  return issues;
}

function serializeToConfigJson(pack) {
  const rootObj = {
    name: pack.name.trim() || 'UNTITLED PACK'
  };

  if (!pack.useBuiltInSamples && pack.samples && pack.samples.length > 0) {
    rootObj.samples = pack.samples.map((s) => ({
      pos: s.pos,
      file: s.file,
      playmode: s.playmode
    }));
  }

  rootObj.presets = pack.presets.map((p) => {
    const presetObj = { pos: p.pos };
    if (p.name && p.name.trim()) presetObj.name = p.name.trim();
    if (p.comment && p.comment.trim()) presetObj.comment = p.comment.trim();

    presetObj.list = p.list.map((item) => {
      const effectEntry = { effect: item.effect.toUpperCase() };
      if (item.BUS) effectEntry.BUS = item.BUS;
      Object.keys(item).forEach((key) => {
        if (key !== 'id' && key !== 'effect' && key !== 'BUS' && typeof item[key] === 'number') {
          effectEntry[key] = Math.round(item[key] * 1000) / 1000;
        }
      });
      return effectEntry;
    });

    if (p.handle) {
      if (p.handle.target === 'lfo') {
        presetObj.handle = { target: 'lfo', param: p.handle.param, depth: Math.round(p.handle.depth * 1000) / 1000 };
      } else if (typeof p.handle.row === 'number') {
        presetObj.handle = { row: p.handle.row, param: p.handle.param, depth: Math.round(p.handle.depth * 1000) / 1000 };
      }
    }
    if (p.shake && typeof p.shake.row === 'number') {
      presetObj.shake = { row: p.shake.row, param: p.shake.param, depth: Math.round(p.shake.depth * 1000) / 1000 };
    }
    if (p.lfo) {
      const lfo = { param: p.lfo.param, shape: p.lfo.shape, speed: p.lfo.speed, depth: p.lfo.depth };
      if (p.lfo.target === 'lfo') lfo.target = 'lfo';
      else if (typeof p.lfo.row === 'number') lfo.row = p.lfo.row;
      presetObj.lfo = lfo;
    }
    if (p.trigger && typeof p.trigger.row === 'number') {
      presetObj.trigger = { row: p.trigger.row };
    }
    return presetObj;
  });

  return JSON.stringify(rootObj, null, 2);
}

function parseConfigJson(rawJson) {
  const data = JSON.parse(rawJson);
  const name = typeof data.name === 'string' ? data.name : 'IMPORTED PACK';
  const useBuiltInSamples = !Array.isArray(data.samples) || data.samples.length === 0;
  const presets = (data.presets || []).map((p, idx) => ({
    id: `preset-${p.pos ?? idx}`,
    pos: p.pos ?? idx,
    name: p.name || '',
    comment: p.comment || '',
    list: (p.list || []).map((item, itemIdx) => ({
      id: `fx-${itemIdx}`,
      effect: (item.effect || 'LOWPASS').toUpperCase(),
      ...item
    })),
    handle: p.handle,
    shake: p.shake,
    lfo: p.lfo,
    trigger: p.trigger
  }));
  return { pack: { name, useBuiltInSamples, presets } };
}

console.log('=== RUNNING EP-2350 COMPLIANCE TESTS ===');

// Test 1: Chapter 7.11 Bad Reception Spec
const badReceptionPack = {
  name: 'EP2350 PACK',
  useBuiltInSamples: true,
  presets: [
    {
      pos: 0,
      name: 'BAD RECEPTION',
      comment: 'static noise that clears up when handle is pushed',
      list: [
        { effect: 'DIST', amount: 10.0, mix: 0.5 },
        { effect: 'LOWPASS', cutoff: 0.2 },
        { effect: 'SAMPLE' }
      ],
      handle: { row: 1, param: 'cutoff', depth: 0.8 },
      shake: { row: 0, param: 'mix', depth: 0.5 },
      trigger: { row: 2 }
    }
  ]
};

const serialized = serializeToConfigJson(badReceptionPack);
console.log('Serialized Bad Reception:');
console.log(serialized);

const parsed = JSON.parse(serialized);
assert.strictEqual(parsed.samples, undefined, 'Chapter 7.5: Samples block must be omitted');
assert.strictEqual(parsed.presets[0].list[0].effect, 'DIST');
assert.strictEqual(parsed.presets[0].list[1].effect, 'LOWPASS');
assert.strictEqual(parsed.presets[0].list[2].effect, 'SAMPLE');
assert.deepStrictEqual(parsed.presets[0].handle, { row: 1, param: 'cutoff', depth: 0.8 });
assert.deepStrictEqual(parsed.presets[0].shake, { row: 0, param: 'mix', depth: 0.5 });
assert.deepStrictEqual(parsed.presets[0].trigger, { row: 2 });
console.log('✓ Chapter 7.11 Bad Reception test passed!');

// Test 2: Single instance constraint check
const duplicateChain = {
  name: 'TEST',
  useBuiltInSamples: true,
  presets: [
    {
      pos: 0,
      list: [{ effect: 'DELAY' }, { effect: 'DELAY' }, { effect: 'SAMPLE' }]
    }
  ]
};
const issues = validatePackConfig(duplicateChain);
assert.ok(issues.some(i => i.type === 'error' && i.message.includes('DELAY')));
console.log('✓ Single instance constraint check passed!');

// Test 3: Round-trip check
const roundTrip = parseConfigJson(serialized);
assert.strictEqual(roundTrip.pack.name, 'EP2350 PACK');
assert.strictEqual(roundTrip.pack.presets[0].name, 'BAD RECEPTION');
console.log('✓ Round-trip serialization & parsing passed!');

// Test 4: Chapter 7.10 Parallel Bus routing test
const busRoutingPack = {
  name: 'BUS TEST',
  useBuiltInSamples: true,
  presets: [
    {
      pos: 0,
      name: 'PARALLEL DUB',
      list: [
        { effect: 'SAMPLE' },
        { effect: 'DIST', amount: 15, mix: 0.8, BUS: 1 },
        { effect: 'REVERB', time: 0.8, BUS: 2 }
      ]
    }
  ]
};
const busSerialized = serializeToConfigJson(busRoutingPack);
const busParsed = JSON.parse(busSerialized);
assert.strictEqual(busParsed.presets[0].list[0].BUS, undefined, 'Serial effect must omit BUS');
assert.strictEqual(busParsed.presets[0].list[1].BUS, 1, 'Bus 1 effect must serialize BUS: 1');
assert.strictEqual(busParsed.presets[0].list[2].BUS, 2, 'Bus 2 effect must serialize BUS: 2');

const busRoundTrip = parseConfigJson(busSerialized);
assert.strictEqual(busRoundTrip.pack.presets[0].list[1].BUS, 1, 'Round-trip must preserve BUS: 1');
assert.strictEqual(busRoundTrip.pack.presets[0].list[2].BUS, 2, 'Round-trip must preserve BUS: 2');
console.log('✓ Chapter 7.10 Parallel Bus routing test passed!');

console.log('=== ALL AUTOMATED COMPLIANCE TESTS PASSED (100%) ===');

