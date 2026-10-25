import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { MaplibreStarfieldLayer } from '@geoql/maplibre-gl-starfield';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './style.css';
import { initGoogleAnalytics, track } from './analytics';

initGoogleAnalytics();

// maplibre-gl v6 cannot find its worker inside a bundle; Vite emits it here.
maplibregl.setWorkerUrl(workerUrl);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

// ---------------------------------------------------------------------------
// Page chrome: theme, install copy, outbound links
// ---------------------------------------------------------------------------

type Theme = 'light' | 'dark';
const THEME_KEY = 'starfield-theme';

function currentTheme(): Theme {
  return document.documentElement.dataset['theme'] === 'dark'
    ? 'dark'
    : 'light';
}

const $themeToggle = byId<HTMLButtonElement>('theme-toggle');

function renderThemeToggle(theme: Theme) {
  const next = theme === 'dark' ? 'light' : 'dark';
  $themeToggle.textContent = next === 'dark' ? 'Dark' : 'Light';
  $themeToggle.setAttribute('aria-label', `Switch to ${next} theme`);
}

renderThemeToggle(currentTheme());

$themeToggle.addEventListener('click', () => {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset['theme'] = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage can be blocked (private mode); the theme still applies.
  }
  renderThemeToggle(next);
  track('Theme Toggle', { theme: next });
});

const $copy = byId<HTMLButtonElement>('copy-install');
const $installCmd = byId<HTMLElement>('install-cmd');

$copy.addEventListener('click', () => {
  const text = $installCmd.textContent?.trim() ?? '';
  navigator.clipboard.writeText(text).then(
    () => {
      $copy.textContent = 'Copied';
      track('Install Copy', { manager: 'pnpm' });
      window.setTimeout(() => {
        $copy.textContent = 'Copy';
      }, 1600);
    },
    () => {
      $copy.textContent = 'Press ⌘C';
    },
  );
});

document
  .querySelectorAll<HTMLAnchorElement>('a[data-outbound]')
  .forEach((link) => {
    link.addEventListener('click', () => {
      track('Outbound Link', {
        target: link.dataset['outbound'] ?? 'unknown',
        url: link.href,
      });
    });
  });

// Start with the panel collapsed on small screens so the globe is visible.
const $controls = byId<HTMLDetailsElement>('controls');
if (window.matchMedia('(max-width: 640px)').matches) {
  $controls.open = false;
}
// Track the user's clicks only; the `toggle` event also fires for the
// programmatic collapse above.
$controls.querySelector('summary')?.addEventListener('click', () => {
  track('Panel Toggle', { open: !$controls.open });
});

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface SunPreset {
  azimuth: number;
  altitude: number;
  skyColor: string;
  atmosphereBlend: number;
}

const PRESETS: Record<string, SunPreset> = {
  dawn: {
    azimuth: 90,
    altitude: -6,
    skyColor: '#1a0a2e',
    atmosphereBlend: 0.15,
  },
  day: {
    azimuth: 180,
    altitude: 45,
    skyColor: '#87CEEB',
    atmosphereBlend: 0.85,
  },
  dusk: {
    azimuth: 270,
    altitude: -3,
    skyColor: '#2d1b4e',
    atmosphereBlend: 0.15,
  },
  night: {
    azimuth: 0,
    altitude: -30,
    skyColor: '#000011',
    atmosphereBlend: 0,
  },
};

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

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
    sky: {
      'atmosphere-blend': 0,
      'sky-color': '#000011',
    },
  },
  center: [0, 20],
  zoom: 1.5,
  maxPitch: 85,
});

map.addControl(
  new maplibregl.NavigationControl({ visualizePitch: true }),
  'top-right',
);

map.on('load', () => {
  const starfield = new MaplibreStarfieldLayer({
    galaxyTextureUrl: `${import.meta.env.BASE_URL}milkyway.jpg`,
    galaxyBrightness: 0.35,
    starCount: 4000,
    starSize: 2.0,
    sunEnabled: true,
    // Open on the Night preset so the stars and galaxy show on arrival.
    sunAzimuth: PRESETS['night']?.azimuth ?? 0,
    sunAltitude: PRESETS['night']?.altitude ?? -30,
    sunSize: 100,
    sunIntensity: 1.5,
    autoFadeStars: true,
  });

  const firstLayerId = map.getStyle().layers[0]?.id;
  if (firstLayerId) {
    map.addLayer(starfield, firstLayerId);
  } else {
    map.addLayer(starfield);
  }

  // -----------------------------------------------------------------------
  // Sun controls
  // -----------------------------------------------------------------------

  const $toggle = byId<HTMLInputElement>('sun-toggle');
  const $azimuth = byId<HTMLInputElement>('azimuth');
  const $altitude = byId<HTMLInputElement>('altitude');
  const $size = byId<HTMLInputElement>('sun-size');
  const $intensity = byId<HTMLInputElement>('intensity');

  const $azVal = byId<HTMLSpanElement>('az-val');
  const $altVal = byId<HTMLSpanElement>('alt-val');
  const $sizeVal = byId<HTMLOutputElement>('size-val');
  const $intVal = byId<HTMLOutputElement>('int-val');

  const presetButtons =
    document.querySelectorAll<HTMLButtonElement>('.presets button');

  function syncSliders(azimuth: number, altitude: number) {
    $azimuth.value = String(azimuth);
    $altitude.value = String(altitude);
    $azVal.textContent = String(azimuth);
    $altVal.textContent = String(altitude);
  }

  function clearActivePreset() {
    presetButtons.forEach((btn) => btn.setAttribute('aria-pressed', 'false'));
  }

  $toggle.addEventListener('change', () => {
    starfield.setSunEnabled($toggle.checked);
    track('Sun Toggle', { enabled: $toggle.checked });
  });

  $azimuth.addEventListener('input', () => {
    const az = Number($azimuth.value);
    $azVal.textContent = String(az);
    starfield.setSunPosition(az, Number($altitude.value));
    clearActivePreset();
  });

  $altitude.addEventListener('input', () => {
    const alt = Number($altitude.value);
    $altVal.textContent = String(alt);
    starfield.setSunPosition(Number($azimuth.value), alt);
    clearActivePreset();
  });

  $size.addEventListener('input', () => {
    const s = Number($size.value);
    $sizeVal.textContent = String(s);
    starfield.setSunSize(s);
  });

  $intensity.addEventListener('input', () => {
    const val = Number($intensity.value) / 10;
    $intVal.textContent = val.toFixed(1);
    starfield.setSunIntensity(val);
  });

  // One event per finished drag, not one per pixel.
  const sliders: Array<[HTMLInputElement, string]> = [
    [$azimuth, 'azimuth'],
    [$altitude, 'altitude'],
    [$size, 'size'],
    [$intensity, 'intensity'],
  ];
  for (const [input, control] of sliders) {
    input.addEventListener('change', () => {
      track('Sun Adjust', { control, value: Number(input.value) });
    });
  }

  function applyPreset(name: string) {
    const preset = PRESETS[name];
    if (!preset) return;

    starfield.setSunPosition(preset.azimuth, preset.altitude);
    syncSliders(preset.azimuth, preset.altitude);

    map.setSky({
      'atmosphere-blend': preset.atmosphereBlend,
      'sky-color': preset.skyColor,
    });

    presetButtons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset['preset'] === name));
    });
    track('Sun Preset', { preset: name });
  }

  presetButtons.forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset['preset'] === 'night'));
  });
  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset['preset'];
      if (name) applyPreset(name);
    });
  });
});
