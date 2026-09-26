import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  Viewer,
  CesiumTerrainProvider,
  UrlTemplateImageryProvider,
  ImageryLayer,
  Cesium3DTileset,
  Color,
  JulianDate,
  Rectangle,
  Ion,
  Credit,
} from "cesium";
import { loadRoute, type GeoRoute } from "./route";
import { createGeoTrain, createRailway } from "./railway";
import { GeoCamera } from "./camera";
import { Motion } from "../motion";
import { JourneyAudio } from "../audio";
import { waitForLandscape } from "./loading";
import {
  setLoadingStage,
  setLoadingProgress,
  showLoadingError,
} from "./loading-ui";
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const icons = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>',
};
const chapterPositions = [0, 0.22, 0.45, 0.68, 0.93];
el("scene").setAttribute(
  "aria-label",
  "Real Fuji City terrain, aerial imagery, and buildings with an animated Shinkansen model",
);
el("play").innerHTML = icons.pause;
let viewer: Viewer,
  route: GeoRoute,
  motion: Motion,
  rig: GeoCamera,
  train: Awaited<ReturnType<typeof createGeoTrain>>,
  buildings: Cesium3DTileset;
let last = 0,
  uiTime = 0,
  frame = 0,
  noticeTimer = 0,
  autoLow = false;
let ready = false,
  tilesReady = false,
  terrainReady = false,
  imageryFailed = false;
let refinement = 0;
const audio = new JourneyAudio(),
  reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduced = reducedQuery.matches;
const controller = new AbortController();
const listen = (target: EventTarget, type: string, fn: EventListener) =>
  target.addEventListener(type, fn, { signal: controller.signal });
// Try autoplay, then unlock Web Audio on a gesture when the browser requires it.
function enableAudio() {
  if (audio.context?.state === "running") return;
  void audio.enable().catch(() => {});
}
enableAudio();
listen(window, "pointerdown", enableAudio);
listen(window, "keydown", enableAudio);
function notice(text: string) {
  el("notice").textContent = text;
  el("notice").classList.add("visible");
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(
    () => el("notice").classList.remove("visible"),
    3200,
  );
}
function status() {
  el("geo-status").textContent = imageryFailed
    ? "Some aerial imagery is unavailable."
    : tilesReady
      ? "Real terrain · Aerial imagery · Fuji City buildings"
      : "Real terrain · Aerial imagery · Buildings streaming";
}
function qualityUpdate() {
  const low = autoLow || innerWidth < 641;
  viewer.resolutionScale = low ? 0.8 : Math.min(1.25, devicePixelRatio);
  viewer.scene.globe.maximumScreenSpaceError =
    8 + ((low ? 3 : 1.5) - 8) * refinement;
  if (buildings)
    buildings.maximumScreenSpaceError = 32 + ((low ? 16 : 6) - 32) * refinement;
  viewer.scene.fog.density = 0.00002;
}
async function streamBuildings() {
  try {
    const b = await Cesium3DTileset.fromUrl(
      "https://api.plateauview.mlit.go.jp/datacatalog/3dtiles/22210-bldg-maxlod2-latest/tileset.json",
      {
        maximumScreenSpaceError: 32,
        showCreditsOnScreen: false,
        cacheBytes: 128 * 1024 * 1024,
        maximumCacheOverflowBytes: 64 * 1024 * 1024,
      },
    );
    if (controller.signal.aborted) {
      b.destroy();
      return;
    }
    buildings = b;
    viewer.scene.primitives.add(b);
    viewer.creditDisplay.addStaticCredit(
      new Credit(
        '<a href="https://www.mlit.go.jp/plateau/">Buildings: Fuji City / Project PLATEAU (2023)</a>',
        false,
      ),
    );
    b.initialTilesLoaded.addEventListener(() => {
      tilesReady = true;
      status();
    });
    b.tileFailed.addEventListener(() => {
      el("geo-status").textContent = "Some Fuji City buildings could not load.";
    });
    qualityUpdate();
  } catch {
    if (!controller.signal.aborted)
      el("geo-status").textContent =
        "Fuji City buildings are unavailable. The ride is still available.";
  }
}
function play() {
  if (motion.ended) {
    motion.depart();
    train.setDirection(motion.direction);
  } else motion.paused = !motion.paused;
  ui();
}
function ui() {
  if (!ready) return;
  el("speed-value").textContent = String(Math.round(motion.speed * 3.6));
  el("speed-unit").textContent = "km/h";
  el("status").textContent = motion.ended
    ? "ARRIVED"
    : motion.paused
      ? "PAUSED"
      : motion.speed < 0.1
        ? "DEPARTING"
        : motion.acceleration > 0.15
          ? "ACCELERATING"
          : motion.acceleration < -0.15
            ? "SLOWING DOWN"
            : "CRUISING";
  el("play").innerHTML =
    motion.paused || motion.ended ? icons.play : icons.pause;
  el("play").setAttribute(
    "aria-label",
    motion.ended
      ? "Play return journey"
      : motion.paused
        ? "Resume journey"
        : "Pause journey",
  );
  // Read-only DOM instrumentation for repeatable browser QA.
  const debug = el("experience").dataset;
  debug.distance = motion.distance.toFixed(3);
  debug.routeLength = route.length.toFixed(3);
  debug.speed = motion.speed.toFixed(3);
  debug.paused = String(motion.paused);
  debug.mode = "ride";
  debug.ready = String(ready);
  debug.buildings = String(tilesReady);
  debug.terrain = String(terrainReady);
  debug.camera = "scenic";
  debug.direction = String(motion.direction);
  debug.ended = String(motion.ended);
}
async function start() {
  try {
    Ion.defaultAccessToken = "";
    const imagery = new UrlTemplateImageryProvider({
      url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
      minimumLevel: 2,
      maximumLevel: 18,
      rectangle: Rectangle.fromDegrees(122, 20, 154, 46),
      credit:
        '<a href="https://maps.gsi.go.jp/development/ichiran.html">Imagery: GSI</a> · Landsat8 (GSI, TSIC, GEO Grid/AIST, USGS) · GEBCO · NASA LP DAAC',
    });
    viewer = new Viewer("scene", {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      baseLayer: new ImageryLayer(imagery),
      creditContainer: el("map-credits"),
      shouldAnimate: false,
      requestRenderMode: false,
      contextOptions: { webgl: { alpha: false, antialias: true } },
    });
    viewer.clock.currentTime = JulianDate.fromIso8601("2026-04-15T03:00:00Z");
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.baseColor = Color.fromCssColorString("#74867c");
    viewer.scene.backgroundColor = Color.fromCssColorString("#c1d5e4");
    viewer.scene.highDynamicRange = false;
    viewer.scene.screenSpaceCameraController.enableInputs = false;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 8;
    viewer.scene.postProcessStages.fxaa.enabled = true;
    viewer.creditDisplay.addStaticCredit(
      new Credit(
        '<a href="https://maps.gsi.go.jp/development/ichiran.html">Imagery: GSI</a> · <a href="https://docs.plateauview.mlit.go.jp/datasets/terrain/">Terrain: PLATEAU / Mapterhorn / 国土地理院</a>',
        false,
      ),
    );
    viewer.scene.renderError.addEventListener((_scene, error) => {
      console.error("Geographic renderer stopped", error);
      ready = false;
      cancelAnimationFrame(frame);
      audio.update(0, true, false);
      showLoadingError("The 3D view stopped. Try reloading the journey.");
    });
    imagery.errorEvent.addEventListener(() => {
      imageryFailed = true;
      status();
    });
    setLoadingStage(0, "Finding our way to Shin-Fuji…");
    const [provider, loadedRoute] = await Promise.all([
      CesiumTerrainProvider.fromUrl(
        "https://tile.plateauview.mlit.go.jp/terrain",
        { requestVertexNormals: true },
      ),
      loadRoute(),
    ]);
    viewer.terrainProvider = provider;
    route = loadedRoute;
    await route.sampleHeights(provider);
    terrainReady = true;
    motion = new Motion(route.length);
    motion.paused = reduced;
    const params = new URLSearchParams(location.search);
    if (params.get("paused") === "1") motion.paused = true;
    const c = Number(params.get("chapter"));
    if (
      params.has("chapter") &&
      Number.isInteger(c) &&
      c >= 0 &&
      c < chapterPositions.length
    )
      motion.seek(chapterPositions[c] * route.length);
    setLoadingStage(1, "Preparing your ten-car train…");
    void streamBuildings();
    train = await createGeoTrain(viewer, route, (completed, total) =>
      setLoadingProgress(30 + (40 * completed) / total),
    );
    train.update(motion.distance);
    createRailway(viewer, route);
    rig = new GeoCamera(viewer, route, reduced);
    rig.update(motion.distance, 1);
    qualityUpdate();
    setLoadingStage(
      2,
      "Loading the opening view. Finer details follow as you ride.",
    );
    await waitForLandscape(viewer, undefined, controller.signal, (fraction) =>
      setLoadingProgress(70 + 29 * fraction),
    );
    train.setDirection(motion.direction);
    listen(el("play"), "click", play);
    listen(window, "resize", () => {
      qualityUpdate();
      rig.settled = false;
    });
    listen(window, "keydown", (event) => {
      const e = event as KeyboardEvent;
      if (
        e.code === "Space" &&
        !["INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        play();
      }
    });
    listen(document, "visibilitychange", () => {
      last = 0;
      if (document.hidden) audio.update(0, true, false);
    });
    listen(reducedQuery, "change", () => {
      reduced = reducedQuery.matches;
      if (reduced) motion.paused = true;
      rig = new GeoCamera(viewer, route, reduced);
      ui();
    });
    ready = true;
    ui();
    status();
    el("retry").hidden = true;
    setLoadingStage(3, "Ready to depart.");
    el("scene").setAttribute("aria-busy", "false");
    el("loading").classList.add("leaving");
    document.body.classList.add("journey-entered");
    await new Promise<void>((resolve) =>
      window.setTimeout(resolve, reducedQuery.matches ? 0 : 900),
    );
    if (controller.signal.aborted || !ready) return;
    el("loading").hidden = true;
    document
      .querySelectorAll<HTMLElement>(".header,.deck")
      .forEach((node) => (node.inert = false));
    last = 0;
    frame = requestAnimationFrame(animate);
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error(error);
    ready = false;
    showLoadingError(
      "We couldn’t finish loading the landscape. Check your connection and try again.",
    );
  }
}
let slowFrames = 0,
  totalFrames = 0;
function animate(now: number) {
  frame = requestAnimationFrame(animate);
  if (document.hidden) {
    last = 0;
    return;
  }
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
  last = now;
  if (refinement < 1) {
    refinement = Math.min(1, refinement + dt / 6);
    qualityUpdate();
  }
  motion.update(dt);
  train.update(motion.distance);
  rig.update(motion.distance, dt);
  audio.update(motion.speed, motion.paused || motion.ended, false);
  uiTime += dt;
  if (uiTime > 0.12) {
    ui();
    uiTime = 0;
  }
  if (totalFrames++ > 180 && !autoLow) {
    slowFrames = dt > 0.034 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames > 90) {
      autoLow = true;
      qualityUpdate();
    }
  }
}
listen(window, "pagehide", () => {
  cancelAnimationFrame(frame);
  clearTimeout(noticeTimer);
  controller.abort();
  audio.dispose();
  if (viewer && !viewer.isDestroyed()) viewer.destroy();
});
void start();
