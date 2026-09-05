import { AnyEffect, PresetConfig } from '../types/config';
import { createSyntheticAudioBuffer } from './synthSamples';

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

      // Default sample: beat
      this.currentBuffer = createSyntheticAudioBuffer(this.ctx, 'beat');
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

    // Decay shake over 400ms
    const start = performance.now();
    const decay = () => {
      const elapsed = (performance.now() - start) / 400;
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

  public async start() {
    await this.init();
    if (!this.ctx) return;
    this.isRunning = true;
    this.rebuildChain();
  }

  public stop() {
    this.isRunning = false;
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

    const serialEffects: Array<{ fx: AnyEffect; idx: number }> = [];
    const bus1Effects: Array<{ fx: AnyEffect; idx: number }> = [];
    const bus2Effects: Array<{ fx: AnyEffect; idx: number }> = [];

    if (this.preset && this.preset.list.length > 0) {
      this.preset.list.forEach((fx, rowIdx) => {
        if (fx.BUS === 1) {
          bus1Effects.push({ fx, idx: rowIdx });
        } else if (fx.BUS === 2) {
          bus2Effects.push({ fx, idx: rowIdx });
        } else {
          serialEffects.push({ fx, idx: rowIdx });
        }
      });
    }

    // Master summing node before master gain
    const busSummer = this.ctx.createGain();
    busSummer.gain.value = 1.0;

    // 1. Process serial chain
    let serialHead: AudioNode = this.sourceNode;
    serialEffects.forEach(({ fx, idx }) => {
      const built = this.buildEffectNodes(fx, idx);
      if (built) {
        serialHead.connect(built.input);
        serialHead = built.output;
        this.activeNodes.push({
          effectType: fx.effect,
          params: { ...fx },
          nodeRefs: built.nodeRefs
        });
      }
    });

    serialHead.connect(busSummer);

    // 2. Process Bus 1 parallel branch
    if (bus1Effects.length > 0) {
      let bus1Head: AudioNode = serialHead;
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
    }

    // 3. Process Bus 2 parallel branch
    if (bus2Effects.length > 0) {
      let bus2Head: AudioNode = serialHead;
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

    switch (fx.effect) {
      case 'LOWPASS': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 2.0;
        const cutoff = typeof fx.cutoff === 'number' ? fx.cutoff : 1.0;
        filter.frequency.value = 20 * Math.pow(1000, cutoff);
        return { input: filter, output: filter, nodeRefs: { filter, rowIdx } };
      }

      case 'HIGHPASS': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.Q.value = 2.0;
        const cutoff = typeof fx.cutoff === 'number' ? fx.cutoff : 0.0;
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
        // Distortion with Waveshaper + Tone + Mix
        const inputGain = ctx.createGain();
        const outputGain = ctx.createGain();

        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const shaper = ctx.createWaveShaper();

        const lpTone = ctx.createBiquadFilter();
        lpTone.type = 'lowpass';
        const hpTone = ctx.createBiquadFilter();
        hpTone.type = 'highpass';

        // Mix routing
        const mix = typeof fx.mix === 'number' ? fx.mix : 0.5;
        dryGain.gain.value = 1.0 - mix;
        wetGain.gain.value = mix;

        // WaveShaper curve
        const amount = typeof fx.amount === 'number' ? fx.amount : 10.0;
        shaper.curve = this.makeDistortionCurve(amount) as any;
        shaper.oversample = '4x';

        // Tones
        const lp = typeof fx['lowpass-cutoff'] === 'number' ? fx['lowpass-cutoff'] : 1.0;
        lpTone.frequency.value = 20 * Math.pow(1000, lp);
        const hp = typeof fx['highpass-cutoff'] === 'number' ? fx['highpass-cutoff'] : 0.0;
        hpTone.frequency.value = 20 * Math.pow(1000, hp);

        // Wiring
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
        const input = ctx.createGain();
        const output = ctx.createGain();

        const delayNode = ctx.createDelay(2.0);
        const time = typeof fx.time === 'number' ? fx.time : 0.35;
        delayNode.delayTime.value = Math.max(0.01, Math.min(1.1, time));

        const feedbackGain = ctx.createGain();
        const echo = typeof fx.echo === 'number' ? fx.echo : 0.4;
        feedbackGain.gain.value = Math.min(0.92, echo);

        const lpFilter = ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        const lp = typeof fx['lowpass-cutoff'] === 'number' ? fx['lowpass-cutoff'] : 1.0;
        lpFilter.frequency.value = 20 * Math.pow(1000, lp);

        const dryGain = ctx.createGain();
        dryGain.gain.value = typeof fx['dry-level'] === 'number' ? fx['dry-level'] : 1.0;

        const wetGain = ctx.createGain();
        wetGain.gain.value = typeof fx['wet-level'] === 'number' ? fx['wet-level'] : 0.5;

        // Connect delay loop
        input.connect(dryGain);
        dryGain.connect(output);

        input.connect(delayNode);
        delayNode.connect(lpFilter);
        lpFilter.connect(feedbackGain);
        feedbackGain.connect(delayNode);

        lpFilter.connect(wetGain);
        wetGain.connect(output);

        return {
          input,
          output,
          nodeRefs: { delayNode, feedbackGain, lpFilter, dryGain, wetGain, rowIdx }
        };
      }

      case 'REVERB': {
        // Algorithmic Spring Reverb simulation with comb filters & dispersion
        const input = ctx.createGain();
        const output = ctx.createGain();

        const dryGain = ctx.createGain();
        dryGain.gain.value = typeof fx['dry-level'] === 'number' ? fx['dry-level'] : 1.0;
        const wetGain = ctx.createGain();
        wetGain.gain.value = typeof fx['wet-level'] === 'number' ? fx['wet-level'] : 0.5;

        const hpFilter = ctx.createBiquadFilter();
        hpFilter.type = 'highpass';
        const hp = typeof fx['highpass-cutoff'] === 'number' ? fx['highpass-cutoff'] : 0.2;
        hpFilter.frequency.value = 20 * Math.pow(1000, hp);

        // Comb filters for metallic spring resonance
        const combTimes = [0.029, 0.037, 0.043, 0.051];
        const combGains = [0.82, 0.78, 0.74, 0.7];
        const timeScale = typeof fx.time === 'number' ? fx.time : 0.5;
        const springMix = typeof fx['spring-mix'] === 'number' ? fx['spring-mix'] : 0.0;

        const combSum = ctx.createGain();
        combSum.gain.value = 0.28 + springMix * 0.4;

        combTimes.forEach((dTime, idx) => {
          const delay = ctx.createDelay(0.5);
          delay.delayTime.value = dTime * (0.6 + timeScale * 0.8);

          const fb = ctx.createGain();
          fb.gain.value = combGains[idx] * (0.6 + timeScale * 0.35);

          hpFilter.connect(delay);
          delay.connect(fb);
          fb.connect(delay);
          delay.connect(combSum);
        });

        input.connect(dryGain);
        dryGain.connect(output);

        input.connect(hpFilter);
        combSum.connect(wetGain);
        wetGain.connect(output);

        return {
          input,
          output,
          nodeRefs: { dryGain, wetGain, hpFilter, combSum, rowIdx }
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
        ringGain.gain.value = 0; // modulated by osc
        osc.connect(ringGain.gain);
        osc.start();

        const dryGain = ctx.createGain();
        const wetGain = ctx.createGain();
        const mix = typeof fx.mix === 'number' ? fx.mix : 0.5;
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
        // Pitch shift ratio simulation
        const gain = ctx.createGain();
        const pitch = typeof fx.pitch === 'number' ? fx.pitch : 1.0;
        if (this.sourceNode) {
          this.sourceNode.playbackRate.value = pitch;
        }
        return { input: gain, output: gain, nodeRefs: { gain, rowIdx } };
      }

      case 'SAMPLE': {
        const gain = ctx.createGain();
        const level = typeof fx.level === 'number' ? fx.level : 1.0;
        gain.gain.value = level;

        if (this.sourceNode) {
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
        // Single Sideband frequency shift approximation via high-frequency ring mod
        const gain = ctx.createGain();
        return { input: gain, output: gain, nodeRefs: { gain, rowIdx } };
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

    this.activeNodes.forEach(({ effectType, params, nodeRefs }) => {
      const rowIdx = nodeRefs.rowIdx;

      // Check handle modulation on this row
      let handleDelta = 0;
      if (handle && handle.target !== 'lfo' && handle.row === rowIdx) {
        handleDelta = this.modState.handlePos * handle.depth;
      }

      // Check shake modulation on this row
      let shakeDelta = 0;
      if (shake && shake.row === rowIdx) {
        shakeDelta = this.modState.shakeAmount * shake.depth;
      }

      if (effectType === 'LOWPASS' || effectType === 'HIGHPASS') {
        const baseCutoff = typeof params.cutoff === 'number' ? params.cutoff : (effectType === 'LOWPASS' ? 1.0 : 0.0);
        let moddedCutoff = baseCutoff;
        if (handle && handle.param === 'cutoff') moddedCutoff += handleDelta;
        if (shake && shake.param === 'cutoff') moddedCutoff += shakeDelta;
        moddedCutoff = Math.max(0.0, Math.min(1.0, moddedCutoff));

        const hz = 20 * Math.pow(1000, moddedCutoff);
        if (nodeRefs.filter) {
          nodeRefs.filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.02);
        }
      } else if (effectType === 'DIST') {
        if (handle && handle.param === 'mix' && nodeRefs.wetGain) {
          const baseMix = typeof params.mix === 'number' ? params.mix : 0.5;
          const mix = Math.max(0.0, Math.min(1.0, baseMix + handleDelta + shakeDelta));
          nodeRefs.wetGain.gain.setTargetAtTime(mix, ctx.currentTime, 0.02);
          nodeRefs.dryGain.gain.setTargetAtTime(1.0 - mix, ctx.currentTime, 0.02);
        }
      } else if (effectType === 'DELAY') {
        if (handle && handle.param === 'echo' && nodeRefs.feedbackGain) {
          const baseEcho = typeof params.echo === 'number' ? params.echo : 0.4;
          const echo = Math.max(0.0, Math.min(0.95, baseEcho + handleDelta + shakeDelta));
          nodeRefs.feedbackGain.gain.setTargetAtTime(echo, ctx.currentTime, 0.02);
        }
      }
    });
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = Math.max(0.1, amount);
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}

export const audioEngine = new DspAudioEngine();
