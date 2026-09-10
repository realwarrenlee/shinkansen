export class Motion {
  constructor(public length: number) {}
  distance = 0;
  speed = 0;
  acceleration = 0;
  readonly targetKmh = 300;
  paused = false;
  ended = false;
  direction: 1 | -1 = 1;
  depart() {
    if (this.ended) {
      this.direction = this.direction === 1 ? -1 : 1;
      this.ended = false;
    }
    this.paused = false;
  }
  update(seconds: number) {
    if (this.paused || this.ended) return;
    let remaining = Math.min(seconds, 0.15);
    while (remaining > 1e-8) {
      const dt = Math.min(remaining, 1 / 120);
      const toEnd =
        this.direction === 1 ? this.length - this.distance : this.distance;
      const stoppingTarget = Math.sqrt(Math.max(0, 2 * 3 * toEnd));
      const target = Math.min(this.targetKmh / 3.6, stoppingTarget);
      const desired = Math.max(-5, Math.min(5, (target - this.speed) * 0.9));
      this.acceleration += Math.max(
        -3 * dt,
        Math.min(3 * dt, desired - this.acceleration),
      );
      const previous = this.speed;
      this.speed = Math.min(
        this.targetKmh / 3.6,
        Math.max(0, this.speed + this.acceleration * dt),
      );
      if (
        Math.abs(target - this.speed) < 0.025 &&
        Math.abs(this.acceleration) < 0.15
      ) {
        this.speed = target;
        this.acceleration = 0;
      }
      this.distance = Math.max(
        0,
        Math.min(
          this.length,
          this.distance + this.direction * (previous + this.speed) * 0.5 * dt,
        ),
      );
      if (
        this.direction === 1
          ? this.distance >= this.length - 0.02
          : this.distance <= 0.02
      ) {
        this.distance = this.direction === 1 ? this.length : 0;
        this.speed = 0;
        this.acceleration = 0;
        this.ended = true;
        break;
      }
      remaining -= dt;
    }
  }
  seek(distance: number) {
    this.distance = Math.max(0, Math.min(this.length, distance));
    this.speed = 0;
    this.acceleration = 0;
    this.ended =
      this.direction === 1 ? this.distance >= this.length : this.distance <= 0;
  }
  restart() {
    this.direction = 1;
    this.seek(0);
    this.paused = false;
  }
}
