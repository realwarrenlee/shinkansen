import './prototype.css';
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Route, ROUTE_LENGTH, chapters, chapterAt } from './route';
import { Motion } from './motion';
import { createWorld } from './world';
import { createTrain } from './train';
import { CameraRig, type CameraMode } from './cameras';
import { JourneyAudio } from './audio';

const el = <E extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as E;
const icons = {
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
  pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>',
  restart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8a8 8 0 1 1-1 7M5 3v5h5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sound:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8q4 4 0 8M20 5q6 7 0 14" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  muted:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
el('play').innerHTML=icons.pause; el('restart').innerHTML=icons.restart;el('sound').innerHTML=icons.muted;
const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=reducedQuery.matches;
const motion=new Motion(ROUTE_LENGTH);motion.paused=reduced;
const route=new Route(), audio=new JourneyAudio();
let quality='auto', autoLow=false;
let renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,rig:CameraRig,train:Awaited<ReturnType<typeof createTrain>>,world:ReturnType<typeof createWorld>;
let frame=0,last=0,uiElapsed=0,noticeTimer=0,disposed=false;
let fpsSamples:number[]=[], frameCount=0;
let sun:T.DirectionalLight,ambient:T.HemisphereLight;
let envTarget:T.WebGLRenderTarget;
const listeners=new AbortController();
function listen(target:EventTarget,type:string,fn:EventListener) {target.addEventListener(type,fn,{signal:listeners.signal});}
function notify(message:string) {
  el('notice').textContent=message;el('notice').classList.add('visible');clearTimeout(noticeTimer);
  noticeTimer=window.setTimeout(()=>el('notice').classList.remove('visible'),2800);
}
function applyQuality() {
  const low=quality==='low'||quality==='auto'&&(autoLow||innerWidth<641);
  renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.5));renderer.shadowMap.enabled=!low;
  sun.castShadow=!low;
}
function resize() {camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);applyQuality();rig.reset();}
function togglePlayback() {
  if(motion.ended){motion.restart();rig.reset();}else motion.paused=!motion.paused;
  updateUI();
}
function updateUI() {
  const p=motion.distance/ROUTE_LENGTH;
  el('speed-value').textContent=String(Math.round(motion.speed*3.6));
  el('speed-unit').textContent='km/h';
  el('status').textContent=motion.ended?'ARRIVED':motion.paused?'PAUSED':motion.speed<.1?'DEPARTING':motion.acceleration>.15?'ACCELERATING':motion.acceleration<-.15?'SLOWING DOWN':'CRUISING';
  el('play').innerHTML=motion.paused||motion.ended?icons.play:icons.pause;
  el('play').setAttribute('aria-label',motion.ended?'Replay journey':motion.paused?'Resume journey':'Pause journey');
  document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===rig.mode)));
  document.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach((b,i)=>{if(i===chapterAt(p))b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  el('route-fill').style.width=`${p*100}%`;
}
async function start() {
  try {
    renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
    renderer.shadowMap.type=T.PCFShadowMap;
    el('scene').appendChild(renderer.domElement);
    scene=new T.Scene();camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.15,20000);
    const pmrem=new T.PMREMGenerator(renderer);const room=new RoomEnvironment();envTarget=pmrem.fromScene(room,.04);scene.environment=envTarget.texture;scene.environmentIntensity=.52;room.dispose();pmrem.dispose();
    ambient=new T.HemisphereLight('#d8e9ef','#798269',2.0);scene.add(ambient);
    sun=new T.DirectionalLight('#fff4dd',3.2);sun.position.set(100,160,80);sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.left=-150;sun.shadow.camera.right=150;sun.shadow.camera.top=150;sun.shadow.camera.bottom=-150;sun.shadow.camera.near=1;sun.shadow.camera.far=500;sun.shadow.normalBias=.08;scene.add(sun,sun.target);
    world=createWorld(scene,route);
    train=await createTrain(scene,route);
    rig=new CameraRig(camera,route,reduced);resize();
    // Optional deterministic starting chapter, useful for sharing views and QA.
    const params=new URLSearchParams(location.search);const chapter=Number(params.get('chapter'));
    if(params.has('chapter')&&Number.isInteger(chapter)&&chapter>=0&&chapter<5)motion.seek(chapters[chapter].position*ROUTE_LENGTH);
    if(params.get('paused')==='1')motion.paused=true;
    document.body.classList.add('journey-entered');el('loading').hidden=true;updateUI();
    listen(window,'resize',resize);
    listen(el('play'),'click',togglePlayback);
    listen(el('restart'),'click',()=>{motion.restart();motion.paused=reduced;rig.reset();notify('Back to the beginning.');updateUI();});
    document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(b=>listen(b,'click',()=>{rig.select(b.dataset.camera as CameraMode,motion.distance);updateUI();}));
    document.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach(b=>listen(b,'click',()=>{
      const i=Number(b.dataset.chapter),distance=chapters[i].position*ROUTE_LENGTH;
      motion.seek(distance);rig.reset();
      notify(chapters[i].name);updateUI();
    }));
    listen(el('quality'),'change',()=>{quality=el<HTMLSelectElement>('quality').value;applyQuality();notify(`Graphics: ${quality}`);});
    listen(el('sound'),'click',()=>{void audio.toggle().then(enabled=>{el('sound').innerHTML=enabled?icons.sound:icons.muted;el('sound').setAttribute('aria-pressed',String(enabled));el('sound').setAttribute('aria-label',enabled?'Mute sound':'Enable sound');el('sound').title=enabled?'Mute sound':'Enable sound';}).catch(()=>notify('Sound is unavailable in this browser.'));});
    listen(window,'keydown',(event)=>{const e=event as KeyboardEvent;const tag=(e.target as HTMLElement).tagName;if(e.code==='Space'&&!['INPUT','BUTTON','SELECT','TEXTAREA'].includes(tag)){e.preventDefault();togglePlayback();}});
    listen(document,'visibilitychange',()=>{last=0;if(document.hidden)audio.update(0,true,false);});
    listen(reducedQuery,'change',()=>{reduced=reducedQuery.matches;if(reduced)motion.paused=true;rig=new CameraRig(camera,route,reduced);updateUI();});
    listen(renderer.domElement,'webglcontextlost',(e)=>{e.preventDefault();cancelAnimationFrame(frame);el('loading').hidden=false;el('loading-message').textContent='The graphics connection was interrupted. Reload the journey to continue.';el('retry').hidden=false;});
    frame=requestAnimationFrame(animate);
  }catch(error){
    console.error(error);el('loading-message').textContent='The 3D scene could not load. Check your connection and that hardware acceleration is enabled, then try again.';el('retry').hidden=false;
  }
}
function animate(now:number) {
  if(disposed)return;
  frame=requestAnimationFrame(animate);
  if(document.hidden){last=0;return;}
  const dt=last?Math.min((now-last)/1000,.1):1/60;last=now;
  motion.update(dt);
  const tunnel=motion.distance>3650&&motion.distance<4050;
  document.body.classList.toggle('tunnel',tunnel);
  train.update(motion.distance);rig.update(motion.distance,motion.speed,dt,innerWidth<641);
  const center=route.point(motion.distance-40);sun.target.position.copy(center);sun.position.copy(center).add(new T.Vector3(70,160,100));
  ambient.intensity=T.MathUtils.damp(ambient.intensity,tunnel?.32:2,3,dt);sun.intensity=T.MathUtils.damp(sun.intensity,tunnel?.35:3.2,3,dt);
  audio.update(motion.speed,motion.paused||motion.ended,tunnel);
  renderer.render(scene,camera);
  uiElapsed+=dt;if(uiElapsed>.1){updateUI();uiElapsed=0;}
  if(frameCount++>180){fpsSamples.push(dt);if(fpsSamples.length>120)fpsSamples.shift();if(quality==='auto'&&!autoLow&&fpsSamples.length===120&&fpsSamples.reduce((a,b)=>a+b,0)/120>.026){autoLow=true;applyQuality();}}
}
listen(el('retry'),'click',()=>location.reload());
listen(window,'pagehide',()=>{
  disposed=true;cancelAnimationFrame(frame);clearTimeout(noticeTimer);listeners.abort();audio.dispose();
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
  scene?.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());envTarget?.dispose();renderer?.dispose();
});
// Read-only diagnostics: browser QA can inspect state without bypassing the UI.
Object.defineProperty(window,'journeyDebug',{get:()=>({distance:motion.distance,speed:motion.speed,acceleration:motion.acceleration,paused:motion.paused,ended:motion.ended,mode:'ride',camera:rig?.mode,quality:quality==='auto'?(autoLow||innerWidth<641?'auto-low':'auto-high'):quality,drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,geometries:renderer?.info.memory.geometries,textures:renderer?.info.memory.textures,fps:fpsSamples.length?1/(fpsSamples.reduce((a,b)=>a+b,0)/fpsSamples.length):null,ready:el('loading').hidden})});
void start();
