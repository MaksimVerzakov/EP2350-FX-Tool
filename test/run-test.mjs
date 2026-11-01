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
 * Transpile TypeScript modules on the fly using Node 22+ built-in type stripper.
 * Zero external bundlers or native binaries needed.
 */
function buildSourceModulesForTest() {
  fs.rmSync(TMP_TEST_BUILD, { recursive: true, force: true });
  fs.mkdirSync(TMP_TEST_BUILD, { recursive: true });

  const filesToCompile = [
    'src/types/config.ts',
    'src/constants/effectsRegistry.ts',
    'src/constants/defaultPresets.ts',
    'src/utils/parser.ts',
    'src/utils/serializer.ts',
    'src/dsp/math.ts'
  ];

  for (const relPath of filesToCompile) {
    const absIn = path.join(ROOT_DIR, relPath);
    let source = fs.readFileSync(absIn, 'utf8');

    // Handle vite ?raw imports in defaultPresets.ts
    source = source.replace(
      /import\s+([a-zA-Z0-9_]+)\s+from\s+['"]([^'"]+)\?raw['"]/g,
      (match, varName, importPath) => {
        const fullJsonPath = path.resolve(path.dirname(absIn), importPath);
        const jsonContent = fs.readFileSync(fullJsonPath, 'utf8');
        return `const ${varName} = ${JSON.stringify(jsonContent)};`;
      }
    );

    const stripped = stripTypeScriptTypes(source);
    // Rewrite relative imports to .mjs
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

// Load modules
const { EFFECTS_REGISTRY, isPercentParam, getModDepthConfig } = await import(
  pathToFileURL(path.join(TMP_TEST_BUILD, 'src/constants/effectsRegistry.mjs')).href
);
const { OFFICIAL_TE_PACKS } = await import(
  pathToFileURL(path.join(TMP_TEST_BUILD, 'src/constants/defaultPresets.mjs')).href
);
const { parseConfigJson } = await import(
  pathToFileURL(path.join(TMP_TEST_BUILD, 'src/utils/parser.mjs')).href
);
const { serializeToConfigJson, validatePackConfig } = await import(
  pathToFileURL(path.join(TMP_TEST_BUILD, 'src/utils/serializer.mjs')).href
);
const {
  PitchShiftKernel,
  computeLfoWave,
  cutoffToHz,
  hann,
  makeDistortionCurve,
  makeSoftClipCurve,
  resolveModDepth
} = await import(
  pathToFileURL(path.join(TMP_TEST_BUILD, 'src/dsp/math.mjs')).href
);

// Clean up on exit
process.on('exit', () => {
  fs.rmSync(TMP_TEST_BUILD, { recursive: true, force: true });
});

console.log('=== RUNNING EP-2350 FULL COMPREHENSIVE TEST SUITE ===\n');

// ---------------------------------------------------------------------------
// SUITE 1: Official Teenage Engineering Preset Packs Lossless Round-Trip
// ---------------------------------------------------------------------------
assert.strictEqual(OFFICIAL_TE_PACKS.length, 3, 'Must have 3 official preset packs');
const officialPackFiles = [
  'packs/ep-2350_preset_pack-broken_radio/config.json',
  'packs/ep-2350_preset_pack-dub/config.json',
  'packs/ep-2350_preset_pack-mysterious/config.json'
];

for (const relPackPath of officialPackFiles) {
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

const delayTimeParam = EFFECTS_REGISTRY.DELAY.params.find((p) => p.name === 'time');
assert.strictEqual(delayTimeParam.max, 1.2, 'DELAY.time max must be 1.2s');

// Native units
assert.strictEqual(getModDepthConfig('SSB', 'frequency').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('SSB', 'frequency').unit, 'Hz');
assert.strictEqual(getModDepthConfig('RING', 'frequency').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('HARMONY', 'pitch').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('HARMONY', 'pitch').unit, 'x');
assert.strictEqual(getModDepthConfig('DELAY', 'time').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('DELAY', 'time').unit, 's');
assert.strictEqual(getModDepthConfig('SAMPLE', 'pitch').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('SAMPLE', 'speed').isNormalizedPercent, false);
assert.strictEqual(getModDepthConfig('DIST', 'amount').isNormalizedPercent, false);

// Percentage units
assert.strictEqual(getModDepthConfig('LOWPASS', 'cutoff').isNormalizedPercent, true);
assert.strictEqual(getModDepthConfig('DIST', 'mix').isNormalizedPercent, true);
assert.strictEqual(getModDepthConfig('DELAY', 'echo').isNormalizedPercent, true);
assert.strictEqual(getModDepthConfig('REVERB', 'time').isNormalizedPercent, true);
assert.strictEqual(getModDepthConfig('BALANCE', 'balance').isNormalizedPercent, true);

assert.strictEqual(isPercentParam('LOWPASS', 'cutoff'), false);
assert.strictEqual(isPercentParam('DIST', 'mix'), true);
console.log('✓ Suite 2: Effects Registry & Modulation Depth units verified');

// ---------------------------------------------------------------------------
// SUITE 3: Validator Constraints & Out-of-Bounds Checks
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
        { id: '2', effect: 'DELAY', time: 0.2 },
        { id: '3', effect: 'HARMONY', pitch: 1.2 },
        { id: '4', effect: 'HARMONY', pitch: 0.8 }
      ],
      handle: { row: 9, param: 'cutoff', depth: 50 },
      shake: { row: -1, param: 'mix', depth: 50 },
      lfo: { row: 8, param: 'cutoff', depth: 50, shape: 'sine', speed: 2 }
    }
  ]
};

const issues = validatePackConfig(invalidPack);
assert.ok(issues.some((i) => i.type === 'warning' && i.message.includes('Pack name is empty')));
assert.ok(issues.some((i) => i.type === 'warning' && i.message.includes('Missing')));
assert.ok(issues.some((i) => i.type === 'error' && i.message.includes("'DELAY' can only be used once")));
assert.ok(issues.some((i) => i.type === 'error' && i.message.includes("'HARMONY' can only be used once")));
assert.ok(issues.some((i) => i.type === 'error' && i.message.includes('Handle targets row 9')));
assert.ok(issues.some((i) => i.type === 'error' && i.message.includes('Shake targets row -1')));
assert.ok(issues.some((i) => i.type === 'error' && i.message.includes('LFO targets row 8')));
console.log('✓ Suite 3: Validator constraints & out-of-bounds modulation checks verified');

// ---------------------------------------------------------------------------
// SUITE 4: Parser Resilience, Custom Samples, Parallel Buses & Bipolar Depths
// ---------------------------------------------------------------------------
assert.ok(parseConfigJson('not-valid-json').error, 'Malformed JSON must return error');
assert.ok(parseConfigJson('null').error, 'Non-object JSON root must return error');

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
// SUITE 5: Pure DSP Math Functions (src/dsp/math.ts)
// ---------------------------------------------------------------------------
// 5a. Cutoff mapping
assert.strictEqual(cutoffToHz(0), 20);
assert.ok(Math.abs(cutoffToHz(1) - 20000) < 1e-4);
assert.ok(Math.abs(cutoffToHz(0.5) - 20 * Math.sqrt(1000)) < 1e-4);

// 5b. resolveModDepth (Verifies bug fix where 1% was misidentified as 100%)
assert.ok(Math.abs(resolveModDepth('LOWPASS', 'cutoff', 1) - 0.01) < 1e-6, '1% cutoff depth must equal 0.01 ratio');
assert.strictEqual(resolveModDepth('LOWPASS', 'cutoff', 50), 0.5);
assert.strictEqual(resolveModDepth('DIST', 'mix', -100), -1);
assert.strictEqual(resolveModDepth('SSB', 'frequency', 1000), 1000);
assert.strictEqual(resolveModDepth('DELAY', 'time', 0.005), 0.005);
assert.strictEqual(resolveModDepth('HARMONY', 'pitch', -0.5), -0.5);

// 5c. LFO shapes
assert.ok(Math.abs(computeLfoWave('sine', 0, 1) - 0) < 1e-6);
assert.ok(Math.abs(computeLfoWave('sine', 0.25, 1) - 1) < 1e-6);
assert.strictEqual(computeLfoWave('square', 0.1, 10), 1);
assert.strictEqual(computeLfoWave('square', 0.06, 10), -1);
assert.ok(Math.abs(computeLfoWave('sawtooth', 0.25, 1) - 0.5) < 1e-6);
const randVal = computeLfoWave('random', 1.2, 2);
assert.strictEqual(randVal, computeLfoWave('random', 1.4, 2));

// 5d. Waveshaper curves
const distCurve = makeDistortionCurve(0, 1000);
// i=500 is exactly x=0
assert.strictEqual(distCurve[500], 0, 'Zero-crossing at x=0 must be exactly 0');
assert.ok(distCurve[750] / 0.5 > distCurve[999] / 1.0, 'amount: 0 must have warm saturation curve');
const clipCurve = makeSoftClipCurve(512);
assert.ok(Math.max(...clipCurve) <= Math.tanh(1.4) + 1e-6);

// 5e. Hann window partition of unity
for (let p = 0; p < 1; p += 0.05) {
  assert.ok(Math.abs(hann(p) + hann((p + 0.5) % 1) - 1.0) < 1e-12);
}
console.log('✓ Suite 5: Pure DSP Math functions verified (cutoff, resolveModDepth, LFO shapes, waveshapers)');

// ---------------------------------------------------------------------------
// SUITE 6: PitchShiftKernel Constant Speed & Accurate Pitch Shifting
// ---------------------------------------------------------------------------
const sampleRate = 48000;
const durationSamples = 48000;
const baseFreq = 220;
const sine220 = new Float32Array(durationSamples);
for (let i = 0; i < durationSamples; i++) {
  sine220[i] = Math.sin((2 * Math.PI * baseFreq * i) / sampleRate);
}

function runShifter(signal, pitch) {
  const kernel = new PitchShiftKernel(pitch);
  const out = new Float32Array(signal.length);
  const blockSize = 512;
  for (let i = 0; i < signal.length; i += blockSize) {
    kernel.process(signal.subarray(i, i + blockSize), out.subarray(i, i + blockSize));
  }
  return out;
}

// Bit-transparent at unity
const out1x = runShifter(sine220, 1.0);
assert.strictEqual(out1x.length, durationSamples);
for (let i = 0; i < durationSamples; i++) {
  assert.ok(Math.abs(out1x[i] - sine220[i]) < 1e-6, 'Unity pitch must be bit-transparent');
}

function estimateFundamentalHz(signal, sr) {
  const windowLen = 1024;
  const minLag = Math.floor(sr / 800);
  const maxLag = Math.floor(sr / 60);
  const acc = new Float64Array(maxLag + 1);
  for (let f = Math.floor(sr * 0.2); f + windowLen + maxLag < signal.length; f += 512) {
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
  return sr / bestLag;
}

const out2x = runShifter(sine220, 2.0);
const outHalf = runShifter(sine220, 0.5);
assert.strictEqual(out2x.length, durationSamples, 'Duration must remain 1.0x at 2.0x pitch');
assert.strictEqual(outHalf.length, durationSamples, 'Duration must remain 1.0x at 0.5x pitch');

const hz2x = estimateFundamentalHz(out2x, sampleRate);
const hzHalf = estimateFundamentalHz(outHalf, sampleRate);

assert.ok(Math.abs(hz2x - 440) < 10, `2.0x pitch of 220Hz should be ~440Hz (got ${hz2x.toFixed(1)}Hz)`);
assert.ok(Math.abs(hzHalf - 110) < 5, `0.5x pitch of 220Hz should be ~110Hz (got ${hzHalf.toFixed(1)}Hz)`);
console.log(
  `✓ Suite 6: PitchShiftKernel verified (220Hz -> 0.5x=${hzHalf.toFixed(1)}Hz, 2.0x=${hz2x.toFixed(1)}Hz at constant speed)`
);

// -----------------------------------------------------------------------------
// Suite 7: UX Behavior Verification (Lever Defaults to Pressed & Cartoon Shake)
// -----------------------------------------------------------------------------
const micDeviceSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/MicDevice.tsx'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf8');
const themeCss = fs.readFileSync(path.join(ROOT_DIR, 'src/styles/te-theme.css'), 'utf8');

// 1. Lever defaults to fully pressed (1.0) in App.tsx
assert.ok(
  appSrc.includes('const [handlePos, setHandlePos] = useState<number>(1.0);'),
  'handlePos must initialize to 1.0 (fully pressed by default)'
);

// 2. MicDevice maintains stationary main mic without image flicking
assert.ok(
  !micDeviceSrc.includes('isShakingFlash ? \'scale-[1.02] -rotate-1\' : \'\''),
  'Main mic container must not scale or rotate when shaking or clicking buttons'
);

// 3. Cartoon shake afterimages & orange motion arrows exist in SVG and CSS
assert.ok(
  themeCss.includes('cartoonShakeGhost1') && themeCss.includes('cartoonShakeGhost2'),
  'CSS keyframes must define cartoonShakeGhost1 and cartoonShakeGhost2'
);
assert.ok(
  micDeviceSrc.includes('cartoonShakeGhost1') && micDeviceSrc.includes('cartoonShakeGhost2'),
  'MicDevice must render ghost afterimages during cartoon shake'
);
assert.ok(
  micDeviceSrc.includes('Top-Right Curved Motion Arrow') && micDeviceSrc.includes('Bottom-Left Curved Motion Arrow'),
  'MicDevice must render cartoon orange motion curve arrows matching the design'
);

// 4. Shake is triggered on bottom part of the mic, NOT on faceplate or buttons
assert.ok(
  micDeviceSrc.includes('Click bottom of mic to SHAKE'),
  'Shake must be triggered on the bottom part of the mic'
);
assert.ok(
  micDeviceSrc.includes('stopPropagation') && !micDeviceSrc.includes('onClick={triggerShakeWithFlash}'),
  'Buttons and faceplate must not trigger shake'
);

console.log('✓ Suite 7: UX Lever default pressed & Cartoon Shake afterimages verified');

console.log('\n=== ALL 7 PRODUCTION TEST SUITES PASSED (100%) ===');
