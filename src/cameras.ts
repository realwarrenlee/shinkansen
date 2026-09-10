import * as T from 'three';
import { Route } from './route';
export type CameraMode = 'follow' | 'scenic' | 'trackside';
export class CameraRig {
  mode: CameraMode = 'follow';
  target = new T.Vector3();
  passDistance: number | null = null;
  settled = false;
  constructor(public camera: T.PerspectiveCamera, private route: Route, private reduced: boolean) {}
  select(mode: CameraMode, distance: number) {
    this.mode=mode;this.passDistance=mode==='trackside'?distance+110:null;
  }
  reset() { this.settled=false;this.passDistance=null;if(this.mode==='trackside')this.mode='follow'; }
  update(distance:number,speed:number,dt:number,mobile:boolean) {
    let pos:T.Vector3,look:T.Vector3;
    const tunnel=distance>3600 && distance<4090;
    if(tunnel) {
      pos=this.route.offset(distance+20,3.8,5.5);look=this.route.offset(distance-45,0,2);
    } else if(this.mode==='trackside' && this.passDistance!==null) {
      pos=this.route.offset(this.passDistance,20,3.5);look=this.route.offset(distance,0,2.2);
      if(distance>this.passDistance+175 || distance<this.passDistance-350) this.select('follow',distance);
    } else if(this.mode==='scenic') {
      pos=this.route.offset(distance+85,mobile?190:185,mobile?64:62);look=this.route.offset(distance-58,0,24);
    } else {
      pos=this.route.offset(distance+(mobile?39:46),mobile?90:94,mobile?26:27);
      look=this.route.offset(distance-(mobile?17:46),0,mobile?16:21);
    }
    const k=this.reduced||!this.settled?1:1-Math.exp(-dt*(tunnel?7:3));
    this.camera.position.lerp(pos,k);this.target.lerp(look,k);this.camera.lookAt(this.target);
    const fov=this.mode==='scenic'?48:(this.reduced?47:46+Math.min(1,speed/83.33)*4);
    this.camera.fov=T.MathUtils.lerp(this.camera.fov,fov,k);this.camera.updateProjectionMatrix();this.settled=true;
  }
}
