import {
  Axis,
  Cartesian2,
  Cartesian3,
  Color,
  GeometryInstance,
  HeadingPitchRoll,
  Matrix4,
  Model,
  PerInstanceColorAppearance,
  PolylineVolumeGeometry,
  Primitive,
  Transforms,
  ColorGeometryInstanceAttribute,
  CylinderGeometry,
  type Viewer,
} from "cesium";
import { GeoRoute } from "./route";
import { formation, type TrainManifest } from "./formation";
function volume(
  viewer: Viewer,
  points: Cartesian3[],
  width: number,
  height: number,
  color: Color,
) {
  const shape = [
    new Cartesian2(-width / 2, -height),
    new Cartesian2(width / 2, -height),
    new Cartesian2(width / 2, 0),
    new Cartesian2(-width / 2, 0),
  ];
  const instance = new GeometryInstance({
    geometry: new PolylineVolumeGeometry({
      polylinePositions: points,
      shapePositions: shape,
      vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
    }),
    attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
  });
  viewer.scene.primitives.add(
    new Primitive({
      geometryInstances: instance,
      appearance: new PerInstanceColorAppearance({
        closed: true,
        translucent: false,
      }),
      asynchronous: true,
    }),
  );
}
export function createRailway(viewer: Viewer, route: GeoRoute) {
  const sides = [0, 4.3],
    count = Math.ceil((route.length + 500) / 12);
  const points = (side: number, up: number) =>
    Array.from({ length: count + 1 }, (_, i) =>
      route.local(-410 + ((route.length + 500) * i) / count, 0, side, up),
    );
  volume(
    viewer,
    points(2.15, -0.35),
    9.4,
    1.05,
    Color.fromCssColorString("#92948d"),
  );
  sides.forEach((side) => {
    volume(
      viewer,
      points(side, -0.05),
      3.2,
      0.22,
      Color.fromCssColorString("#565f60"),
    );
    for (const rail of [-0.7175, 0.7175])
      volume(
        viewer,
        points(side + rail, 0.08),
        0.08,
        0.15,
        Color.fromCssColorString("#b8bec0"),
      );
    volume(
      viewer,
      points(side, 5.5),
      0.018,
      0.018,
      Color.fromCssColorString("#464e4d"),
    );
    volume(
      viewer,
      points(side, 6.12),
      0.022,
      0.022,
      Color.fromCssColorString("#464e4d"),
    );
  });
  for (const side of [-2.7, 7.0])
    volume(
      viewer,
      points(side, 0.75),
      0.16,
      1,
      Color.fromCssColorString("#a8aaa1"),
    );
  const piers: GeometryInstance[] = [],
    poles: GeometryInstance[] = [];
  for (let d = -400; d < route.length + 80; d += 32) {
    piers.push(
      new GeometryInstance({
        geometry: new CylinderGeometry({
          length: 5.8,
          topRadius: 0.85,
          bottomRadius: 0.85,
          slices: 8,
          vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        modelMatrix: Transforms.eastNorthUpToFixedFrame(
          route.local(d, 0, 2.15, -4),
        ),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(
            Color.fromCssColorString("#919891"),
          ),
        },
      }),
    );
    poles.push(
      new GeometryInstance({
        geometry: new CylinderGeometry({
          length: 7.7,
          topRadius: 0.09,
          bottomRadius: 0.12,
          slices: 6,
          vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        modelMatrix: Transforms.eastNorthUpToFixedFrame(
          route.local(d, 0, 6.4, 3.7),
        ),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(
            Color.fromCssColorString("#65716e"),
          ),
        },
      }),
    );
    poles.push(
      new GeometryInstance({
        geometry: new CylinderGeometry({
          length: 8.6,
          topRadius: 0.055,
          bottomRadius: 0.055,
          slices: 6,
          vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        modelMatrix: Transforms.headingPitchRollToFixedFrame(
          route.local(d, 0, 2.15, 6.15),
          new HeadingPitchRoll(-route.heading(d), 0, Math.PI / 2),
        ),
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(
            Color.fromCssColorString("#65716e"),
          ),
        },
      }),
    );
    for (const side of sides)
      poles.push(
        new GeometryInstance({
          geometry: new CylinderGeometry({
            length: 0.65,
            topRadius: 0.015,
            bottomRadius: 0.015,
            slices: 4,
            vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
          }),
          modelMatrix: Transforms.eastNorthUpToFixedFrame(
            route.local(d, 0, side, 5.82),
          ),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(
              Color.fromCssColorString("#464e4d"),
            ),
          },
        }),
      );
  }
  for (const instances of [piers, poles])
    viewer.scene.primitives.add(
      new Primitive({
        geometryInstances: instances,
        appearance: new PerInstanceColorAppearance({
          closed: true,
          translucent: false,
        }),
        asynchronous: true,
      }),
    );
}
export async function createGeoTrain(
  viewer: Viewer,
  route: GeoRoute,
  onProgress?: (completed: number, total: number) => void,
) {
  const cars: Model[] = [];
  const manifestResponse = await fetch(
    `${import.meta.env.BASE_URL}assets/train-manifest.json`,
  );
  if (!manifestResponse.ok) throw new Error("Train manifest could not load.");
  const manifest: TrainManifest = await manifestResponse.json();
  const layout = formation(manifest);
  // Preload the opposite lamp variants, so changing cabs never interrupts a ride.
  const returnEnds = new Map<number, Model>();
  async function loadCar(file: string) {
    const car = await Model.fromGltfAsync({
      url: `${import.meta.env.BASE_URL}assets/${file}`,
      modelMatrix: Matrix4.IDENTITY,
      forwardAxis: Axis.X,
      scale: manifest.scale,
      allowPicking: false,
      incrementallyLoadTextures: false,
      lightColor: new Cartesian3(1.2, 1.2, 1.2),
      cull: true,
    });
    viewer.scene.primitives.add(car);
    return car;
  }
  let completed = 0;
  const promises = layout.map(async (item, i) => {
    cars[i] = await loadCar(item.file);
    onProgress?.(++completed, layout.length);
  });
  const alternatePromises = [0, layout.length - 1].map(async (i) => {
    const car = await loadCar(i === 0 ? manifest.tail : manifest.lead);
    returnEnds.set(i, car);
  });
  await Promise.all([...promises, ...alternatePromises]);
  function setDirection(direction: 1 | -1) {
    returnEnds.forEach((alternate, i) => {
      cars[i].show = direction === 1;
      alternate.show = direction === -1;
    });
  }
  function update(distance: number) {
    cars.forEach((car, i) => {
      const item = layout[i],
        d = distance - item.offset,
        h = route.heading(d) + (item.reversed ? Math.PI : 0);
      const halfBogie = 8.75;
      const grade = Math.atan2(
        route.at(d + halfBogie).height - route.at(d - halfBogie).height,
        halfBogie * 2,
      );
      car.modelMatrix = Transforms.headingPitchRollToFixedFrame(
        route.point(d, manifest.verticalOffset),
        new HeadingPitchRoll(-h, item.reversed ? -grade : grade, 0),
      );
      const alternate = returnEnds.get(i);
      if (alternate) alternate.modelMatrix = car.modelMatrix;
    });
  }
  update(0);
  return { cars, update, setDirection, source: manifest.source };
}
