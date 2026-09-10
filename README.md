# Shinkansen

A ride through 5.65 km of the real Tokaido Shinkansen alignment east of Shin-Fuji. Cesium streams Japanese open geographic data; the supplied OBJ supplies a teal-and-magenta ten-car train. No Google key or Cesium ion token is required.

## Run locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Stop with Ctrl+C. Internet access and WebGL2 are required.

```sh
npm test
npm run build
npm run preview
```

Verified with Node 26.2.0 / npm 11.13.0. Use the committed lockfile with `npm ci` for reproducible installs. Node is required for building, not for serving the deployed site.

## Deploy

This is a static website. No backend, database, environment secrets, Google key or Cesium ion token is required. The current configuration serves from the domain root (`/`). Subdirectory deployment is not configured: Vite's base path and `CESIUM_BASE_URL` must be changed together before deploying below a path such as `/shinkansen/`.

| Setting | Value |
| --- | --- |
| Install command | `npm ci` |
| Validation | `npm test` |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Local production preview | `npm run preview -- --port 4173` |
| Runtime | Static HTTPS hosting; modern browser with WebGL2 |

Publish the **contents of `dist/`** after a successful build. Do not publish the repository, `node_modules/`, source OBJ files or Blender working files. The build contains the current ride, four active train GLBs, the preview image, route data and Cesium's worker/support files. The development prototype and unused alternative train assets are excluded.

Keep the generated directory structure intact:

```text
dist/
  index.html
  assets/     # JavaScript, CSS, train models, preview and manifest
  data/       # Railway alignment
  cesium/     # Workers, Assets, Widgets and ThirdParty
```

Serve JavaScript with a JavaScript MIME type and CSS as `text/css`. Do not rewrite missing files under `assets/`, `data/` or `cesium/` to `index.html`; that turns asset failures into parsing errors. Enable gzip or Brotli for JavaScript/CSS/JSON. Revalidate `index.html`, the unversioned train files, manifest, route data and Cesium support files when publishing updates. Only generated files with content hashes in their names should receive long-lived immutable caching. Deploy the directory atomically to avoid mixing old HTML with new assets.

The visitor's browser needs HTTPS access to these external data services:

- `cyberjapandata.gsi.go.jp`: aerial imagery.
- `tile.plateauview.mlit.go.jp`: terrain and elevation samples.
- `api.plateauview.mlit.go.jp`: building tiles and catalog.

This is not an offline experience. Terrain availability affects startup; buildings stream independently. Retain the visible Cesium/provider attribution and the detailed credit popup. If the host applies a Content Security Policy, validate Cesium workers, fetched imagery/models and provider requests against it in the deployed environment.

Before publishing publicly, resolve the supplied train model's missing author/license information and record the permission and required credit in [ASSET_CREDITS.md](ASSET_CREDITS.md). This repository does not establish redistribution rights for that model.

### Release check

1. Run `npm ci`, `npm test`, and `npm run build`.
2. Run `npm run preview` and open `http://127.0.0.1:4173/?paused=1`. Confirm the train loader, aligned logo, Scenic view, map credits and Play/Pause.
3. Check a narrow viewport and `?chapter=4`: let the train reach the endpoint, then Play should start the return trip without changing the camera angle.
4. Repeat on the deployed HTTPS URL. Check browser console/network errors, including model and worker requests. Test a physical phone; that performance check is still outstanding.

The large Cesium chunk warning is expected. The geographic bundle is approximately 4.15 MB (1.12 MB gzip), plus approximately 18.9 MB of unique train models. Hosting compression and browser caching matter; the loader does not imply a guaranteed completion time.

## Controls

- Automatic departure, smooth acceleration to a fixed 300 km/h cruising speed, and endpoint braking. At either end, the train stops and waits for Play to depart in the opposite direction from the same position. Pause freezes movement; Space toggles playback outside a form control.
- The compact floating bar contains only playback and current speed. Camera selectors, restart, secondary menus, the chapter timeline and duplicate speed labels are removed from the geographic view. There is no scroll-controlled mode.
- Scenic is the only camera view, looking north toward Mount Fuji. It keeps the same viewing angle and tracking reference when direction changes. The train retains its physical orientation; the opposite cab leads on the return leg. Preloaded end-car variants swap the headlight and rear-marker appearance without a download at departure.
- Sound enables synthesized rail/wind ambience, initially off. Pause and hidden tabs mute it.
- Graphics automatically reduces detail on small screens or sustained slow frames.
- Full map credits remain available through the small Data attribution link at the bottom right, without a full-width credit strip. Detailed provenance and approximation notes are recorded below and in ASSET_CREDITS.md.

Reduced-motion users start paused without camera smoothing. QA URLs: `/?paused=1`, `/?paused=1&chapter=2`. The older Three.js imagined landscape is retained at `/prototype.html` on the development server only; it is not part of the production build.

The opening shows a transparent studio render of the supplied train, a thin track with a red progress dot, and the red-circle SHINKANSEN mark at the top left. No percentage or explanatory text is visible. A render-blocking stylesheet styles the initial HTML before JavaScript, preventing a flash of unfinished UI. The dot reflects completed preparation work (route 30%, train 40%, rendered opening 30%), rather than elapsed time or download bytes. Accessible progress values and status messages remain available to screen readers; only a failed load shows a retry button. Reduced motion disables dot interpolation.

The opening uses lighter terrain detail and holds the camera and train still until visible globe tiles and geometry remain ready for 700 ms. A 900 ms fade reveals Scenic and starts playback; reduced motion skips the fade. Buildings stream independently and do not block entry. Detail increases over the first six seconds of the ride. A 45-second tile-readiness timeout offers retry. Regenerate the lightweight preview with Blender and `scripts/render_loading_preview.py`.

## Ten-car train

Four `public/assets/supplied-*.glb` files contain lead, standard middle, pantograph and tail variants prepared from `shinkansen_obj/model.obj`. The original OBJ, MTL and PNGs are preserved. Its missing material assignments were reconstructed from part names and the supplied UVs/textures. The source track/base was removed, and compatible meshes were merged into 3–4 meshes per car.

Rebuild using Blender 5.2:

```sh
blender --background --python scripts/prepare_supplied_train.py -- --render
```

Omit `-- --render` to export without the studio image. Editable Blender files and preparation details are in `design/supplied-train/`. `public/assets/train-manifest.json` defines ten cars: two driving ends, six standard middle cars and two pantograph cars (3 and 7). Car 10 leads, car 1 is reversed at the rear. End-car spacing is 26.5 m and middle-car spacing is 25 m; total nominal length is 253 m. The geometry is normalized to these presentation dimensions, with a small coupling gap. GLBs use X-forward / Y-up; each car follows the route independently.

## Accuracy and practical limits

Alignment, terrain, imagery and buildings originate from GSI/PLATEAU. Building coverage varies between textured geometry and simple solids. Aerial imagery is not street-level photogrammetry; detail can take time to stream after moving the camera. Track elevations are smoothed terrain samples plus estimated viaduct clearance. Rails, barriers, piers and overhead wires are generated approximations.

The train's materials and physical dimensions are reconstructed estimates. Station reconstruction, signalling, train interiors and live services are outside this build. The default geographic JavaScript chunk is roughly 4.15 MB (1.12 MB gzip); four unique train assets total roughly 18.9 MB. Physical-phone performance has not been measured.

## Architecture and tracking

- `src/geo/route.ts`: official alignment, metre sampling, approximate elevation.
- `src/geo/formation.ts` / `railway.ts`: car placement, loading and infrastructure.
- `src/geo/camera.ts` / `main.ts`: Scenic framing, controls, streaming and lifecycle.
- `src/style.css` / `index.html`: the current ride and loading UI; shared logo positioning.
- `src/geo/loading-ui.ts` / `loading.ts`: progress, errors and render-readiness gate.
- `src/motion.ts` / `audio.ts`: shared motion and synthesized ambience.
- `vite.config.ts`: production asset selection and Cesium support files, including Windows path correction.
- `prototype.html` / `src/prototype.css`: preserved development-only prototype entry and styling.
