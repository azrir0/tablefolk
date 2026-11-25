/**
 * Procedural cozy Web Audio foley synthesizer — zero external audio file dependencies.
 * Combines warm oscillators with filtered noise bursts for tactile tabletop sounds:
 * card whooshes, wooden tile thuds, boulder shatters, countdown ticks, role swells & chimes.
 */
class CozySoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean) {
    this.muted = m;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.08,
    delay = 0,
    endFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  private playNoise(
    duration: number,
    filterFreq: number,
    filterType: BiquadFilterType = "bandpass",
    volume = 0.08,
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(1.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  public playCountdownTick(step: number) {
    const freq = step === 3 ? 440 : step === 2 ? 523.25 : 587.33;
    this.playTone(freq, 0.14, "triangle", 0.09, 0);
  }

  public playCountdownGo() {
    this.playTone(587.33, 0.12, "triangle", 0.09, 0);
    this.playTone(880, 0.28, "sine", 0.09, 0.08);
  }

  public playRoleReveal(isTrickster: boolean) {
    this.playNoise(0.22, 1100, "bandpass", 0.06, 0);
    if (isTrickster) {
      // Mysterious minor swell for Trickster
      this.playTone(220, 0.45, "triangle", 0.08, 0.05);
      this.playTone(261.63, 0.45, "sine", 0.07, 0.12);
      this.playTone(311.13, 0.55, "sine", 0.08, 0.2);
    } else {
      // Warm heroic sunlit fifth for Trailblazer
      this.playTone(293.66, 0.42, "triangle", 0.08, 0.05);
      this.playTone(440, 0.48, "sine", 0.08, 0.14);
      this.playTone(587.33, 0.58, "sine", 0.09, 0.24);
    }
  }

  public playCardWhoosh() {
    this.playNoise(0.14, 1700, "bandpass", 0.07, 0);
    this.playTone(380, 0.1, "sine", 0.03, 0, 620);
  }

  public playTilePlace() {
    // Card flight whoosh + crisp wooden tabletop thud on landing!
    this.playCardWhoosh();
    this.playTone(170, 0.11, "triangle", 0.12, 0.18, 95);
    this.playTone(320, 0.08, "sine", 0.06, 0.19);
  }

  public playCardDiscard() {
    this.playNoise(0.12, 2200, "highpass", 0.05, 0);
    this.playTone(310, 0.08, "triangle", 0.05, 0.04, 210);
  }

  public playTurnChime() {
    this.playTone(523.25, 0.16, "sine", 0.07, 0);
    this.playTone(659.25, 0.24, "sine", 0.07, 0.1);
  }

  public playEmotePop() {
    this.playTone(440, 0.07, "sine", 0.06, 0);
    this.playTone(620, 0.1, "sine", 0.05, 0.05);
  }

  public playHazard() {
    this.playCardWhoosh();
    this.playTone(280, 0.14, "sawtooth", 0.055, 0.16, 150);
    this.playTone(165, 0.22, "sawtooth", 0.055, 0.26, 95);
    this.playNoise(0.14, 900, "bandpass", 0.08, 0.22);
  }

  public playRepair() {
    this.playCardWhoosh();
    this.playTone(440, 0.11, "triangle", 0.07, 0.16);
    this.playTone(554.37, 0.13, "triangle", 0.075, 0.23);
    this.playTone(659.25, 0.22, "sine", 0.085, 0.31);
  }

  public playFieldPatch() {
    this.playCardWhoosh();
    this.playNoise(0.1, 1600, "bandpass", 0.06, 0.08);
    this.playTone(392, 0.12, "triangle", 0.08, 0.18);
    this.playTone(523.25, 0.22, "sine", 0.09, 0.27);
  }

  public playSpyglass() {
    this.playCardWhoosh();
    this.playTone(659.25, 0.14, "sine", 0.06, 0.14);
    this.playTone(880, 0.16, "sine", 0.065, 0.22);
    this.playTone(1174.66, 0.28, "sine", 0.065, 0.31);
  }

  public playBoulderClear() {
    this.playCardWhoosh();
    this.playNoise(0.28, 420, "lowpass", 0.14, 0.18);
    this.playTone(140, 0.24, "sawtooth", 0.08, 0.18, 45);
    this.playNoise(0.18, 1200, "bandpass", 0.07, 0.24);
  }

  public playDecoyReveal() {
    this.playTone(330, 0.14, "triangle", 0.08, 0);
    this.playTone(260, 0.24, "triangle", 0.08, 0.12, 220);
  }

  public playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.playTone(n, 0.32, "triangle", 0.09, i * 0.11));
  }
}

export const soundEngine = new CozySoundEngine();
