import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Route } from './route';

export async function createTrain(scene: THREE.Scene, route: Route) {
  const loader = new GLTFLoader();
  const [lead, middle] = await Promise.all([
    loader.loadAsync(`${import.meta.env.BASE_URL}assets/lead.glb`),
    loader.loadAsync(`${import.meta.env.BASE_URL}assets/middle.glb`),
  ]);
  const cars: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const root = new THREE.Group();
    const model = (i === 0 || i === 7 ? lead.scene : middle.scene).clone(true);
    if (i === 7) model.rotation.y = Math.PI;
    model.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    root.add(model); scene.add(root); cars.push(root);
  }
  function update(distance: number) {
    cars.forEach((car, i) => {
      const d = distance - i * 25.15;
      car.position.copy(route.point(d));
      car.position.y += .23;
      car.rotation.y = route.yaw(d);
    });
  }
  update(0);
  return { cars, update };
}
