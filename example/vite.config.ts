import { defineConfig } from 'vite-plus';

export default defineConfig({
  build: {
    // maplibre-gl ships one prebuilt ~1.05 MB bundle that cannot be split
    // further; app code is ~16 kB. The limit sits just above that vendor floor
    // so any growth in our own chunks still warns.
    chunkSizeWarningLimit: 1100,
    rolldownOptions: {
      output: {
        // Keep the two large runtime libraries in their own long-cached chunks.
        codeSplitting: {
          groups: [
            { name: 'maplibre-gl', test: /node_modules[\\/].*maplibre-gl/ },
            { name: 'three', test: /node_modules[\\/].*three/ },
          ],
        },
      },
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
