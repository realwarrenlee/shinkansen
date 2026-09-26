// Locally synthesized rail/wind ambience. No copyrighted recording or network asset.
export class JourneyAudio {
  context: AudioContext | null = null;
  gain: GainNode | null = null;
  filter: BiquadFilterNode | null = null;
  source: AudioBufferSourceNode | null = null;
  enabled = false;
  async enable() {
    this.enabled = true;
    if (!this.context) {
      this.context = new AudioContext();
      const length = this.context.sampleRate * 3;
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0); let previous = 0;
      for (let i = 0; i < length; i++) { previous = (previous + (Math.random() * 2 - 1) * .03) / 1.025; data[i] = previous * 4; }
      this.source = this.context.createBufferSource(); this.source.buffer = buffer; this.source.loop = true;
      this.filter = this.context.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 350;
      this.gain = this.context.createGain(); this.gain.gain.value = 0;
      this.source.connect(this.filter).connect(this.gain).connect(this.context.destination);this.source.start();
    }
    await this.context.resume();
  }
  async toggle() {
    if (this.enabled) this.enabled = false;
    else await this.enable();
    return this.enabled;
  }
  update(speed:number,muted:boolean,tunnel:boolean) {
    if (!this.context || !this.gain || !this.filter) return;
    const volume=this.enabled && !muted ? Math.min(.3,speed/83*.22) : 0;
    this.gain.gain.setTargetAtTime(volume,this.context.currentTime,.18);
    this.filter.frequency.setTargetAtTime((tunnel?850:300)+speed*10,this.context.currentTime,.2);
  }
  dispose() { this.source?.stop(); void this.context?.close(); }
}
