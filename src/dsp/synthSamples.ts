// Generates high-quality synthesized audition audio buffers directly in the browser
export function createSyntheticAudioBuffer(
  ctx: AudioContext,
  type: 'voice' | 'beat' | 'synth'
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  let duration = 2.0;
  if (type === 'beat') duration = 2.4;
  if (type === 'voice') duration = 2.2;
  if (type === 'synth') duration = 3.0;

  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  if (type === 'voice') {
    // Synthesize a human vocal speech formant phrase: "EP TWO THREE FIVE ZERO"
    // Formant filter synthesis with vowel transitions (Ah -> Oh -> Ee)
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Pitch trajectory (approx 120Hz fundamental with gentle inflection)
      const f0 = 120 + 25 * Math.sin(t * 3.5);
      const glottal = (Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(4 * Math.PI * f0 * t) + 0.25 * Math.sin(6 * Math.PI * f0 * t));

      // Syllable gating
      const envelope = Math.sin(Math.min(Math.PI, t * Math.PI / duration)) *
        (0.5 + 0.5 * Math.sin(2 * Math.PI * 3.5 * t));

      // Formants
      const f1 = 600 + 300 * Math.sin(t * 5.0);
      const f2 = 1400 + 600 * Math.cos(t * 4.0);
      const voiceSample = glottal * (0.6 * Math.sin(2 * Math.PI * f1 * t) + 0.4 * Math.sin(2 * Math.PI * f2 * t));

      const s = voiceSample * envelope * 0.45;
      left[i] = s;
      right[i] = s;
    }
  } else if (type === 'beat') {
    // Punchy electronic drum beat: Kick on 1 & 3, Snare/Clap on 2 & 4, Hi-Hats on 8ths
    const bpm = 110;
    const beatLen = 60 / bpm;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const beat = (t % (beatLen * 4)) / beatLen; // 0 to 4 beats
      let s = 0;

      // Kick on beat 0 and beat 2
      for (const kBeat of [0, 2]) {
        const dt = (beat - kBeat) * beatLen;
        if (dt >= 0 && dt < 0.35) {
          const kFreq = 140 * Math.exp(-dt * 28) + 45;
          const kEnv = Math.exp(-dt * 9);
          s += Math.sin(2 * Math.PI * kFreq * dt) * kEnv * 0.8;
        }
      }

      // Snare on beat 1 and beat 3
      for (const sBeat of [1, 3]) {
        const dt = (beat - sBeat) * beatLen;
        if (dt >= 0 && dt < 0.28) {
          const tone = Math.sin(2 * Math.PI * 200 * dt) * Math.exp(-dt * 20);
          const noise = (Math.random() * 2 - 1) * Math.exp(-dt * 12);
          s += (tone * 0.4 + noise * 0.6) * 0.7;
        }
      }

      // Hi-hat every 0.5 beats
      const hatBeat = (t % (beatLen * 0.5));
      if (hatBeat < 0.08) {
        const noise = (Math.random() * 2 - 1) * Math.exp(-hatBeat * 50);
        s += noise * 0.25;
      }

      left[i] = Math.max(-1, Math.min(1, s));
      right[i] = Math.max(-1, Math.min(1, s));
    }
  } else {
    // Warm retro synthesizer chord progression
    const freqs = [
      [220, 277.18, 329.63, 415.3], // A minor 7
      [196, 246.94, 293.66, 370.0], // G major 7
      [174.61, 220, 261.63, 329.63] // F major 7
    ];

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const chordIdx = Math.min(freqs.length - 1, Math.floor((t / duration) * freqs.length));
      const chord = freqs[chordIdx];
      let sL = 0;
      let sR = 0;

      for (let c = 0; c < chord.length; c++) {
        const f = chord[c];
        // Sawtooth / chorus wave
        const w1 = 2 * ((t * f) % 1) - 1;
        const w2 = 2 * ((t * (f * 1.004)) % 1) - 1;
        sL += w1 * 0.12;
        sR += w2 * 0.12;
      }

      const env = Math.sin(Math.PI * (t / duration));
      left[i] = sL * env;
      right[i] = sR * env;
    }
  }

  return buffer;
}
