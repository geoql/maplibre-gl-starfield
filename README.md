# @geoql/maplibre-gl-starfield

Three.js starfield skybox custom layer for [MapLibre GL JS](https://maplibre.org/) globe projections.

[![npm version](https://img.shields.io/npm/v/@geoql/maplibre-gl-starfield.svg)](https://www.npmjs.com/package/@geoql/maplibre-gl-starfield)
[![JSR](https://jsr.io/badges/@geoql/maplibre-gl-starfield)](https://jsr.io/@geoql/maplibre-gl-starfield)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@geoql/maplibre-gl-starfield)](https://bundlephobia.com/package/@geoql/maplibre-gl-starfield)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![oxlint](https://img.shields.io/badge/linter-oxlint-7c5dfa?logo=oxc)](https://oxc.rs)
[![tsdown](https://img.shields.io/badge/bundler-tsdown-3178c6)](https://tsdown.dev/)
[![typescript](https://img.shields.io/npm/dependency-version/@geoql/maplibre-gl-starfield/dev/typescript?logo=TypeScript)](https://www.typescriptlang.org/)

**[Live demo](https://maplibre-gl-starfield.geoql.in/?utm_source=github&utm_medium=readme&utm_campaign=maplibre-gl-starfield)** · [npm](https://www.npmjs.com/package/@geoql/maplibre-gl-starfield) · [JSR](https://jsr.io/@geoql/maplibre-gl-starfield)

Renders an optional equirectangular galaxy/milky-way panorama texture with configurable brightness, plus thousands of individual point stars with additive blending. Perfect for globe-projection maps that need a space-like background — earthquake visualizations, satellite trackers, flight paths, and more.

## Installation

```bash
# npm
npm install @geoql/maplibre-gl-starfield maplibre-gl three

# pnpm
pnpm add @geoql/maplibre-gl-starfield maplibre-gl three

# yarn
yarn add @geoql/maplibre-gl-starfield maplibre-gl three

# JSR
pnpm dlx jsr add @geoql/maplibre-gl-starfield
```

## Usage

```typescript
import * as maplibregl from 'maplibre-gl';
import { MaplibreStarfieldLayer } from '@geoql/maplibre-gl-starfield';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    projection: { type: 'globe' },
    sources: {
      satellite: {
        type: 'raster',
        tiles: [
          'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
        ],
        tileSize: 256,
        attribution: '© EOX IT Services GmbH - S2 Cloudless',
      },
    },
    layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
  },
  center: [0, 20],
  zoom: 1.5,
});

map.on('load', () => {
  const starfield = new MaplibreStarfieldLayer({
    galaxyTextureUrl: '/milkyway.jpg', // your panorama image
    galaxyBrightness: 0.35,
    starCount: 4000,
    starSize: 2.0,
  });

  // Add below all other layers so stars render behind the globe
  map.addLayer(starfield, map.getStyle().layers[0]?.id);
});
```

## Options

```typescript
interface MaplibreStarfieldLayerOptions {
  id?: string;
  starCount?: number;
  starSize?: number;
  starColor?: number;
  galaxyTextureUrl?: string;
  galaxyBrightness?: number;
}
```

| Option             | Type     | Default       | Description                                                                    |
| ------------------ | -------- | ------------- | ------------------------------------------------------------------------------ |
| `id`               | `string` | `'starfield'` | Unique layer ID                                                                |
| `starCount`        | `number` | `4000`        | Number of individual point stars                                               |
| `starSize`         | `number` | `2.0`         | Base point size for stars (randomized ±60%)                                    |
| `starColor`        | `number` | `0xffffff`    | Hex color for point stars                                                      |
| `galaxyTextureUrl` | `string` | `undefined`   | URL to an equirectangular panorama image. If omitted, only point stars render. |
| `galaxyBrightness` | `number` | `0.35`        | Brightness multiplier for the galaxy texture (0–1)                             |

## Galaxy Texture

This library does **not** bundle a galaxy image. You need to provide your own equirectangular panorama via `galaxyTextureUrl`.

A great free option is the **ESO/S. Brunier Milky Way panorama** ([source](https://www.eso.org/public/images/eso0932a/)), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Download and resize to ~4096×2048 for a good balance of quality and file size:

```bash
# Download the 6000×3000 original (8 MB)
curl -o milkyway_full.jpg "https://cdn.eso.org/images/large/eso0932a.jpg"

# Resize to 4096×2048 (~3 MB)
sips --resampleWidth 4096 milkyway_full.jpg --out public/milkyway.jpg
```

> **Attribution**: ESO/S. Brunier — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## How It Works

The layer implements MapLibre's `CustomLayerInterface` and shares the WebGL context with MapLibre:

1. **Galaxy sphere** — A Three.js `SphereGeometry` with `BackSide` rendering, textured with the panorama image. Rendered at near-infinite depth via a vertex shader trick.
2. **Point stars** — Thousands of `Points` with per-vertex random size and opacity, rendered with additive blending for a natural glow.
3. **Camera sync** — The projection matrix is decomposed from MapLibre's model-view-projection matrix, with translation stripped so the skybox stays at infinity regardless of zoom/pan.

## Exports

```typescript
// Main class
export { MaplibreStarfieldLayer } from '@geoql/maplibre-gl-starfield';

// Default export (same class)
export { default } from '@geoql/maplibre-gl-starfield';

// Types
export type { MaplibreStarfieldLayerOptions } from '@geoql/maplibre-gl-starfield';
```

## Requirements

- MapLibre GL JS >= 3.0.0
- Three.js >= 0.135.0
- Node.js >= 24.0.0

## Contributing

1. Fork and create a feature branch from `main`
2. Make changes following [conventional commits](https://www.conventionalcommits.org/)
3. Ensure commits are signed ([why?](https://withblue.ink/2020/05/17/how-and-why-to-sign-git-commits.html))
4. Submit a PR

```bash
pnpm install
pnpm run build
pnpm run lint
pnpm run typecheck
```

The demo lives in `example/` and runs on a Cloudflare Worker at
[maplibre-gl-starfield.geoql.in](https://maplibre-gl-starfield.geoql.in). Use Node 26
or later.

```bash
pnpm run dev:demo     # local dev server
pnpm run build:demo   # build the library, then the demo
pnpm run deploy:demo  # build and deploy the Worker (needs wrangler login)
```

## More from the author

- [maplibre-gl-snow](https://maplibre-gl-snow.geoql.in/?utm_source=github&utm_medium=readme&utm_campaign=maplibre-gl-starfield) — WebGPU snow particle layer
- [maplibre-gl-wind](https://maplibre-gl-wind.geoql.in/?utm_source=github&utm_medium=readme&utm_campaign=maplibre-gl-starfield) — wind particle animation layer
- [maplibre-gl-compare](https://maplibre-gl-compare.geoql.in/?utm_source=github&utm_medium=readme&utm_campaign=maplibre-gl-starfield) — swipe-style map comparison control
- [maplibre-gl-inspect](https://maplibre-gl-inspect.geoql.in/?utm_source=github&utm_medium=readme&utm_campaign=maplibre-gl-starfield) — inspect vector tile features and their properties
- [v-maplibre](https://v-maplibre.geoql.in/?utm_source=github&utm_medium=readme&utm_campaign=maplibre-gl-starfield) — 50+ Vue 3 components for MapLibre GL
- [mapcn-vue](https://mapcn-vue.geoql.in/?utm_source=github&utm_medium=readme&utm_campaign=maplibre-gl-starfield) — shadcn-vue map components you copy into your app

See every project at [vinayakkulkarni.dev/projects](https://vinayakkulkarni.dev/projects?utm_source=github&utm_medium=readme&utm_campaign=maplibre-gl-starfield) and [geoql.in](https://geoql.in/?utm_source=github&utm_medium=readme&utm_campaign=maplibre-gl-starfield).

## License

[MIT](./LICENSE)
