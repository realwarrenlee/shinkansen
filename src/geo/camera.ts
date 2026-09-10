import {
  Cartesian3,
  Math as CM,
  Matrix4,
  PerspectiveFrustum,
  type Viewer,
} from "cesium";
import { GeoRoute } from "./route";
export class GeoCamera {
  settled = false;
  position = new Cartesian3();
  target = new Cartesian3();
  constructor(
    private viewer: Viewer,
    private route: GeoRoute,
    private reduced: boolean,
  ) {}
  update(distance: number, dt: number) {
    // Keep the same north-facing Scenic composition in either travel direction.
    if (this.viewer.camera.frustum instanceof PerspectiveFrustum)
      this.viewer.camera.frustum.fov = CM.toRadians(72);
    const pos = Matrix4.multiplyByPoint(
      this.route.frame(distance),
      new Cartesian3(-110, -420, 90),
      new Cartesian3(),
    );
    const look = this.route.local(distance, -40, 0, 0);
    const k = !this.settled || this.reduced ? 1 : 1 - Math.exp(-dt * 5);
    Cartesian3.lerp(this.position, pos, k, this.position);
    Cartesian3.lerp(this.target, look, k, this.target);
    const direction = Cartesian3.normalize(
      Cartesian3.subtract(this.target, this.position, new Cartesian3()),
      new Cartesian3(),
    );
    const geodeticUp = Cartesian3.normalize(this.position, new Cartesian3());
    const right = Cartesian3.normalize(
      Cartesian3.cross(direction, geodeticUp, new Cartesian3()),
      new Cartesian3(),
    );
    const up = Cartesian3.normalize(
      Cartesian3.cross(right, direction, new Cartesian3()),
      new Cartesian3(),
    );
    this.viewer.camera.setView({
      destination: this.position,
      orientation: { direction, up },
    });
    this.settled = true;
  }
}
