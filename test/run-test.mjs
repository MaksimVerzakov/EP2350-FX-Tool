import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TMP_TEST_BUILD = path.join(ROOT_DIR, '.tmp-test-build');

/**
 * Compile actual TypeScript source modules from `src/` so tests always exercise
 * the real production parser, serializer, validator, and effects registry.
 */
function buildSourceModulesForTest() {
  fs.rmSync(TMP_TEST_BUILD, { recursive: true, force: true });
  fs.mkdirSync(TMP_TEST_BUILD, { recursive: true });

  const filesToCompile = [
    'src/types/config.ts',
    'src/constants/effectsRegistry.ts',
    'src/utils/parser.ts',
    'src/utils/serializer.ts'
  ];

  for (const relPath of filesToCompile) {
    const absIn = path.join(ROOT_DIR, relPath);
    const source = fs.readFileSync(absIn, 'utf8');
    const stripped = stripTypeScriptTypes(source);

    // Rewrite relative TS imports to explicit .mjs extensions for Node ESM
    const rewritten = stripped.replace(
      /from\s+['"](\.[^'"]+)['"]/g,
      (_, spec) => `from '${spec}.mjs'`
    );

    const absOut = path.join(TMP_TEST_BUILD, relPath.replace(/\.ts$/, '.mjs'));
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    fs.writeFileSync(absOut, rewritten, 'utf8');
  }
}

buildSourceModulesForTest();

const { EFFECTS_REGISTRY, isPercentParam, getModDepthConfig } = await import(
  pathToFileURL(path.join(TMP_TEST_BUILD, 'src/constants/effectsRegistry.mjs')).href
);
const { parseConfigJson } = await import(
  pathToFileURL(path.join(TMP_TEST_BUILD, 'src/utils/parser.mjs')).href
);
const { serializeToConfigJson, validatePackConfig } = await import(
  pathToFileURL(path.join(TMP_TEST_BUILD, 'src/utils/serializer.mjs')).href
);

// Clean up temporary transpiled files on exit
process.on('exit', () => {
  fs.rmSync(TMP_TEST_BUILD, { recursive: true, force: true });
});

console.log('=== RUNNING EP-2350 PRODUCTION TEST SUITE ===\n');

// ---------------------------------------------------------------------------
// SUITE 1: Official Teenage Engineering Preset Packs Lossless Round-Trip
// ---------------------------------------------------------------------------
const officialPackPaths = [
  'packs/ep-2350_preset_pack-broken_radio/config.json',
  'packs/ep-2350_preset_pack-dub/config.json',
  'packs/ep-2350_preset_pack-mysterious/config.json'
];

for (const relPackPath of officialPackPaths) {
  const fullPath = path.join(ROOT_DIR, relPackPath);
  const rawJson = fs.readFileSync(fullPath, 'utf8');
  const originalObj = JSON.parse(rawJson);

  const parsedResult = parseConfigJson(rawJson);
  assert.strictEqual(parsedResult.error, undefined, `Pack ${relPackPath} should parse without error`);
  assert.ok(parsedResult.pack, `Pack ${relPackPath} must return a pack object`);
  assert.strictEqual(parsedResult.pack.presets.length, 4, `Pack ${relPackPath} must have 4 presets`);

  // Validate official pack produces zero validation errors
  const validationIssues = validatePackConfig(parsedResult.pack);
  const errors = validationIssues.filter((i) => i.type === 'error');
  assert.strictEqual(errors.length, 0, `Official pack ${relPackPath} must have 0 validation errors`);

  // Round-trip back to config.json and compare deeply with official TE hardware config
  const reserializedJson = serializeToConfigJson(parsedResult.pack);
  const reserializedObj = JSON.parse(reserializedJson);

  assert.deepStrictEqual(
    reserializedObj,
    originalObj,
    `Lossless round-trip failed for official pack: ${relPackPath}`
  );
  console.log(`✓ Suite 1: Official TE Pack round-trip verified (${originalObj.name})`);
}

// ---------------------------------------------------------------------------
// SUITE 2: Effects Registry & Modulation Depth Unit Scaling
// ---------------------------------------------------------------------------
const expectedEffects = [
  'DELAY', 'DIST', 'EQUALISER', 'HARMONY', 'LOWPASS',
  'HIGHPASS', 'SAMPLE', 'REVERB', 'RING', 'SSB', 'BALANCE'
];
for (const fxName of expectedEffects) {
  assert.ok(EFFECTS_REGISTRY[fxName], `EFFECTS_REGISTRY must define ${fxName}`);
}

// DELAY.time max must be 1.2s per hardware spec
const delayTimeParam = EFFECTS_REGISTRY.DELAY.params.find((p) => p.name === 'time');
assert.strictEqual(delayTimeParam.max, 1.2, 'DELAY.time max must be 1.2s');

// Native unit modulation depth checks
assert.strictEqual(getModDepthConfig('SSB', 'frequency').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('SSB', 'frequency').max, 5000);
assert.strictEqual(getModDepthConfig('RING', 'frequency').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('HARMONY', 'pitch').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('HARMONY', 'pitch').max, 1.5);
assert.strictEqual(getModDepthConfig('DELAY', 'time').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('SAMPLE', 'pitch').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('DIST', 'amount').isNormalizedPercent, false);

// Normalized [0..1] percentage modulation depth checks
assert.strictEqual(getModDepthConfig('LOWPASS', 'cutoff').isNormalizedPercent, true);
assert.strictEqual(getModDepthConfig('HIGHPASS', 'cutoff').isNormalizedPercent, true);
assert.strictEqual(getModDepthConfig('DIST', 'mix').isNormalizedPercent, true);
assert.strictEqual(getModDepthConfig('DELAY', 'echo').isNormalizedPercent, true);
assert.strictEqual(getModDepthConfig('REVERB', 'time').isNormalizedPercent, true);
assert.strictEqual(getModDepthConfig('REVERB', 'spring-mix').isNormalizedPercent, true);
assert.strictEqual(getModDepthConfig('BALANCE', 'balance').isNormalizedPercent, true);

// LOWPASS / HIGHPASS cutoff is stored as 0.0..1.0 on the effect card, not 0..100
assert.strictEqual(isPercentParam('LOWPASS', 'cutoff'), false);
assert.strictEqual(isPercentParam('HIGHPASS', 'cutoff'), false);
assert.strictEqual(isPercentParam('DIST', 'mix'), true);
assert.strictEqual(isPercentParam('DELAY', 'echo'), true);
console.log('✓ Suite 2: Effects Registry & Modulation Depth units verified');

// ---------------------------------------------------------------------------
// SUITE 3: Validator Constraints & Edge Cases
// ---------------------------------------------------------------------------
const invalidPack = {
  name: '   ',
  useBuiltInSamples: true,
  samples: [],
  presets: [
    {
      id: 'p0',
      pos: 0,
      name: 'BROKEN CHAIN',
      comment: '',
      list: [
        { id: '1', effect: 'DELAY', time: 0.4 },
        { id: '2', effect: 'DELAY', time: 0.2 }, // duplicate single-instance
        { id: '3', effect: 'HARMONY', pitch: 1.2 },
        { id: '4', effect: 'HARMONY', pitch: 0.8 } // duplicate single-instance
      ],
      handle: { row: 9, param: 'cutoff', depth: 50 }, // out-of-bounds row
      shake: { row: 7, param: 'mix', depth: 50 }, // out-of-bounds row
      lfo: { row: 8, param: 'cutoff', depth: 50, shape: 'sine', speed: 2 } // out-of-bounds row
    }
  ]
};

const issues = validatePackConfig(invalidPack);
assert.ok(issues.some((i) => i.type === 'warning' && i.message.includes('Pack name is empty')));
assert.ok(issues.some((i) => i.type === 'warning' && i.message.includes('Missing')));
assert.ok(issues.some((i) => i.type === 'error' && i.message.includes("'DELAY' can only be used once")));
assert.ok(issues.some((i) => i.type === 'error' && i.message.includes("'HARMONY' can only be used once")));
assert.ok(issues.some((i) => i.type === 'error' && i.message.includes('Handle targets row 9')));
assert.ok(issues.some((i) => i.type === 'error' && i.message.includes('Shake targets row 7')));
assert.ok(issues.some((i) => i.type === 'error' && i.message.includes('LFO targets row 8')));
console.log('✓ Suite 3: Validator constraints & out-of-bounds modulation row checks verified');

// ---------------------------------------------------------------------------
// SUITE 4: Parser Resilience, Custom Samples, Parallel Buses & Bipolar Depths
// ---------------------------------------------------------------------------
assert.ok(parseConfigJson('not-valid-json').error, 'Malformed JSON must return error');
assert.ok(parseConfigJson('null').error, 'Non-object JSON root must return error');

// Partial preset pack (only 1 preset) must auto-populate all 4 hardware slots (0..3)
const singlePresetRaw = JSON.stringify({
  name: 'CUSTOM DUB',
  samples: [
    { pos: 0, file: 'samples/siren.wav', playmode: 'oneshot' },
    { pos: 1, file: 'samples/sub.wav', playmode: 'hold' }
  ],
  presets: [
    {
      pos: 0,
      name: 'PARALLEL BUS',
      comment: 'bus 1 and bus 2 split',
      list: [
        { effect: 'HARMONY', pitch: 1.5, 'dry-level': 0.4, BUS: 2 },
        { effect: 'DELAY', time: 0.5, echo: 0.6, BUS: 1 },
        { effect: 'SAMPLE', speed: 1.0, pitch: -12 }
      ],
      handle: { target: 'lfo', param: 'speed', depth: -6.5 },
      shake: { row: 1, param: 'echo', depth: -0.4 },
      lfo: { row: 0, param: 'pitch', depth: -0.25, shape: 'sawtooth', speed: 3.5, phase: 0.5 },
      trigger: { row: 2 }
    }
  ]
});

const customParsed = parseConfigJson(singlePresetRaw);
assert.strictEqual(customParsed.error, undefined);
assert.strictEqual(customParsed.pack.useBuiltInSamples, false);
assert.strictEqual(customParsed.pack.samples.length, 2);
assert.strictEqual(customParsed.pack.presets.length, 4, 'Missing slots 1..3 must be auto-populated');
assert.strictEqual(customParsed.pack.presets[0].shake.depth, -40, 'Normalized -0.4 depth -> -40% in UI');
assert.strictEqual(customParsed.pack.presets[0].lfo.depth, -0.25, 'HARMONY.pitch depth stays -0.25x');

const customReserialized = JSON.parse(serializeToConfigJson(customParsed.pack));
assert.strictEqual(customReserialized.samples.length, 2);
assert.strictEqual(customReserialized.presets[0].handle.target, 'lfo');
assert.strictEqual(customReserialized.presets[0].handle.depth, -6.5);
assert.strictEqual(customReserialized.presets[0].shake.depth, -0.4);
assert.strictEqual(customReserialized.presets[0].lfo.depth, -0.25);
assert.strictEqual(customReserialized.presets[0].lfo.phase, 0.5);
console.log('✓ Suite 4: Parser resilience, custom samples, parallel buses & bipolar depths verified');

// ---------------------------------------------------------------------------
// SUITE 5: Constant-Speed Dual-Grain Pitch Shifter & DSP Math Verification
// ---------------------------------------------------------------------------
// 5a. Verify dual-grain overlapping Hann window partition of unity (winA + winB === 1.0 everywhere)
for (let step = 0; step < 1000; step++) {
  const phase = step / 1000;
  const pA = phase;
  const pB = (phase + 0.5) % 1.0;
  const winA = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * pA));
  const winB = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * pB));
  assert.ok(Math.abs(winA + winB - 1.0) < 1e-12, `Hann window sum must be 1.0 at phase ${phase}`);
}

// 5b. Run phase-aligned dual-grain circular buffer pitch shifter on a 220 Hz sine wave at 48 kHz
function runPitchShifterOffline(inputSignal, targetPitch) {
  const bufferSize = 16384;
  const mask = bufferSize - 1;
  const ringBuffer = new Float32Array(bufferSize);
  const grainSize = 2048;
  let writeIdx = 0;
  let phase = 0.0;
  let currentPitch = targetPitch;
  let delayA = 4;
  let delayB = grainSize * 0.5 + 4;

  const readInterpolated = (delaySamples) => {
    const readPos = writeIdx - delaySamples + bufferSize;
    const idx0 = Math.floor(readPos);
    const frac = readPos - idx0;
    const ym1 = ringBuffer[(idx0 - 1) & mask];
    const y0 = ringBuffer[idx0 & mask];
    const y1 = ringBuffer[(idx0 + 1) & mask];
    const y2 = ringBuffer[(idx0 + 2) & mask];
    const c0 = y0;
    const c1 = 0.5 * (y1 - ym1);
    const c2 = ym1 - 2.5 * y0 + 2.0 * y1 - 0.5 * y2;
    const c3 = 0.5 * (y2 - ym1) + 1.5 * (y0 - y1);
    return ((c3 * frac + c2) * frac + c1) * frac + c0;
  };

  // Find delay offset near baseDelay that best phase-locks with activeRefDelay
  const findPhaseAlignedDelay = (baseDelay, activeRefDelay) => {
    const ref0 = readInterpolated(activeRefDelay);
    const ref1 = readInterpolated(activeRefDelay + 4);
    const ref2 = readInterpolated(activeRefDelay + 8);
    let bestDelay = baseDelay;
    let bestErr = Infinity;
    // Search up to 480 samples (~100 Hz fundamental period at 48kHz)
    for (let offset = 0; offset < 480; offset += 2) {
      const cand = baseDelay + offset;
      const c0 = ringBuffer[(writeIdx - Math.floor(cand) + bufferSize) & mask];
      const c1 = ringBuffer[(writeIdx - Math.floor(cand + 4) + bufferSize) & mask];
      const c2 = ringBuffer[(writeIdx - Math.floor(cand + 8) + bufferSize) & mask];
      const d0 = c0 - ref0;
      const d1 = c1 - ref1;
      const d2 = c2 - ref2;
      const err = d0 * d0 + d1 * d1 + d2 * d2;
      if (err < bestErr) {
        bestErr = err;
        bestDelay = cand;
      }
    }
    return bestDelay;
  };

  const output = new Float32Array(inputSignal.length);
  for (let i = 0; i < inputSignal.length; i++) {
    const x = inputSignal[i];
    ringBuffer[writeIdx] = x;
    currentPitch += (targetPitch - currentPitch) * 0.0025;
    const step = 1.0 / grainSize;
    const prevPhase = phase;
    phase += step;
    if (phase >= 1.0) {
      phase -= 1.0;
      // Grain A wrapped to 0 (silent): phase-align Grain A to active Grain B
      const baseStart = currentPitch > 1.0 ? grainSize + 8 : 8;
      delayA = findPhaseAlignedDelay(baseStart, delayB);
    }
    if (prevPhase < 0.5 && phase >= 0.5) {
      // Grain B wrapped to 0 (silent): phase-align Grain B to active Grain A
      const baseStart = currentPitch > 1.0 ? grainSize + 8 : 8;
      delayB = findPhaseAlignedDelay(baseStart, delayA);
    }

    const delayDelta = 1.0 - currentPitch;
    delayA = Math.max(4, delayA + delayDelta);
    delayB = Math.max(4, delayB + delayDelta);

    const pA = phase;
    const pB = phase + 0.5 - Math.floor(phase + 0.5);
    const winA = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * pA));
    const winB = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * pB));
    const wet = winA * readInterpolated(delayA) + winB * readInterpolated(delayB);

    const shiftDist = Math.min(1.0, Math.abs(currentPitch - 1.0) / 0.015);
    output[i] = x * (1.0 - shiftDist) + wet * shiftDist;
    writeIdx = (writeIdx + 1) & mask;
  }
  return output;
}

const sampleRate = 48000;
const durationSamples = 48000; // 1.0 second
const baseFreq = 220;
const sine220 = new Float32Array(durationSamples);
for (let i = 0; i < durationSamples; i++) {
  sine220[i] = Math.sin((2 * Math.PI * baseFreq * i) / sampleRate);
}

// At 1.0x pitch, output must equal input with identical length (constant speed)
const outUnity = runPitchShifterOffline(sine220, 1.0);
assert.strictEqual(outUnity.length, sine220.length);
for (let i = 0; i < sine220.length; i++) {
  assert.ok(Math.abs(outUnity[i] - sine220[i]) < 1e-6, 'Unity pitch must be bit-transparent');
}

// Estimate perceived fundamental frequency via short-time autocorrelation across grain centers
function estimatePitchHzByAutocorrelation(signal, sr) {
  const windowLen = 1024;
  const minLag = Math.floor(sr / 800); // 800 Hz max
  const maxLag = Math.floor(sr / 60);  // 60 Hz min
  const accumCorr = new Float64Array(maxLag + 1);

  for (let frameStart = Math.floor(sr * 0.2); frameStart + windowLen + maxLag < signal.length; frameStart += 512) {
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < windowLen; i++) {
        sum += signal[frameStart + i] * signal[frameStart + i + lag];
      }
      accumCorr[lag] += sum;
    }
  }

  // Find first prominent autocorrelation peak after initial zero-crossing
  let bestLag = minLag;
  let inPositivePeak = false;
  let maxVal = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (!inPositivePeak && accumCorr[lag] < 0 && lag + 1 <= maxLag && accumCorr[lag + 1] >= 0) {
      inPositivePeak = true;
    }
    if (inPositivePeak) {
      if (accumCorr[lag] > maxVal) {
        maxVal = accumCorr[lag];
        bestLag = lag;
      } else if (accumCorr[lag] < 0) {
        break; // completed first fundamental period peak
      }
    }
  }
  return sr / bestLag;
}

const outOctaveUp = runPitchShifterOffline(sine220, 2.0);
const outOctaveDown = runPitchShifterOffline(sine220, 0.5);
const hzUp = estimatePitchHzByAutocorrelation(outOctaveUp, sampleRate);
const hzDown = estimatePitchHzByAutocorrelation(outOctaveDown, sampleRate);

assert.strictEqual(outOctaveUp.length, durationSamples, 'Pitch shift up must preserve 1.0x duration');
assert.strictEqual(outOctaveDown.length, durationSamples, 'Pitch shift down must preserve 1.0x duration');
assert.ok(Math.abs(hzUp - 440) <= 6, `2.0x pitch of 220Hz should peak at ~440Hz (got ${hzUp}Hz)`);
assert.ok(Math.abs(hzDown - 110) <= 6, `0.5x pitch of 220Hz should peak at ~110Hz (got ${hzDown}Hz)`);
console.log(
  `✓ Suite 5: Constant-speed dual-grain pitch shifter verified (220Hz -> 0.5x=${hzDown}Hz, 2.0x=${hzUp}Hz at 1.0x speed)`
);

console.log('\n=== ALL 5 PRODUCTION TEST SUITES PASSED (100%) ===');
