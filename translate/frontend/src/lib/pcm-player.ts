/** Gapless PCM playback of a provider's synthesized speech, via Web Audio. */
export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextPlayTime = 0;
  private master: GainNode | null = null;
  private capture: MediaStreamAudioDestinationNode | null = null;

  /**
   * Create + resume the AudioContext from inside a user gesture so it starts in
   * "running" state. If we wait for the first audio chunk (1–3s later) the
   * gesture has expired and the context starts suspended, silently dropping
   * every scheduled chunk.
   */
  prime() {
    this.ensureCtx();
  }

  /**
   * One context at the hardware rate for the whole session. Each chunk's
   * AudioBuffer is created at the chunk's own declared rate and Web Audio
   * resamples it on playback, so providers with different TTS rates (16 kHz
   * Azure, 24 kHz everyone else) coexist without recreating the context —
   * which would happen outside the priming gesture and risk starting
   * suspended.
   */
  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.capture = null;
      this.nextPlayTime = 0;
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  play(pcmB64: string, sampleRate: number) {
    const ctx = this.ensureCtx();

    const bin = atob(pcmB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    // Reinterpret as Int16 (PCM samples), then convert to Float32 in [-1, 1].
    const evenLen = bytes.byteLength - (bytes.byteLength % 2);
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, evenLen / 2);
    if (int16.length === 0) return;
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.master ?? ctx.destination);

    // Schedule back-to-back rather than at `currentTime`, so consecutive
    // chunks play without a seam.
    const startAt = Math.max(ctx.currentTime, this.nextPlayTime);
    src.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;
  }

  stop() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.master = null;
      this.capture = null;
    }
    this.nextPlayTime = 0;
  }

  /** Everything this player outputs, for the in-app recorder. */
  captureStream(): MediaStream | null {
    if (!this.ctx || !this.master) return null;
    if (!this.capture) {
      this.capture = this.ctx.createMediaStreamDestination();
      this.master.connect(this.capture);
    }
    return this.capture.stream;
  }

  /**
   * Milliseconds of audio scheduled but not yet played. Closing the
   * AudioContext before this elapses drops the queued samples.
   */
  remainingMs(): number {
    if (!this.ctx) return 0;
    return Math.max(0, (this.nextPlayTime - this.ctx.currentTime) * 1000);
  }
}
