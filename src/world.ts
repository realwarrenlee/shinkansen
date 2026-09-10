import * as T from 'three';
import { Route, ROUTE_LENGTH, TRACK_HEIGHT } from './route';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const box = new T.BoxGeometry(1, 1, 1);
const dummy = new T.Object3D();
type Placement = { p: T.Vector3; s: T.Vector3; r?: number; c?: T.Color };
function mat(color: string | number, roughness = .85) { return new T.MeshStandardMaterial({ color, roughness }); }
let seed = 874321;
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function batch(scene: T.Scene, geo: T.BufferGeometry, material: T.Material, placements: Placement[], shadow = false) {
  const m = new T.InstancedMesh(geo, material, placements.length);
  placements.forEach((v, i) => {
    dummy.position.copy(v.p); dummy.scale.copy(v.s); dummy.rotation.set(0, v.r || 0, 0); dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix); if (v.c) m.setColorAt(i, v.c);
  });
  m.receiveShadow = true; m.castShadow = shadow; m.computeBoundingSphere(); scene.add(m); return m;
}
function entry(p: T.Vector3, x: number, y: number, z: number, r = 0, c?: T.Color): Placement {
  return { p, s: new T.Vector3(x, y, z), r, c };
}
function ribbon(route: Route, offset: number, width: number, height: number, material: T.Material, start = -310, end = 5740) {
  const vs: number[] = [], idx: number[] = [];
  const count = Math.ceil((end - start) / 10);
  for (let i = 0; i <= count; i++) {
    const d = start + (end - start) * i / count;
    for (const s of [-1, 1]) {
      const p = route.offset(d, offset + s * width / 2, height);
      vs.push(p.x, p.y, p.z);
    }
    if (i < count) { const k = i * 2; idx.push(k, k+2, k+1, k+1, k+2, k+3); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vs, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new T.Mesh(g, material); m.receiveShadow = true; return m;
}
function mountain(scene: T.Scene, cx: number, cz: number, radius: number, height: number, snowy: boolean, color: string) {
  const rings = 100, segments = 160, vs: number[] = [], colors: number[] = [], idx: number[] = [];
  const base = new T.Color(color), snow = new T.Color('#e7eef0');
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, r = 70 + t * radius;
    for (let j = 0; j <= segments; j++) {
      const a = j / segments * Math.PI * 2;
      const ridge = Math.sin(a*19 + t*4)*.03 + Math.sin(a*43 - t*9)*.012 + Math.sin(a*83+t*37)*.006;
      const y = height * Math.pow(1-t, 1.75) * (1 + ridge * (t*4+.2));
      vs.push(cx + Math.cos(a)*r, y-14, cz+Math.sin(a)*r);
      const threshold = .69 + .09*Math.sin(a*13)+.035*Math.sin(a*37);
      const c = base.clone();
      c.multiplyScalar(.92 + .12*Math.sin(a*19+t*6) + .035*Math.sin(t*320+a*81));
      if (snowy && y / height > threshold) c.lerp(snow, T.MathUtils.smoothstep(y/height, threshold, threshold+.045));
      colors.push(c.r,c.g,c.b);
      if (i < rings && j < segments) { const k=i*(segments+1)+j; idx.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1); }
    }
  }
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(vs,3)); g.setAttribute('color',new T.Float32BufferAttribute(colors,3)); g.setIndex(idx); g.computeVertexNormals();
  const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide})); scene.add(m);
}

function sky(scene: T.Scene) {
  const mesh = new T.Mesh(new T.SphereGeometry(15000,32,16), new T.ShaderMaterial({
    side:T.BackSide, depthWrite:false,
    vertexShader:`varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vDir;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);vec3 col=mix(vec3(.86,.90,.90),vec3(.43,.66,.82),pow(h,.5));
    vec2 p=d.xz/(h+.13)*2.2;float n=noise(p)*.55+noise(p*2.)*.25+noise(p*4.)*.12+noise(p*8.)*.08;
    float cloud=smoothstep(.47,.72,n)*smoothstep(.02,.18,h)*.63; col=mix(col,vec3(.97,.98,.97),cloud); gl_FragColor=vec4(col,1.);}`,
  })); scene.add(mesh);
}

export function createWorld(scene: T.Scene, route: Route) {
  seed=874321; sky(scene);
  scene.fog = new T.FogExp2('#c8d9de', .00011);
  const groundMat = new T.MeshStandardMaterial({color:'#8c9e75',roughness:1});
  groundMat.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vWorld;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader = 'varying vec3 vWorld;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat rows=sin(vWorld.x*3.4)*sin(vWorld.z*.11); diffuseColor.rgb*=.96+rows*.055;');
  };
  const ground = new T.Mesh(new T.PlaneGeometry(24000,24000),groundMat); ground.rotation.x=-Math.PI/2; ground.position.y=-.15; ground.receiveShadow=true; scene.add(ground);
  mountain(scene,1500,-6100,3450,1870,true,'#728b9b');
  for (let i=0;i<12;i++) mountain(scene,-6400+i*1150,-3500-rand()*900,1000+rand()*800,250+rand()*330,false,'#6f8b82');
  const fields:Placement[]=[], paths:Placement[]=[], trunks:Placement[]=[], leaves:Placement[]=[], houses:Placement[]=[], roofs:Placement[]=[], windows:Placement[]=[];
  for (let x=-3300;x<3350;x+=90) {
    for(let z=-1450;z<1000;z+=100) {
      const trackZ=72*Math.sin(x/1000);
      if(Math.abs(z-trackZ)<32) continue;
      const tone=new T.Color().setHSL(.20+rand()*.045,.18+rand()*.18,.40+rand()*.13);
      fields.push(entry(new T.Vector3(x+rand()*9,.01,z),85,.04,92,0,tone));
      if(rand()>.80) paths.push(entry(new T.Vector3(x,.09,z),2,.08,100));
      const settlement = x < -800 || rand()>.67;
      if(settlement && rand()>.64) {
        const hx=x+rand()*30, hz=z+rand()*30, h=4+rand()*4, w=7+rand()*5, d=7+rand()*6;
        houses.push(entry(new T.Vector3(hx,h/2,hz),w,h,d,0,new T.Color().setHSL(.10,.06,.66+rand()*.20)));
        roofs.push(entry(new T.Vector3(hx,h+.9,hz),w+1,2.4,d+1));
        for(let win=-1;win<=1;win++) windows.push(entry(new T.Vector3(hx+win*w*.25,h*.62,hz+d*.5+.02),1.3,1.5,.06));
      }
      if(rand()>.57) for(let k=0;k<3;k++) {
        const tx=x+rand()*70,tz=z+rand()*70,h=4+rand()*6;
        trunks.push(entry(new T.Vector3(tx,h*.32,tz),.5,h*.64,.5));
        const c=new T.Color().setHSL(.24+rand()*.09,.18+rand()*.14,.22+rand()*.11);
        leaves.push(entry(new T.Vector3(tx,h*.75,tz),h*.65,h*.7,h*.6,rand()*6,c));
        leaves.push(entry(new T.Vector3(tx+1.3,h*.62,tz+.8),h*.6,h*.6,h*.55,rand()*6,c));
      }
    }
  }
  batch(scene,box,groundMat,fields); batch(scene,box,mat('#b0b2a0'),paths);
  const foliage=batch(scene,new T.IcosahedronGeometry(1,1),mat('#ffffff'),leaves);
  batch(scene,box,mat('#645e4c'),trunks); batch(scene,box,mat('#ffffff'),houses,true);
  const roofGeo=new T.BufferGeometry();
  roofGeo.setAttribute('position',new T.Float32BufferAttribute([-.5,-.5,-.5,.5,-.5,-.5,0,.5,-.5,-.5,-.5,.5,.5,-.5,.5,0,.5,.5],3));
  roofGeo.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,2,5,4,2,4,1,0,1,4,0,4,3]);roofGeo.computeVertexNormals();
  batch(scene,roofGeo,mat('#586668'),roofs,true);batch(scene,box,mat('#415a60'),windows);

  const deck:Placement[]=[], piers:Placement[]=[], ties:Placement[]=[], poles:Placement[]=[], cross:Placement[]=[], fence:Placement[]=[];
  for(let d=-300;d<5740;d+=20) {
    const yaw=route.yaw(d);
    deck.push(entry(route.offset(d,2.45,-.65),20.15,1.2,10.9,yaw));
    piers.push(entry(route.offset(d,2.45,-3.8),1.4,4.6,7,yaw));
  }
  for(let d=-300;d<5740;d+=1.6) for(const side of [0,5]) ties.push(entry(route.offset(d,side,.03),.28,.17,2.6,route.yaw(d)));
  for(let d=-300;d<5740;d+=45) {
    if(d>3650 && d<4050) continue;
    poles.push(entry(route.offset(d,-3.8,4.5),.24,9,.24));
    cross.push(entry(route.offset(d,.7,8.7),.14,.14,9.5,route.yaw(d)));
    for(const side of [-3.8,8.6]) fence.push(entry(route.offset(d,side,.5),.14,1,.14));
  }
  batch(scene,box,mat('#b2b3a9'),deck);batch(scene,box,mat('#a0a69e'),piers);
  batch(scene,box,mat('#7c827b'),ties); batch(scene,box,mat('#73807d'),poles); batch(scene,box,mat('#6d7979'),cross);
  batch(scene,box,mat('#a5afa7'),fence);
  for(const side of [0,5]) {
    scene.add(ribbon(route,side,3.6,-.025,mat('#81857a')));
    for(const rail of [-.7175,.7175]) scene.add(ribbon(route,side+rail,.075,.20,new T.MeshStandardMaterial({color:'#b9c5c7',metalness:.8,roughness:.28})));
    scene.add(ribbon(route,side,.028,8.3,mat('#5e7477')));
  }
  for(const side of [-3.8,8.6]) scene.add(ribbon(route,side,.11,.95,mat('#8e9a94')));
  // Departure platform and a sparse roof structure, on the far side of the tracks.
  const platform:Placement[]=[], canopy:Placement[]=[], supports:Placement[]=[];
  for(let d=-180;d<280;d+=20) {
    platform.push(entry(route.offset(d,-8,.1),20,1.4,6,route.yaw(d)));
    if(d<100) canopy.push(entry(route.offset(d,-8,5.8),20.1,.25,7,route.yaw(d)));
    if(d%40===0) supports.push(entry(route.offset(d,-9,3),.25,5.7,.25));
  }
  batch(scene,box,mat('#c2bfb0'),platform);batch(scene,box,mat('#687f84'),canopy);batch(scene,box,mat('#8a9691'),supports);
  // Tunnel shell with real openings and a grassy covering.
  const tunnelVs:number[]=[], tunnelIdx:number[]=[];
  const start=3650,end=4050, sections=80, arc=32, radius=12;
  for(let i=0;i<=sections;i++) {
    const d=start+(end-start)*i/sections;
    for(let j=0;j<=arc;j++) {
      const a=j/arc*Math.PI;
      const p=route.offset(d,2.5+Math.cos(a)*radius,Math.sin(a)*radius-.5);
      tunnelVs.push(p.x,p.y,p.z);
      if(i<sections && j<arc) {const k=i*(arc+1)+j;tunnelIdx.push(k,k+1,k+arc+1,k+1,k+arc+2,k+arc+1);}
    }
  }
  const tg=new T.BufferGeometry();tg.setAttribute('position',new T.Float32BufferAttribute(tunnelVs,3));tg.setIndex(tunnelIdx);tg.computeVertexNormals();
  const tunnel=new T.Mesh(tg,new T.MeshStandardMaterial({color:'#626b66',roughness:1,side:T.DoubleSide}));scene.add(tunnel);
  const tunnelLamps:Placement[]=[];
  for(let d=start;d<end;d+=20) tunnelLamps.push(entry(route.offset(d,2.5,11.2),3,.08,.2));
  batch(scene,box,new T.MeshBasicMaterial({color:'#ffe5a8'}),tunnelLamps);
  const portalGeos:T.BufferGeometry[]=[];
  for(const d of [start,end]) {
    const g=new T.TorusGeometry(12.5,.7,8,48,Math.PI);
    g.rotateY(Math.PI/2);g.rotateY(route.yaw(d));
    const p=route.offset(d,2.5,-.5);g.translate(p.x,p.y,p.z);portalGeos.push(g);
  }
  scene.add(new T.Mesh(mergeGeometries(portalGeos),mat('#b2b8af')));
  const cover=new T.Mesh(new T.CylinderGeometry(22,35,410,24,1,true,0,Math.PI),mat('#72866b'));
  cover.rotation.z=Math.PI/2;cover.position.copy(route.offset((start+end)/2,2.5,11));
  // Keep the bore visible; a broad wooded ridge sits behind it rather than closing the openings.
  mountain(scene,route.point(3850).x,-250,410,120,false,'#6d826b');
  return { foliage, ground, tunnel, totalLength: ROUTE_LENGTH, trackHeight: TRACK_HEIGHT };
}
