import { AnyEffect, PresetConfig } from '../types/config';
import { createSyntheticAudioBuffer } from './synthSamples';
import defaultSpeechUrl from '../assets/speech.mp3';

export interface ModulationState {
  handlePos: number; // 0.0 to 1.0
  shakeAmount: number; // 0.0 to 1.0 (transient decay)
  lfoPhase: number;
}

export class DspAudioEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private currentBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainMaster: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private loopSource: boolean = true;
  private lfoRafId: number | null = null;

  // Active preset & modulation
  private preset: PresetConfig | null = null;
  private modState: ModulationState = {
    handlePos: 0.0,
    shakeAmount: 0.0,
    lfoPhase: 0.0
  };

  // Node references for live parameter updating
  private activeNodes: Array<{
    effectType: string;
    params: Record<string, any>;
    nodeRefs: Record<string, any>;
  }> = [];

  constructor() {}

  public async init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.gainMaster = this.ctx.createGain();
      this.gainMaster.gain.value = 0.85;

      this.analyserNode = this.ctx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.gainMaster.connect(this.analyserNode);
      this.analyserNode.connect(this.ctx.destination);

      // Default sample: Clean spoken speech sample ("The quick brown fox jumps over the lazy dog")
      try {
        const res = await fetch(defaultSpeechUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          this.currentBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        } else {
          this.currentBuffer = createSyntheticAudioBuffer(this.ctx, 'voice');
        }
      } catch {
        this.currentBuffer = createSyntheticAudioBuffer(this.ctx, 'voice');
      }
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public setSampleType(type: 'voice' | 'beat' | 'synth') {
    if (!this.ctx) return;
    this.currentBuffer = createSyntheticAudioBuffer(this.ctx, type);
    if (this.isRunning) {
      this.restartPlayback();
    }
  }

  public async loadCustomAudioFile(file: File) {
    if (!this.ctx) await this.init();
    if (!this.ctx) return;
    const arrayBuffer = await file.arrayBuffer();
    this.currentBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    if (this.isRunning) {
      this.restartPlayback();
    }
  }

  public updatePreset(preset: PresetConfig) {
    this.preset = preset;
    if (this.isRunning) {
      this.rebuildChain();
    }
  }

  public updateModulation(mod: Partial<ModulationState>) {
    this.modState = { ...this.modState, ...mod };
    this.applyLiveModulation();
  }

  public triggerShake(impulse: number = 1.0) {
    this.modState.shakeAmount = impulse;
    this.applyLiveModulation();

    // Decay shake over 450ms
    const start = performance.now();
    const decay = () => {
      const elapsed = (performance.now() - start) / 450;
      if (elapsed < 1.0) {
        this.modState.shakeAmount = impulse * (1.0 - elapsed);
        this.applyLiveModulation();
        requestAnimationFrame(decay);
      } else {
        this.modState.shakeAmount = 0.0;
        this.applyLiveModulation();
      }
    };
    requestAnimationFrame(decay);
  }

  private startModulationLoop() {
    this.stopModulationLoop();
    const tick = () => {
      if (!this.isRunning) return;
      this.applyLiveModulation();
      this.lfoRafId = requestAnimationFrame(tick);
    };
    this.lfoRafId = requestAnimationFrame(tick);
  }

  private stopModulationLoop() {
    if (this.lfoRafId !== null) {
      cancelAnimationFrame(this.lfoRafId);
      this.lfoRafId = null;
    }
  }

  public async start() {
    await this.init();
    if (!this.ctx) return;
    this.isRunning = true;
    this.rebuildChain();
    this.startModulationLoop();
  }

  public stop() {
    this.isRunning = false;
    this.stopModulationLoop();
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }
  }

  public togglePlay(): boolean {
    if (this.isRunning) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private restartPlayback() {
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  private rebuildChain() {
    if (!this.ctx || !this.currentBuffer || !this.gainMaster) return;

    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    this.activeNodes = [];

    // Create source
    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.currentBuffer;
    this.sourceNode.loop = this.loopSource;

    const bus1Effects: Array<{ fx: AnyEffect; idx: number }> = [];
    const bus2Effects: Array<{ fx: AnyEffect; idx: number }> = [];

    if (this.preset && this.preset.list.length > 0) {
      this.preset.list.forEach((fx, rowIdx) => {
        if (fx.BUS === 2) {
          bus2Effects.push({ fx, idx: rowIdx });
        } else {
          bus1Effects.push({ fx, idx: rowIdx });
        }
      });
    }

    // Master summing node before master gain
    const busSummer = this.ctx.createGain();
    busSummer.gain.value = 1.0;

    // 1. Process Bus 1 (Primary parallel branch)
    let bus1Head: AudioNode = this.sourceNode;
    bus1Effects.forEach(({ fx, idx }) => {
      const built = this.buildEffectNodes(fx, idx);
      if (built) {
        bus1Head.connect(built.input);
        bus1Head = built.output;
        this.activeNodes.push({
          effectType: fx.effect,
          params: { ...fx },
          nodeRefs: built.nodeRefs
        });
      }
    });
    bus1Head.connect(busSummer);

    // 2. Process Bus 2 (Secondary parallel branch)
    if (bus2Effects.length > 0) {
      let bus2Head: AudioNode = this.sourceNode;
      bus2Effects.forEach(({ fx, idx }) => {
        const built = this.buildEffectNodes(fx, idx);
        if (built) {
          bus2Head.connect(built.input);
          bus2Head = built.output;
          this.activeNodes.push({
            effectType: fx.effect,
            params: { ...fx },
            nodeRefs: built.nodeRefs
          });
        }
      });
      bus2Head.connect(busSummer);
    }

    busSummer.connect(this.gainMaster);
    this.applyLiveModulation();
    this.sourceNode.start(0);
  }

  private buildEffectNodes(
    fx: AnyEffect,
    rowIdx: number
  ): { input: AudioNode; output: AudioNode; nodeRefs: Record<string, any> } | null {
    if (!this.ctx) return null;

    const ctx = this.ctx;
    const toRatio = (v: number | undefined, defaultVal: number) =>
      typeof v === 'number' ? (v > 1 ? v / 100 : v) : defaultVal;

    switch (fx.effect) {
      case 'LOWPASS': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 2.0;
        const cutoff = toRatio(fx.cutoff, 1.0);
        filter.frequency.value = 20 * Math.pow(1000, cutoff);
        return { input: filter, output: filter, nodeRefs: { filter, rowIdx } };
      }

      case 'HIGHPASS': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.Q.value = 2.0;
        const cutoff = toRatio(fx.cutoff, 0.0);
        filter.frequency.value = 20 * Math.pow(1000, cutoff);
        return { input: filter, output: filter, nodeRefs: { filter, rowIdx } };
      }

      case 'EQUALISER': {
        const eq = ctx.createBiquadFilter();
        eq.type = 'peaking';
        const cutoff = typeof fx.CUTOFF === 'number' ? fx.CUTOFF : 0.5;
        eq.frequency.value = 20 * Math.pow(1000, cutoff);
        const q = typeof fx.Q === 'number' ? fx.Q : 0.7;
        eq.Q.value = Math.max(0.1, q * 10);
        const gain = typeof fx.GAIN === 'number' ? fx.GAIN : 0.0;
        eq.gain.value = gain * 15;
        return { input: eq, output: eq, nodeRefs: { eq, rowIdx } };
      }

      case 'DIST': {
        // Distortion with Waveshaper + Pre/Post Tone Filters + Mix
        // Even at amount: 0.0 (e.g. DEEP TRAP), base saturation is active when mix > 0
        const inputGain = ctx.createGain();
        const outputGain = ctx.createGain();

        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const shaper = ctx.createWaveShaper();

        const lpTone = ctx.createBiquadFilter();
        lpTone.type = 'lowpass';
        const hpTone = ctx.createBiquadFilter();
        hpTone.type = 'highpass';

        const mix = toRatio(fx.mix, 0.5);
        dryGain.gain.value = 1.0 - mix;
        wetGain.gain.value = mix;

        const amount = typeof fx.amount === 'number' ? fx.amount : 10.0;
        shaper.curve = this.makeDistortionCurve(amount) as any;
        shaper.oversample = '4x';

        const lp = toRatio(fx['lowpass-cutoff'], 1.0);
        lpTone.frequency.value = 20 * Math.pow(1000, lp);
        const hp = toRatio(fx['highpass-cutoff'], 0.0);
        hpTone.frequency.value = 20 * Math.pow(1000, hp);

        inputGain.connect(dryGain);
        inputGain.connect(hpTone);
        hpTone.connect(shaper);
        shaper.connect(lpTone);
        lpTone.connect(wetGain);

        dryGain.connect(outputGain);
        wetGain.connect(outputGain);

        return {
          input: inputGain,
          output: outputGain,
          nodeRefs: { dryGain, wetGain, shaper, lpTone, hpTone, rowIdx }
        };
      }

      case 'DELAY': {
        // Stereo/Dub Delay with up to 1.2s delay line, HP + LP damping in loop, and tape saturation for self-oscillation
        const input = ctx.createGain();
        const output = ctx.createGain();

        const delayNode = ctx.createDelay(2.0);
        const time = typeof fx.time === 'number' ? fx.time : 0.35;
        delayNode.delayTime.value = Math.max(0.01, Math.min(1.2, time));

        const feedbackGain = ctx.createGain();
        const echo = toRatio(fx.echo, 0.4);
        feedbackGain.gain.value = Math.min(1.15, echo);

        // Soft limiter inside feedback loop so echo > 1.0 (SPACE ECHO) self-oscillates warmly without clipping
        const tapeLimiter = ctx.createWaveShaper();
        tapeLimiter.curve = this.makeSoftClipCurve() as any;

        const lpFilter = ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        const lp = toRatio(fx['lowpass-cutoff'], 1.0);
        lpFilter.frequency.value = 20 * Math.pow(1000, lp);

        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        const hp = toRatio(fx['highpass-cutoff'], 0.0);
        hpFilter.frequency.value = 20 * Math.pow(1000, hp);

        const dryGain = ctx.createGain();
        dryGain.gain.value = toRatio(fx['dry-level'], 1.0);

        const wetGain = ctx.createGain();
        wetGain.gain.value = toRatio(fx['wet-level'], 0.5);

        // Connect delay loop: input -> delay -> hp -> lp -> tapeLimiter -> feedback -> delay
        input.connect(dryGain);
        dryGain.connect(output);

        input.connect(delayNode);
        delayNode.connect(hpFilter);
        hpFilter.connect(lpFilter);
        lpFilter.connect(tapeLimiter);
        tapeLimiter.connect(feedbackGain);
        feedbackGain.connect(delayNode);

        tapeLimiter.connect(wetGain);
        wetGain.connect(output);

        return {
          input,
          output,
          nodeRefs: { delayNode, feedbackGain, lpFilter, hpFilter, dryGain, wetGain, rowIdx }
        };
      }

      case 'REVERB': {
        // Algorithmic Reverb & Spring Tank with live-modulatable decay time and spring-mix
        const input = ctx.createGain();
        const output = ctx.createGain();

        const dryGain = ctx.createGain();
        dryGain.gain.value = toRatio(fx['dry-level'], 1.0);
        const wetGain = ctx.createGain();
        wetGain.gain.value = toRatio(fx['wet-level'], 0.5);

        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        const hp = toRatio(fx['highpass-cutoff'], 0.0);
        hpFilter.frequency.value = 20 * Math.pow(1000, hp);

        const combTimes = [0.029, 0.037, 0.043, 0.051];
        const combBaseGains = [0.82, 0.78, 0.74, 0.7];
        const timeScale = typeof fx.time === 'number' ? fx.time : 0.5;
        const springMix = toRatio(fx['spring-mix'], 0.0);

        const combSum = ctx.createGain();
        combSum.gain.value = 0.28 + springMix * 0.45;

        const combFeedbackGains: GainNode[] = [];
        const combDelays: DelayNode[] = [];

        combTimes.forEach((dTime, idx) => {
          const delay = ctx.createDelay(0.5);
          delay.delayTime.value = dTime * (0.6 + timeScale * 0.8);

          const fb = ctx.createGain();
          fb.gain.value = Math.min(0.95, combBaseGains[idx] * (0.6 + timeScale * 0.36));

          hpFilter.connect(delay);
          delay.connect(fb);
          fb.connect(delay);
          delay.connect(combSum);

          combDelays.push(delay);
          combFeedbackGains.push(fb);
        });

        input.connect(dryGain);
        dryGain.connect(output);

        input.connect(hpFilter);
        combSum.connect(wetGain);
        wetGain.connect(output);

        return {
          input,
          output,
          nodeRefs: {
            dryGain,
            wetGain,
            hpFilter,
            combSum,
            combFeedbackGains,
            combDelays,
            combTimes,
            combBaseGains,
            rowIdx
          }
        };
      }

      case 'RING': {
        const input = ctx.createGain();
        const output = ctx.createGain();

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const freq = typeof fx.frequency === 'number' ? fx.frequency : 440.0;
        osc.frequency.value = Math.max(1, freq);

        const ringGain = ctx.createGain();
        ringGain.gain.value = 0;
        osc.connect(ringGain.gain);
        osc.start();

        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const mix = toRatio(fx.mix, 0.5);
        dryGain.gain.value = 1.0 - mix;
        wetGain.gain.value = mix;

        input.connect(dryGain);
        dryGain.connect(output);

        input.connect(ringGain);
        ringGain.connect(wetGain);
        wetGain.connect(output);

        return {
          input,
          output,
          nodeRefs: { osc, dryGain, wetGain, rowIdx }
        };
      }

      case 'HARMONY': {
        // Vocal pitch shifter + dry-level vocal doubler
        // Blends unshifted dry vocal (dry-level) with pitch-shifted wet vocal (pitch 0.5..2.0)
        const input = ctx.createGain();
        const output = ctx.createGain();

        const dryGain = ctx.createGain();
        const dryLevel = toRatio(fx['dry-level'], 1.0);
        dryGain.gain.value = dryLevel;

        const wetGain = ctx.createGain();
        wetGain.gain.value = 1.0;

        // Dual-grain delay line pitch shifter for real-time pitch shifting while preserving dry vocal path
        const delayA = ctx.createDelay(0.2);
        const delayB = ctx.createDelay(0.2);
        const grainGainA = ctx.createGain();
        const grainGainB = ctx.createGain();

        delayA.delayTime.value = 0.03;
        delayB.delayTime.value = 0.06;
        grainGainA.gain.value = 0.5;
        grainGainB.gain.value = 0.5;

        input.connect(dryGain);
        dryGain.connect(output);

        input.connect(delayA);
        input.connect(delayB);
        delayA.connect(grainGainA);
        delayB.connect(grainGainB);
        grainGainA.connect(wetGain);
        grainGainB.connect(wetGain);
        wetGain.connect(output);

        // If dry-level is 0 (pure pitch shift like MANUAL PITCHER or HYPER POP), also drive source playbackRate for crisp formant shift
        const pitch = typeof fx.pitch === 'number' ? fx.pitch : 1.0;
        if (this.sourceNode && dryLevel < 0.05) {
          this.sourceNode.playbackRate.value = pitch;
        }

        return {
          input,
          output,
          nodeRefs: { dryGain, wetGain, delayA, delayB, grainGainA, grainGainB, rowIdx }
        };
      }

      case 'SAMPLE': {
        const gain = ctx.createGain();
        const level = toRatio(fx.level, 1.0);
        gain.gain.value = level;

        // Only apply SAMPLE speed/pitch to sourceNode if no HARMONY block is managing pitch
        const hasHarmony = this.preset?.list.some((item) => item.effect === 'HARMONY');
        if (this.sourceNode && !hasHarmony) {
          if (typeof fx.speed === 'number' && fx.speed > 0) {
            this.sourceNode.playbackRate.value = fx.speed;
          }
          if (typeof fx.pitch === 'number' && fx.pitch !== 0) {
            this.sourceNode.detune.value = fx.pitch * 100;
          }
        }
        return { input: gain, output: gain, nodeRefs: { gain, rowIdx } };
      }

      case 'SSB': {
        // Single Sideband frequency shift approximation
        const input = ctx.createGain();
        const output = ctx.createGain();

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const freq = typeof fx.frequency === 'number' ? fx.frequency : 0.0;
        osc.frequency.value = Math.max(1, Math.abs(freq));

        const modGain = ctx.createGain();
        modGain.gain.value = 0;
        osc.connect(modGain.gain);
        osc.start();

        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const isShifted = Math.abs(freq) > 1;
        dryGain.gain.value = isShifted ? 0.25 : 1.0;
        wetGain.gain.value = isShifted ? 0.75 : 0.0;

        input.connect(dryGain);
        dryGain.connect(output);

        input.connect(modGain);
        modGain.connect(wetGain);
        wetGain.connect(output);

        return { input, output, nodeRefs: { osc, dryGain, wetGain, rowIdx } };
      }

      case 'BALANCE': {
        const input = ctx.createGain();
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
        const chopperGain = ctx.createGain();
        const bal = typeof fx.balance === 'number' ? fx.balance : 0.5;
        if ('pan' in panner) {
          panner.pan.value = (bal - 0.5) * 2;
        }
        input.connect(panner);
        panner.connect(chopperGain);
        return { input, output: chopperGain, nodeRefs: { panner, chopperGain, rowIdx } };
      }

      default: {
        const pass = ctx.createGain();
        return { input: pass, output: pass, nodeRefs: { rowIdx } };
      }
    }
  }

  private computeLfoWave(shape: string, time: number, speed: number): number {
    const phase = (time * speed) % 1.0;
    if (shape === 'square') {
      return phase < 0.5 ? 1 : -1;
    } else if (shape === 'sawtooth') {
      return 2 * (phase - Math.floor(phase + 0.5));
    } else if (shape === 'random') {
      // Sample-and-hold deterministic pseudo-random step per cycle
      const stepIndex = Math.floor(time * speed);
      const x = Math.sin(stepIndex * 12.9898 + 78.233) * 43758.5453;
      return (x - Math.floor(x)) * 2 - 1;
    }
    return Math.sin(phase * 2 * Math.PI);
  }

  private applyLiveModulation() {
    if (!this.preset || !this.ctx) return;
    const ctx = this.ctx;

    const handle = this.preset.handle;
    const shake = this.preset.shake;
    const lfo = this.preset.lfo;

    // Calculate dynamic LFO speed if handle is assigned to accelerate LFO
    let effectiveLfoSpeed = lfo?.speed ?? 2.0;
    if (handle && handle.target === 'lfo') {
      effectiveLfoSpeed = Math.max(0.1, effectiveLfoSpeed + this.modState.handlePos * (handle.depth || 10.0));
    }

    const lfoWave = lfo ? this.computeLfoWave(lfo.shape || 'sine', ctx.currentTime, effectiveLfoSpeed) : 0;

    this.activeNodes.forEach(({ effectType, params, nodeRefs }) => {
      const rowIdx = nodeRefs.rowIdx;

      // Normalized [-1..1] deltas for [0..1] parameters
      let handleDelta = 0;
      if (handle && handle.target !== 'lfo' && handle.row === rowIdx) {
        const depthRatio = Math.abs(handle.depth) > 1.5 ? handle.depth / 100 : handle.depth;
        handleDelta = this.modState.handlePos * depthRatio;
      }

      let shakeDelta = 0;
      if (shake && shake.row === rowIdx) {
        const depthRatio = Math.abs(shake.depth) > 1.5 ? shake.depth / 100 : shake.depth;
        shakeDelta = this.modState.shakeAmount * depthRatio;
      }

      let lfoDelta = 0;
      if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx) {
        const depthRatio = Math.abs(lfo.depth) > 1.5 ? lfo.depth / 100 : lfo.depth;
        lfoDelta = lfoWave * depthRatio;
      }

      const toRatio = (v: number | undefined, defaultVal: number) =>
        typeof v === 'number' ? (v > 1 ? v / 100 : v) : defaultVal;

      if (effectType === 'LOWPASS' || effectType === 'HIGHPASS') {
        const baseCutoff = toRatio(params.cutoff, effectType === 'LOWPASS' ? 1.0 : 0.0);
        let moddedCutoff = baseCutoff;
        if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'cutoff') moddedCutoff += handleDelta;
        if (shake && shake.row === rowIdx && shake.param === 'cutoff') moddedCutoff += shakeDelta;
        if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'cutoff') moddedCutoff += lfoDelta;
        moddedCutoff = Math.max(0.0, Math.min(1.0, moddedCutoff));

        const hz = 20 * Math.pow(1000, moddedCutoff);
        if (nodeRefs.filter) {
          nodeRefs.filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.015);
        }
      } else if (effectType === 'DIST') {
        if (nodeRefs.wetGain && nodeRefs.dryGain) {
          const baseMix = toRatio(params.mix, 0.5);
          let delta = 0;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'mix') delta += handleDelta;
          if (shake && shake.row === rowIdx && shake.param === 'mix') delta += shakeDelta;
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'mix') delta += lfoDelta;
          const mix = Math.max(0.0, Math.min(1.0, baseMix + delta));
          nodeRefs.wetGain.gain.setTargetAtTime(mix, ctx.currentTime, 0.015);
          nodeRefs.dryGain.gain.setTargetAtTime(1.0 - mix, ctx.currentTime, 0.015);
        }
      } else if (effectType === 'DELAY') {
        if (nodeRefs.feedbackGain) {
          const baseEcho = toRatio(params.echo, 0.4);
          let delta = 0;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'echo') delta += handleDelta;
          if (shake && shake.row === rowIdx && shake.param === 'echo') delta += shakeDelta;
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'echo') delta += lfoDelta;
          // Allow up to 1.18 when modulated past 1.0 so SPACE ECHO self-oscillates through tapeLimiter
          const echo = Math.max(0.0, Math.min(1.18, baseEcho + delta));
          nodeRefs.feedbackGain.gain.setTargetAtTime(echo, ctx.currentTime, 0.02);
        }
        if (nodeRefs.delayNode) {
          const baseTime = typeof params.time === 'number' ? params.time : 0.35;
          let delta = 0;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'time') delta += handleDelta;
          if (shake && shake.row === rowIdx && shake.param === 'time') delta += shakeDelta;
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'time') delta += lfoDelta;
          const dTime = Math.max(0.01, Math.min(1.2, baseTime + delta));
          nodeRefs.delayNode.delayTime.setTargetAtTime(dTime, ctx.currentTime, 0.03);
        }
        if (nodeRefs.wetGain) {
          const baseWet = toRatio(params['wet-level'], 0.5);
          let delta = 0;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'wet-level') delta += handleDelta;
          if (shake && shake.row === rowIdx && shake.param === 'wet-level') delta += shakeDelta;
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'wet-level') delta += lfoDelta;
          nodeRefs.wetGain.gain.setTargetAtTime(Math.max(0.0, Math.min(1.0, baseWet + delta)), ctx.currentTime, 0.02);
        }
      } else if (effectType === 'HARMONY') {
        const basePitch = typeof params.pitch === 'number' ? params.pitch : 1.0;
        const dryLevel = toRatio(params['dry-level'], 1.0);
        let moddedPitch = basePitch;

        if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'pitch') {
          moddedPitch += this.modState.handlePos * (typeof handle.depth === 'number' ? handle.depth : 0.5);
        }
        if (shake && shake.row === rowIdx && shake.param === 'pitch') {
          moddedPitch += this.modState.shakeAmount * (typeof shake.depth === 'number' ? shake.depth : -0.2);
        }
        if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'pitch') {
          moddedPitch += lfoWave * (typeof lfo.depth === 'number' ? lfo.depth : 0.1);
        }
        moddedPitch = Math.max(0.5, Math.min(2.0, moddedPitch));

        if (dryLevel < 0.05 && this.sourceNode) {
          // Pure pitch shift (MANUAL PITCHER, HYPER POP)
          this.sourceNode.playbackRate.setTargetAtTime(moddedPitch, ctx.currentTime, 0.015);
          if (nodeRefs.wetGain) nodeRefs.wetGain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.015);
        } else if (nodeRefs.delayA && nodeRefs.delayB && nodeRefs.grainGainA && nodeRefs.grainGainB) {
          // Dual-grain real-time pitch shift blended with unshifted dry vocal (DEEP TRAP, ALIEN TUNE, RIDDIM WARP)
          if (this.sourceNode) {
            this.sourceNode.playbackRate.setTargetAtTime(1.0, ctx.currentTime, 0.015);
          }
          const windowSec = 0.055;
          const rate = (1.0 - moddedPitch) / windowSec;
          const t = ctx.currentTime * Math.abs(rate || 0.5);
          const phaseA = ((t % 1.0) + 1.0) % 1.0;
          const phaseB = (phaseA + 0.5) % 1.0;

          const dA = rate >= 0 ? phaseA * windowSec : (1.0 - phaseA) * windowSec;
          const dB = rate >= 0 ? phaseB * windowSec : (1.0 - phaseB) * windowSec;

          // Hann window envelope per grain
          const envA = 0.5 * (1 - Math.cos(2 * Math.PI * phaseA));
          const envB = 0.5 * (1 - Math.cos(2 * Math.PI * phaseB));

          nodeRefs.delayA.delayTime.setTargetAtTime(0.005 + dA, ctx.currentTime, 0.008);
          nodeRefs.delayB.delayTime.setTargetAtTime(0.005 + dB, ctx.currentTime, 0.008);
          nodeRefs.grainGainA.gain.setTargetAtTime(envA, ctx.currentTime, 0.008);
          nodeRefs.grainGainB.gain.setTargetAtTime(envB, ctx.currentTime, 0.008);
        }
      } else if (effectType === 'RING' || effectType === 'SSB') {
        if (nodeRefs.osc) {
          const baseFreq = typeof params.frequency === 'number' ? params.frequency : (effectType === 'RING' ? 440.0 : 0.0);
          let moddedFreq = baseFreq;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'frequency') {
            moddedFreq += this.modState.handlePos * (typeof handle.depth === 'number' ? handle.depth : 500.0);
          }
          if (shake && shake.row === rowIdx && shake.param === 'frequency') {
            moddedFreq += this.modState.shakeAmount * (typeof shake.depth === 'number' ? shake.depth : 200.0);
          }
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'frequency') {
            const rawDepth = typeof lfo.depth === 'number' ? lfo.depth : 50.0;
            moddedFreq += lfoWave * rawDepth;
          }
          nodeRefs.osc.frequency.setTargetAtTime(Math.max(1, Math.abs(moddedFreq)), ctx.currentTime, 0.015);
          if (effectType === 'SSB' && nodeRefs.dryGain && nodeRefs.wetGain) {
            const active = Math.abs(moddedFreq) > 2;
            nodeRefs.dryGain.gain.setTargetAtTime(active ? 0.25 : 1.0, ctx.currentTime, 0.015);
            nodeRefs.wetGain.gain.setTargetAtTime(active ? 0.75 : 0.0, ctx.currentTime, 0.015);
          }
        }
      } else if (effectType === 'REVERB') {
        if (nodeRefs.wetGain) {
          const baseWet = toRatio(params['wet-level'], 0.5);
          let delta = 0;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'wet-level') delta += handleDelta;
          if (shake && shake.row === rowIdx && shake.param === 'wet-level') delta += shakeDelta;
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'wet-level') delta += lfoDelta;
          nodeRefs.wetGain.gain.setTargetAtTime(Math.max(0.0, Math.min(1.0, baseWet + delta)), ctx.currentTime, 0.02);
        }
        if (nodeRefs.dryGain) {
          const baseDry = toRatio(params['dry-level'], 1.0);
          let delta = 0;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'dry-level') delta += handleDelta;
          if (shake && shake.row === rowIdx && shake.param === 'dry-level') delta += shakeDelta;
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'dry-level') delta += lfoDelta;
          nodeRefs.dryGain.gain.setTargetAtTime(Math.max(0.0, Math.min(1.0, baseDry + delta)), ctx.currentTime, 0.02);
        }
        if (nodeRefs.combFeedbackGains && nodeRefs.combBaseGains) {
          const baseTime = typeof params.time === 'number' ? params.time : 0.5;
          let delta = 0;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'time') delta += handleDelta;
          if (shake && shake.row === rowIdx && shake.param === 'time') delta += shakeDelta;
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'time') delta += lfoDelta;
          const timeScale = Math.max(0.0, Math.min(1.0, baseTime + delta));
          nodeRefs.combFeedbackGains.forEach((fb: GainNode, idx: number) => {
            const g = Math.min(0.96, nodeRefs.combBaseGains[idx] * (0.6 + timeScale * 0.36));
            fb.gain.setTargetAtTime(g, ctx.currentTime, 0.02);
          });
        }
        if (nodeRefs.combSum) {
          const baseSpring = toRatio(params['spring-mix'], 0.0);
          let delta = 0;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'spring-mix') delta += handleDelta;
          if (shake && shake.row === rowIdx && shake.param === 'spring-mix') delta += shakeDelta;
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'spring-mix') delta += lfoDelta;
          const spring = Math.max(0.0, Math.min(1.0, baseSpring + delta));
          nodeRefs.combSum.gain.setTargetAtTime(0.28 + spring * 0.55, ctx.currentTime, 0.02);
        }
      } else if (effectType === 'BALANCE') {
        const baseBal = typeof params.balance === 'number' ? params.balance : 0.5;
        let delta = 0;
        if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'balance') delta += handleDelta;
        if (shake && shake.row === rowIdx && shake.param === 'balance') delta += shakeDelta;
        if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'balance') delta += lfoDelta;
        const rawBal = baseBal + delta;
        const bal = Math.max(0.0, Math.min(1.0, rawBal));
        if (nodeRefs.panner && 'pan' in nodeRefs.panner) {
          nodeRefs.panner.pan.setTargetAtTime((bal - 0.5) * 2, ctx.currentTime, 0.01);
        }
        // When LFO square-modulates balance across extremes (like LOSING SIGNAL), impart choppy gate pulse
        if (nodeRefs.chopperGain) {
          const isChopped = lfo && lfo.row === rowIdx && lfo.param === 'balance' && lfoWave < 0;
          nodeRefs.chopperGain.gain.setTargetAtTime(isChopped ? 0.18 : 1.0, ctx.currentTime, 0.008);
        }
      }
    });
  }

  private makeDistortionCurve(amount: number): Float32Array {
    // Even at amount = 0.0 (used in DEEP TRAP), base saturation k = 12 provides gritty overdrive when mix > 0
    const k = 12 + Math.max(0, amount) * 4;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private makeSoftClipCurve(): Float32Array {
    const n_samples = 8192;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = Math.tanh(x * 1.4);
    }
    return curve;
  }
}

export const audioEngine = new DspAudioEngine();
