import type { Cesium3DTileset, Viewer } from "cesium";
/** Hold the opening camera still until its actual rendered tiles settle. */
export function waitForLandscape(
  viewer: Viewer,
  buildings: Cesium3DTileset | undefined,
  signal: AbortSignal,
  onProgress?: (fraction: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    let stableSince = 0;
    let removeFrame = () => {};
    let removeError = () => {};
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      removeFrame();
      removeError();
      signal.removeEventListener("abort", aborted);
      error ? reject(error) : resolve();
    };
    const aborted = () => finish(new Error("Journey loading cancelled"));
    const timeout = window.setTimeout(
      () =>
        finish(
          new Error(
            "The landscape is taking too long to load. Please try again.",
          ),
        ),
      45000,
    );
    removeError = viewer.scene.renderError.addEventListener(() =>
      finish(new Error("The 3D view could not render.")),
    );
    removeFrame = viewer.scene.postRender.addEventListener(() => {
      const primitives = viewer.scene.primitives;
      let objectsReady = true;
      let completed = 0;
      for (let i = 0; i < primitives.length; i++) {
        if (primitives.get(i).ready === false) objectsReady = false;
        else completed++;
      }
      onProgress?.(
        (0.4 * completed) / Math.max(1, primitives.length) +
          (viewer.scene.globe.tilesLoaded ? 0.6 : 0),
      );
      const settled =
        !document.hidden &&
        viewer.scene.globe.tilesLoaded &&
        (!buildings || buildings.tilesLoaded) &&
        objectsReady;
      if (!settled) {
        stableSince = 0;
        return;
      }
      const now = performance.now();
      if (!stableSince) stableSince = now;
      if (now - stableSince >= 700) finish();
    });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}
