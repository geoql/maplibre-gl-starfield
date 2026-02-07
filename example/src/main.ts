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
          'https://s2maps-tiles.eu/wmts?layer=s2cloudless-2021_3857&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}',
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
    galaxyTextureUrl: '/milkyway.jpg',
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
