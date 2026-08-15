import { defineConfig } from 'vite-plus';

export default defineConfig({
  base: '/maplibre-gl-starfield/',
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
