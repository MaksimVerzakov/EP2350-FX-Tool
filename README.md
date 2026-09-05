# EP-2350 FX Tool

A companion web application for configuring, tweaking, and live-auditioning effects for the [Teenage Engineering EP-2350 fx mic](https://teenage.engineering/guides/ep-2350).

Built with the exact design aesthetic, typography, and color palette of Teenage Engineering's [EP Sample Tool](https://teenage.engineering/apps/ep-sample-tool).

---

## Features

- **Strict Chapter 7 Specification Compliance**:
  - Implements the complete anatomy of `config.json`.
  - Enforces all golden rules: strict uppercase effect names, no trailing commas, valid double quotes, and single-instance constraints (`DELAY`, `REVERB`, `HARMONY`, `SSB`).
  - Signal flow positioning rules for `{ "effect": "SAMPLE" }`.
  - Automatic `samples` section omission when using internal factory sounds (Chapter 7.5).
  - Parallel bus routing (`BUS: 1`, `BUS: 2`) support.
- **Physical Controls & Hardware Emulation**:
  - **Rotary Knobs**: 270-degree drag controls with styled bezels, indicator notches, and LCD readouts.
  - **Squeeze Handle Lever**: Interactive fader paddle with Spring-Return and Latch modes to modulate target parameters or LFO speed.
  - **4 Orange Preset Slots**: Instant switching between slots 0, 1, 2, and 3.
  - **Shake Sensor Simulator**: Trigger accelerometer transient bursts with a button or `Spacebar`.
- **Live In-Browser DSP Auditioning**:
  - Web Audio API graph emulating the EP-2350 effect algorithms in real time.
  - Built-in audition sources: vocal formant speech ("EP TWO THREE FIVE ZERO"), punchy drum beat, and retro synth chords.
  - Custom `.WAV` file drag & drop loader.
  - Real-time TE teal post-FX oscilloscope monitor.
- **Live JSON Inspector**:
  - Real-time syntax highlighting, live validation alerts, copy to clipboard, and one-click `config.json` export.

---

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + Custom Teenage Engineering CSS design tokens
- **Audio Engine**: Web Audio API (BiquadFilter, WaveShaper, Delay, Analyser, custom algorithmic reverb)
- **Icons**: Lucide Icons + custom SVGs

---

## Getting Started

### 1. Installation

```bash
npm install
```

### 2. Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build & Tests

```bash
# Run automated compliance tests
npm test

# Build for production
npm run build
```

---

## Deploying Config to Hardware

1. Remove the lower lid of your EP-2350 fx mic and connect it to your computer via USB-C.
2. Push the handle to power on the mic. A disk named `fx-mic disk` will mount on your computer.
3. Click **"EXPORT CONFIG.JSON"** in this tool to download `config.json`.
4. Copy `config.json` directly into the root folder of `fx-mic disk`.
5. Eject the disk on your computer. The EP-2350 will automatically restart and load the new config.
