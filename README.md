# 470 Collins Street — Available Spaces

A production-oriented React/Vite property availability selector driven by a pre-rendered Corona sequence and functional Object-ID masks. The shipped viewer uses an image sequence plus Canvas 2D overlays; it has no Three.js, WebGL, GLB, or runtime full-frame pixel processing.

## Run locally

```bash
npm install
npm run dev
```

`npm run build` regenerates all derived assets, type-checks, and produces the Vite production bundle. To rebuild assets alone, use `npm run assets`.

For a running local server, `npm run stress:viewer` performs a rapid bidirectional rotation audit in headless Edge. Add `-- --adverse` to emulate DPR 2, a 4× slower CPU, and delayed image responses; add `-- --fail-webp` to verify the JPEG recovery path.

## Asset findings

- 31 beauty WebP files and 31 lossless mask WebP files are stored at 2400×3000.
- The beauty filenames contain non-contiguous export counters (`1 (1)`, then `1 (17)` through `1 (46)`). Visual inspection confirms they form a smooth left-to-right sequence and they are paired positionally with `mask (1)` through `mask (31)`.
- No angle metadata exists in the files. The verified 31-frame sweep is assigned evenly from −60° to +60° in 4° increments; frame 16 is the front (0°) view.
- The source masks use alternating red/green IDs across storeys rather than a unique color per floor. Across all 31 angles they contain 15 physical bands. The lowest band is intentionally excluded; the 14 bands above it map from Level 03 through Level 16. Tree occlusion splits Level 03 into multiple connected pieces, so the build combines only those aligned pieces into one floor mask while keeping every other band isolated.
- No floor plans, suite masks, or explicit ID mapping file were supplied. Plan controls are therefore omitted and Level 10 suites live only in the details UI, never as an invented façade split.

The full generated report is saved to `asset-report.json`. Current WebP totals are approximately 3.17 MiB mobile and 6.86 MiB desktop; all hit maps and cropped alpha masks total approximately 0.58 MB. High-resolution files are separate and loaded only on demand after selection on non-data-saver connections.

## Asset pipeline

`scripts/build-sequence-assets.mjs`:

1. Discovers and orders beauty, mask, and recognizable plan files.
2. Generates mobile (800×1000), desktop (1200×1500), and high-resolution derivatives without upscaling or altering render appearance.
3. Detects meaningful mask components while ignoring black background and small noise.
4. Computes source-space bounds, centroids, and pixel counts.
5. Generates a nearest-neighbour 240×300 hit map with a unique encoded level ID.
6. Writes tightly cropped RGBA alpha masks per selectable level and frame.
7. Writes `src/generated/sequence-manifest.json` and `asset-report.json`.

`npm run assets:convert` converts newly supplied PNG sequence sources to WebP, validates their dimensions and verifies mask pixels before replacing the PNG files.

## Render deployment

The repository ships one public page at `/`: the Fortis project page with the 3D selector embedded in it. Render settings are defined in `render.yaml`; the build publishes the generated `dist` directory as a static site. All generated resource names contain a SHA-256 content fingerprint, so `/generated/*` can use `Cache-Control: public, max-age=31536000, immutable`. Apply the Blueprint header settings when merging/deploying; runtime fetches also use `force-cache` for these versioned URLs.

### Optional explicit color mapping

For future archives where each floor has a unique Object-ID color, an `images/ids.json` file may use this shape:

```json
{
  "08": "#b52c2c",
  "09": "#2cb52c",
  "10": "#123456",
  "12": "#654321",
  "14": "#abcdef",
  "15": "#fedcba",
  "16": "#884422"
}
```

The present archive cannot be mapped by color alone because colors repeat, so component position is the reliable geometry key. Any discovery or pairing ambiguity is emitted as a build warning and included in the manifest/report.

## Runtime behavior

- Drag/swipe rotation with horizontal-intent detection and natural vertical scrolling (`touch-action: pan-y` plus legacy touch fallback).
- Arrow-key rotation, semantic level buttons, visible focus states, and Escape handling.
- A poster plus a bounded, prioritized download queue; compressed frames stay available as object URLs for the viewer lifetime, while a decoded LRU holds seven mobile or nine desktop images. Background work downloads bytes without decoding the entire sequence.
- Data-saver mode loads only nearby frames and disables high resolution. High resolution otherwise starts 900 ms after the selected view has settled and cancels as soon as another gesture begins.
- Pixel-accurate one-pixel hit testing, cropped-mask outlines, selection dimming, and per-frame centroid zoom. Mask and hit-map caches have bounded decoded working sets. Missing masks leave the image usable without an incorrect full-frame dim or a blocked rotation.
- URL writes are deferred until the gesture ends (150 ms debounce for keyboard changes), preserving unrelated query parameters, hash, and history state.
- Query state such as `?level=10&angle=44`; `?fallback=1` locks the viewer to the front frame while retaining hit testing and selection.
- A frontend-only enquiry adapter at `src/services/enquiry.ts`. It intentionally transmits nothing until connected to an approved endpoint.

## Content editing

Availability is maintained in `src/data/spaces.ts`. The temporary unit previews use indicative 370 m² part-floor and 740 m² full-floor values from the supplied marketing range; replace them when final tenancy data is provided.

Selecting an offered floor reveals its available unit markers inside the building viewer. A marker opens an indicative inline SVG tenancy plan in the same viewer, with unit facts and an enquiry action. The placeholder can later be replaced with a supplied plan asset without changing the floor-selection flow. `Escape` and the visible back controls step from enquiry to plan, from plan to the selected floor, and from the selected floor back to the building.

## Loading regression checks

With a local production preview running, use `npm run stress:loading -- http://127.0.0.1:4173`. This verifies zero idle decode activity, zero normal-resource requests during warm rotation even with the HTTP cache disabled, at most one URL write per gesture, cancellation of high-resolution downloads, missing-mask recovery, retrying a failed view, and data-saver limits. The existing viewer stress test continues to require no blank frames and no skipped intermediate frames under normal loading. Run it with `--adverse` and `--fail-webp` for slow CPU/network and JPEG fallback coverage. Unit tests cover request deduplication, queue priority, cache eviction, corrupt WebP fallback, and unmount cancellation.
