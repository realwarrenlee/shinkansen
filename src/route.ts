import * as THREE from 'three';

export const ROUTE_LENGTH = 5400;
export const TRACK_HEIGHT = 6;
export const chapters = [
  { name: 'Departure', position: 0, end: .15 },
  { name: 'Suburbs', position: .22, end: .35 },
  { name: 'Mount Fuji', position: .46, end: .65 },
  { name: 'Tunnel', position: .71, end: .8 },
  { name: 'Beyond', position: .87, end: 1 },
];
export function chapterAt(progress: number) {
  return Math.min(4, chapters.findIndex(c => progress < c.end) < 0 ? 4 : chapters.findIndex(c => progress < c.end));
}

// Almost-straight railway with a very broad curve, sampled by physical arc length.
export class Route {
  curve: THREE.CatmullRomCurve3;
  total: number;
  margin = 330;
  constructor() {
    const points = Array.from({ length: 81 }, (_, i) => {
      const x = -3030 + i * 80;
      return new THREE.Vector3(x, TRACK_HEIGHT, 72 * Math.sin(x / 1000));
    });
    this.curve = new THREE.CatmullRomCurve3(points);
    this.curve.arcLengthDivisions = 8000;
    this.curve.updateArcLengths();
    this.total = this.curve.getLength();
  }
  point(distance: number) {
    return this.curve.getPointAt(THREE.MathUtils.clamp((distance + this.margin) / this.total, 0, 1));
  }
  tangent(distance: number) {
    return this.curve.getTangentAt(THREE.MathUtils.clamp((distance + this.margin) / this.total, 0, 1));
  }
  offset(distance: number, side: number, height = 0) {
    const p = this.point(distance), t = this.tangent(distance);
    return p.add(new THREE.Vector3(-t.z * side, height, t.x * side));
  }
  yaw(distance: number) {
    const t = this.point(distance + 8).sub(this.point(distance - 8));
    return -Math.atan2(t.z, t.x);
  }
}

// Scroll maps into a cinematic timeline with a slow departure and gentle ending.
export function timelineDistance(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  if (p < .15) return ROUTE_LENGTH * (.5 * p * p / .15);
  if (p > .85) return ROUTE_LENGTH * (1 - .5 * (1 - p) ** 2 / .15);
  return ROUTE_LENGTH * (.075 + (p - .15) * (.85 / .7));
}
export function timelineProgress(distance: number) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) {
    const m = (lo + hi) / 2;
    if (timelineDistance(m) < distance) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
