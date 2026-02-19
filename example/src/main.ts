import maplibregl from 'maplibre-gl';
import { MaplibreStarfieldLayer } from '@geoql/maplibre-gl-starfield';
import './style.css';

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
    atmosphereBlend: 0.85,
  },
  day: {
    azimuth: 180,
    altitude: 45,
    skyColor: '#87CEEB',
    atmosphereBlend: 1,
  },
  dusk: {
    azimuth: 270,
    altitude: -3,
    skyColor: '#2d1b4e',
    atmosphereBlend: 0.85,
  },
  night: {
    azimuth: 0,
    altitude: -30,
    skyColor: '#000011',
    atmosphereBlend: 0.8,
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
      'atmosphere-blend': 0.8,
      'sky-color': '#000011',
    },
  },
  center: [0, 20],
  zoom: 1.5,
  maxPitch: 85,
});

map.on('load', () => {
  const starfield = new MaplibreStarfieldLayer({
    galaxyTextureUrl: import.meta.env.BASE_URL + 'milkyway.jpg',
    galaxyBrightness: 0.35,
    starCount: 4000,
    starSize: 2.0,
    sunEnabled: true,
    sunAzimuth: 120,
    sunAltitude: 25,
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

  map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: true }),
    'top-right',
  );

  // -----------------------------------------------------------------------
  // DOM Controls
  // -----------------------------------------------------------------------

  const $toggle = document.getElementById('sun-toggle') as HTMLInputElement;
  const $azimuth = document.getElementById('azimuth') as HTMLInputElement;
  const $altitude = document.getElementById('altitude') as HTMLInputElement;
  const $size = document.getElementById('sun-size') as HTMLInputElement;
  const $intensity = document.getElementById('intensity') as HTMLInputElement;

  const $azVal = document.getElementById('az-val') as HTMLSpanElement;
  const $altVal = document.getElementById('alt-val') as HTMLSpanElement;
  const $sizeVal = document.getElementById('size-val') as HTMLSpanElement;
  const $intVal = document.getElementById('int-val') as HTMLSpanElement;

  const presetButtons =
    document.querySelectorAll<HTMLButtonElement>('.presets button');

  function syncSliders(azimuth: number, altitude: number) {
    $azimuth.value = String(azimuth);
    $altitude.value = String(altitude);
    $azVal.textContent = String(azimuth);
    $altVal.textContent = String(altitude);
  }

  function clearActivePreset() {
    presetButtons.forEach((btn) => btn.classList.remove('active'));
  }

  // Sun toggle
  $toggle.addEventListener('change', () => {
    starfield.setSunEnabled($toggle.checked);
  });

  // Sliders
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
    const raw = Number($intensity.value);
    const val = raw / 10;
    $intVal.textContent = val.toFixed(1);
    starfield.setSunIntensity(val);
  });

  // Presets
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
      btn.classList.toggle('active', btn.dataset['preset'] === name);
    });
  }

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset['preset'];
      if (name) applyPreset(name);
    });
  });
});
