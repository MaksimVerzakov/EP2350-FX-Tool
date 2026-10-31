import { AnyEffect, PresetConfig } from '../types/config';
import { createSyntheticAudioBuffer } from './synthSamples';
import {
  PitchShiftKernel,
  computeLfoWave,
  cutoffToHz,
  makeDistortionCurve,
  makeSoftClipCurve,
  resolveModDepth
} from './math';
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
  private sourceHub: GainNode | null = null;
  private busSummer: GainNode | null = null;
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
    const prevTopology = this.activeNodes
      .map((n) => `${n.effectType}:${n.params.BUS || 1}:${n.nodeRefs.rowIdx}`)
      .join('|');
    const nextTopology = (preset.list || [])
      .map((fx, idx) => `${fx.effect}:${fx.BUS || 1}:${idx}`)
      .join('|');

    this.preset = preset;
    if (!this.isRunning) return;

    if (prevTopology === nextTopology && this.activeNodes.length === preset.list.length) {
      // Update parameters in place without tearing down nodes or restarting audio
      this.activeNodes.forEach((node) => {
        const updatedFx = preset.list[node.nodeRefs.rowIdx];
        if (updatedFx) {
          node.params = { ...updatedFx };
        }
      });
      this.applyLiveModulation();
    } else {
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
    if (!this.ctx || !this.currentBuffer) return;
    this.isRunning = true;

    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {}
    }
    if (this.sourceHub) {
      try {
        this.sourceHub.disconnect();
      } catch (e) {}
    }

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.currentBuffer;
    this.sourceNode.loop = this.loopSource;

    this.sourceHub = this.ctx.createGain();
    this.sourceHub.gain.value = 1.0;
    this.sourceNode.connect(this.sourceHub);

    this.rebuildChain();
    this.sourceNode.start(0);
    this.startModulationLoop();
  }

  private cleanupActiveNodes() {
    this.activeNodes.forEach(({ nodeRefs }) => {
      if (nodeRefs.osc) {
        try {
          nodeRefs.osc.stop();
          nodeRefs.osc.disconnect();
        } catch (e) {}
      }
      if (nodeRefs.pitchShifter?.processor) {
        try {
          nodeRefs.pitchShifter.processor.onaudioprocess = null;
          nodeRefs.pitchShifter.processor.disconnect();
        } catch (e) {}
      }
    });
    this.activeNodes = [];
  }

  /**
   * Wrap the pure PitchShiftKernel (src/dsp/math.ts) in a ScriptProcessorNode.
   * Shifts pitch while keeping playback speed strictly at 1.0x.
   */
  private createConstantSpeedPitchShifter(ctx: AudioContext, initialPitch: number) {
    const processor = ctx.createScriptProcessor(512, 1, 1);
    const kernel = new PitchShiftKernel(initialPitch);
    processor.onaudioprocess = (e: AudioProcessingEvent) => {
      kernel.process(e.inputBuffer.getChannelData(0), e.outputBuffer.getChannelData(0));
    };
    return {
      processor,
      setPitch: (newPitch: number) => kernel.setPitch(newPitch)
    };
  }

  public stop() {
    this.isRunning = false;
    this.stopModulationLoop();
    this.cleanupActiveNodes();
    if (this.sourceHub) {
      try {
        this.sourceHub.disconnect();
      } catch (e) {}
      this.sourceHub = null;
    }
    if (this.busSummer) {
      try {
        this.busSummer.disconnect();
      } catch (e) {}
      this.busSummer = null;
    }
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
    if (!this.ctx || !this.currentBuffer || !this.gainMaster || !this.sourceHub) return;

    this.cleanupActiveNodes();

    try {
      this.sourceHub.disconnect();
    } catch (e) {}

    if (this.busSummer) {
      try {
        this.busSummer.disconnect();
      } catch (e) {}
    }

    // Reset playbackRate to 1.0 unless SAMPLE.speed overrides it
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = 1.0;
    }

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
    this.busSummer = busSummer;

    // 1. Process Bus 1 (Primary parallel branch)
    let bus1Head: AudioNode = this.sourceHub;
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
      let bus2Head: AudioNode = this.sourceHub;
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
        filter.frequency.value = cutoffToHz(cutoff);
        return { input: filter, output: filter, nodeRefs: { filter, rowIdx } };
      }

      case 'HIGHPASS': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.Q.value = 2.0;
        const cutoff = toRatio(fx.cutoff, 0.0);
        filter.frequency.value = cutoffToHz(cutoff);
        return { input: filter, output: filter, nodeRefs: { filter, rowIdx } };
      }

      case 'EQUALISER': {
        const eq = ctx.createBiquadFilter();
        eq.type = 'peaking';
        const cutoff = typeof fx.CUTOFF === 'number' ? fx.CUTOFF : 0.5;
        eq.frequency.value = cutoffToHz(cutoff);
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
        shaper.curve = makeDistortionCurve(amount) as any;
        shaper.oversample = '4x';

        const lp = toRatio(fx['lowpass-cutoff'], 1.0);
        lpTone.frequency.value = cutoffToHz(lp);
        const hp = toRatio(fx['highpass-cutoff'], 0.0);
        hpTone.frequency.value = cutoffToHz(hp);

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
        tapeLimiter.curve = makeSoftClipCurve() as any;

        const lpFilter = ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        const lp = toRatio(fx['lowpass-cutoff'], 1.0);
        lpFilter.frequency.value = cutoffToHz(lp);

        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        const hp = toRatio(fx['highpass-cutoff'], 0.0);
        hpFilter.frequency.value = cutoffToHz(hp);

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
        hpFilter.frequency.value = cutoffToHz(hp);

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
        // Real-time vocal pitch shifter + dry-level vocal doubler
        // Keeps playback speed strictly at 1.0x while shifting pitch (0.5x..2.0x)
        const input = ctx.createGain();
        const output = ctx.createGain();

        const dryGain = ctx.createGain();
        const dryLevel = toRatio(fx['dry-level'], 1.0);
        dryGain.gain.value = dryLevel;

        const wetGain = ctx.createGain();
        wetGain.gain.value = 1.0;

        const pitch = typeof fx.pitch === 'number' ? fx.pitch : 1.0;
        const pitchShifter = this.createConstantSpeedPitchShifter(ctx, pitch);

        input.connect(dryGain);
        dryGain.connect(output);

        input.connect(pitchShifter.processor);
        pitchShifter.processor.connect(wetGain);
        wetGain.connect(output);

        return {
          input,
          output,
          nodeRefs: { dryGain, wetGain, pitchShifter, rowIdx }
        };
      }

      case 'SAMPLE': {
        const input = ctx.createGain();
        const output = ctx.createGain();
        const level = toRatio(fx.level, 1.0);
        output.gain.value = level;

        // Only SAMPLE.speed changes playback speed; SAMPLE.pitch shifts pitch at constant speed
        if (this.sourceNode && typeof fx.speed === 'number' && fx.speed > 0) {
          this.sourceNode.playbackRate.value = fx.speed;
        }

        const semitones = typeof fx.pitch === 'number' ? fx.pitch : 0;
        const pitchRatio = Math.pow(2, semitones / 12);
        const pitchShifter = this.createConstantSpeedPitchShifter(ctx, pitchRatio);

        input.connect(pitchShifter.processor);
        pitchShifter.processor.connect(output);

        return { input, output, nodeRefs: { gain: output, pitchShifter, rowIdx } };
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

    const lfoWave = lfo ? computeLfoWave(lfo.shape || 'sine', ctx.currentTime, effectiveLfoSpeed) : 0;

    this.activeNodes.forEach(({ effectType, params, nodeRefs }) => {
      const rowIdx = nodeRefs.rowIdx;

      // Normalized [-1..1] deltas for [0..1] parameters
      let handleDelta = 0;
      if (handle && handle.target !== 'lfo' && handle.row === rowIdx) {
        const depthRatio = resolveModDepth(effectType, handle.param, handle.depth);
        handleDelta = this.modState.handlePos * depthRatio;
      }

      let shakeDelta = 0;
      if (shake && shake.row === rowIdx) {
        const depthRatio = resolveModDepth(effectType, shake.param, shake.depth);
        shakeDelta = this.modState.shakeAmount * depthRatio;
      }

      let lfoDelta = 0;
      if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx) {
        const depthRatio = resolveModDepth(effectType, lfo.param, lfo.depth);
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

        const hz = cutoffToHz(moddedCutoff);
        if (nodeRefs.filter) {
          nodeRefs.filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.015);
        }
      } else if (effectType === 'EQUALISER') {
        if (nodeRefs.eq) {
          const baseCutoff = typeof params.CUTOFF === 'number' ? params.CUTOFF : 0.5;
          let moddedCutoff = baseCutoff;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'CUTOFF') moddedCutoff += handleDelta;
          if (shake && shake.row === rowIdx && shake.param === 'CUTOFF') moddedCutoff += shakeDelta;
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'CUTOFF') moddedCutoff += lfoDelta;
          moddedCutoff = Math.max(0.0, Math.min(1.0, moddedCutoff));
          nodeRefs.eq.frequency.setTargetAtTime(cutoffToHz(moddedCutoff), ctx.currentTime, 0.015);

          const q = typeof params.Q === 'number' ? params.Q : 0.7;
          nodeRefs.eq.Q.setTargetAtTime(Math.max(0.1, q * 10), ctx.currentTime, 0.015);

          const gain = typeof params.GAIN === 'number' ? params.GAIN : 0.0;
          nodeRefs.eq.gain.setTargetAtTime(gain * 15, ctx.currentTime, 0.015);
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
        if (nodeRefs.lpTone) {
          const lp = toRatio(params['lowpass-cutoff'], 1.0);
          nodeRefs.lpTone.frequency.setTargetAtTime(cutoffToHz(lp), ctx.currentTime, 0.015);
        }
        if (nodeRefs.hpTone) {
          const hp = toRatio(params['highpass-cutoff'], 0.0);
          nodeRefs.hpTone.frequency.setTargetAtTime(cutoffToHz(hp), ctx.currentTime, 0.015);
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
        if (nodeRefs.dryGain) {
          const baseDry = toRatio(params['dry-level'], 1.0);
          nodeRefs.dryGain.gain.setTargetAtTime(Math.max(0.0, Math.min(1.0, baseDry)), ctx.currentTime, 0.02);
        }
        if (nodeRefs.lpFilter) {
          const lp = toRatio(params['lowpass-cutoff'], 1.0);
          nodeRefs.lpFilter.frequency.setTargetAtTime(cutoffToHz(lp), ctx.currentTime, 0.02);
        }
        if (nodeRefs.hpFilter) {
          const hp = toRatio(params['highpass-cutoff'], 0.0);
          nodeRefs.hpFilter.frequency.setTargetAtTime(cutoffToHz(hp), ctx.currentTime, 0.02);
        }
      } else if (effectType === 'HARMONY') {
        const basePitch = typeof params.pitch === 'number' ? params.pitch : 1.0;
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

        if (nodeRefs.pitchShifter) {
          nodeRefs.pitchShifter.setPitch(moddedPitch);
        }

        if (nodeRefs.dryGain) {
          const baseDry = toRatio(params['dry-level'], 1.0);
          let delta = 0;
          if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'dry-level') delta += handleDelta;
          if (shake && shake.row === rowIdx && shake.param === 'dry-level') delta += shakeDelta;
          if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'dry-level') delta += lfoDelta;
          nodeRefs.dryGain.gain.setTargetAtTime(Math.max(0.0, Math.min(1.0, baseDry + delta)), ctx.currentTime, 0.015);
        }
      } else if (effectType === 'SAMPLE') {
        const baseSemitones = typeof params.pitch === 'number' ? params.pitch : 0;
        let moddedSemitones = baseSemitones;
        if (handle && handle.target !== 'lfo' && handle.row === rowIdx && handle.param === 'pitch') {
          moddedSemitones += this.modState.handlePos * (typeof handle.depth === 'number' ? handle.depth : 12);
        }
        if (shake && shake.row === rowIdx && shake.param === 'pitch') {
          moddedSemitones += this.modState.shakeAmount * (typeof shake.depth === 'number' ? shake.depth : 12);
        }
        if (lfo && lfo.target !== 'lfo' && lfo.row === rowIdx && lfo.param === 'pitch') {
          moddedSemitones += lfoWave * (typeof lfo.depth === 'number' ? lfo.depth : 6);
        }
        if (nodeRefs.pitchShifter) {
          nodeRefs.pitchShifter.setPitch(Math.pow(2, moddedSemitones / 12));
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
}

export const audioEngine = new DspAudioEngine();
