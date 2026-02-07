import maplibregl from 'maplibre-gl';
import { MaplibreStarfieldLayer } from '@geoql/maplibre-gl-starfield';
import './style.css';

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
  maxPitch: 85,
});

map.on('load', () => {
  const starfield = new MaplibreStarfieldLayer({
    galaxyTextureUrl: import.meta.env.BASE_URL + 'milkyway.jpg',
    galaxyBrightness: 0.35,
    starCount: 4000,
    starSize: 2.0,
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
});
