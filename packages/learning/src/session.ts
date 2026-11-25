/**
 * Session mode: the generated band follows the player. From the microphone
 * level it detects note attacks, estimates how busy and loud the playing is,
 * and maps that to the arranger's density (1 sparse … 3 busy). When the player
 * stops for a while the band "waits" (drops to a minimal groove).
 */

export interface SessionFrame { time: number; level: number }
export interface SessionState { intensity: number; density: 1 | 2 | 3; waiting: boolean; notesPerSecond: number; onset: boolean }

export class SessionFollower {
  private fast = 0;
  private slow = 0;
  private lastOnset = -Infinity;
  private onsets: number[] = [];
  private intensity = 0.4;
  private density: 1 | 2 | 3 = 2;
  private lastTime: number | null = null;

  constructor(private opts: { gate?: number; waitAfter?: number } = {}) {}

  update(f: SessionFrame): SessionState {
    const gate = this.opts.gate ?? 0.012;
    const waitAfter = this.opts.waitAfter ?? 4;
    const dt = this.lastTime === null ? 0.05 : Math.max(0.001, f.time - this.lastTime);
    this.lastTime = f.time;
    this.fast += (f.level - this.fast) * Math.min(1, dt / 0.03);
    this.slow += (f.level - this.slow) * Math.min(1, dt / 0.4);
    let onset = false;
    if (this.fast > gate && this.fast > this.slow * 1.6 && f.time - this.lastOnset > 0.08) {
      onset = true;
      this.lastOnset = f.time;
      this.onsets.push(f.time);
    }
    this.onsets = this.onsets.filter((t) => f.time - t <= 3);
    const rate = this.onsets.length / 3;
    const clamp = (x: number) => Math.max(0, Math.min(1, x));
    const activity = clamp(rate / 6) * 0.65 + clamp(this.slow / 0.12) * 0.35;
    this.intensity += (activity - this.intensity) * Math.min(1, dt / 1.5);
    const i = this.intensity;
    if (this.density === 3 && i < 0.5) this.density = 2;
    else if (this.density === 1 && i > 0.35) this.density = 2;
    else if (this.density === 2 && i > 0.62) this.density = 3;
    else if (this.density === 2 && i < 0.22) this.density = 1;
    const waiting = f.time - this.lastOnset > waitAfter;
    return { intensity: i, density: waiting ? 1 : this.density, waiting, notesPerSecond: rate, onset };
  }
}
