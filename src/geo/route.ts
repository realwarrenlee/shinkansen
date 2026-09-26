import {
  Cartesian3,
  Cartographic,
  Ellipsoid,
  Math as CM,
  Matrix4,
  Transforms,
  type TerrainProvider,
  sampleTerrain,
} from "cesium";
type Coordinate = [number, number];
export type RouteSample = {
  longitude: number;
  latitude: number;
  height: number;
  distance: number;
};
export const STATION = {
  longitude: 138.6632993,
  latitude: 35.142389843,
  name: "Shin-Fuji",
};
export class GeoRoute {
  samples: RouteSample[] = [];
  start = 0;
  length = 0;
  trackStart = 0;
  trackEnd = 0;
  constructor(coordinates: Coordinate[]) {
    // Keep the surrounding alignment so the ride is a section of a continuing railway.
    const points = coordinates
      .filter((p) => p[0] > 138.63 && p[0] < 138.75)
      .sort((a, b) => a[0] - b[0]);
    if (points.length < 3)
      throw new Error("Shin-Fuji route coordinates are missing.");
    let distance = 0;
    for (let i = 0; i < points.length; i++) {
      if (i)
        distance += Cartesian3.distance(
          Cartesian3.fromDegrees(...points[i]),
          Cartesian3.fromDegrees(...points[i - 1]),
        );
      this.samples.push({
        longitude: points[i][0],
        latitude: points[i][1],
        height: 55,
        distance,
      });
    }
    const index = this.samples.reduce(
      (best, s, i) =>
        Math.abs(s.longitude - STATION.longitude) <
        Math.abs(this.samples[best].longitude - STATION.longitude)
          ? i
          : best,
      0,
    );
    this.start = this.samples[index].distance;
    const rideEnd = this.samples.filter((s) => s.longitude < 138.724).at(-1)!;
    this.length = rideEnd.distance - this.start - 50;
    // Leave a small sampling margin for headings at the physical track boundaries.
    this.trackStart = -this.start + 12;
    this.trackEnd = this.samples.at(-1)!.distance - this.start - 12;
  }
  at(distance: number): RouteSample {
    const d = CM.clamp(distance + this.start, 0, this.samples.at(-1)!.distance);
    let lo = 0,
      hi = this.samples.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.samples[m].distance < d) lo = m;
      else hi = m;
    }
    const a = this.samples[lo],
      b = this.samples[hi],
      t = (d - a.distance) / (b.distance - a.distance || 1);
    return {
      longitude: CM.lerp(a.longitude, b.longitude, t),
      latitude: CM.lerp(a.latitude, b.latitude, t),
      height: CM.lerp(a.height, b.height, t),
      distance,
    };
  }
  point(distance: number, vertical = 0) {
    const s = this.at(distance);
    return Cartesian3.fromDegrees(s.longitude, s.latitude, s.height + vertical);
  }
  frame(distance: number) {
    return Transforms.eastNorthUpToFixedFrame(this.point(distance));
  }
  heading(distance: number) {
    const inverse = Matrix4.inverseTransformation(
      this.frame(distance),
      new Matrix4(),
    );
    const front = Matrix4.multiplyByPoint(
      inverse,
      this.point(distance + 4),
      new Cartesian3(),
    );
    const back = Matrix4.multiplyByPoint(
      inverse,
      this.point(distance - 4),
      new Cartesian3(),
    );
    return Math.atan2(front.y - back.y, front.x - back.x);
  }
  local(distance: number, forward: number, side: number, up: number) {
    const h = this.heading(distance);
    return Matrix4.multiplyByPoint(
      this.frame(distance),
      new Cartesian3(
        forward * Math.cos(h) - side * Math.sin(h),
        forward * Math.sin(h) + side * Math.cos(h),
        up,
      ),
      new Cartesian3(),
    );
  }
  async sampleHeights(provider: TerrainProvider) {
    const positions = this.samples.map((s) =>
      Cartographic.fromDegrees(s.longitude, s.latitude),
    );
    const elevations = await sampleTerrain(provider, 14, positions);
    if (elevations.some((p) => !Number.isFinite(p.height)))
      throw new Error("Terrain elevation samples are incomplete.");
    // The source line is 2D. Smooth sampled terrain over a ~350 m window, then
    // add an explicitly approximate viaduct clearance. This is not surveyed rail height.
    this.samples.forEach((s, i) => {
      let weight = 0,
        sum = 0;
      this.samples.forEach((other, j) => {
        const w = Math.max(0, 1 - Math.abs(other.distance - s.distance) / 175);
        sum += elevations[j].height * w;
        weight += w;
      });
      s.height = sum / weight + 7.2;
    });
  }
}
export async function loadRoute() {
  const response = await fetch(
    `${import.meta.env.BASE_URL}data/fuji-railways.geojson`,
  );
  if (!response.ok) throw new Error("Railway source could not load.");
  const data = await response.json();
  const line = data.features.find(
    (f: { properties: Record<string, string> }) =>
      f.properties["路線名"] === "東海道新幹線",
  );
  if (!line)
    throw new Error("The Tokaido Shinkansen is absent from the source.");
  return new GeoRoute(line.geometry.coordinates);
}
