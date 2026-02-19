# Changelog

## [0.1.0](https://github.com/geoql/maplibre-gl-starfield/compare/v0.0.2...v0.1.0) (2026-02-19)


### ⚠ BREAKING CHANGES

* update layer glsl

### Features

* add sun layer 🌞 ([920b7d8](https://github.com/geoql/maplibre-gl-starfield/commit/920b7d839ce67997484a251585890ecc8463f995))


### Bug Fixes

* correct atmosphere-blend values for dawn, dusk, and night presets ([cf32a91](https://github.com/geoql/maplibre-gl-starfield/commit/cf32a91005e479eba58caa484ab30c03ff21969e))


### Miscellaneous

* add GLSL text loader and type declarations ([1cbed1a](https://github.com/geoql/maplibre-gl-starfield/commit/1cbed1af54c38e6451bc89a777a8be882fb7f37c))
* bump dependencies ✨ ([e3156bb](https://github.com/geoql/maplibre-gl-starfield/commit/e3156bbef014609dfb0d55697fa200b211baacf1))
* **deps:** bump dependencies ✨ ([66c90ba](https://github.com/geoql/maplibre-gl-starfield/commit/66c90ba1f15afcd463cb1939b37cb7f78a8a499f))
* update maplibre-gl ([9116ccd](https://github.com/geoql/maplibre-gl-starfield/commit/9116ccd2d31b0bb6ffc18fb2598d70e362a4b707))


### Code Refactoring

* extract galaxy and star shaders to .glsl files ([0ae1e6d](https://github.com/geoql/maplibre-gl-starfield/commit/0ae1e6dd6f50593c1438c02cbe4f5ba07e188319))
* extract shared GLSL includes (simplex noise, fbm, brightness-to-color) ([2517ffc](https://github.com/geoql/maplibre-gl-starfield/commit/2517ffcbf8fa4be4be64624df251ebdf929b557b))
* extract sun shaders to .glsl files with #include directives ([0bb2f1b](https://github.com/geoql/maplibre-gl-starfield/commit/0bb2f1b8865024c8e659e6cf2374bf8dd97bb7ba))
* replace inline GLSL with shader file imports and #include resolver ([fec4512](https://github.com/geoql/maplibre-gl-starfield/commit/fec4512c1784d3c42e51c8ee40a1ba17a56f30f5))
* update layer glsl ([0e65e3b](https://github.com/geoql/maplibre-gl-starfield/commit/0e65e3b7f5b547ee4c246da025718a402be123f5))

## [0.0.2](https://github.com/geoql/maplibre-gl-starfield/compare/v0.0.1...v0.0.2) (2026-02-08)


### Features

* add starfield custom layer implementation ([1dcd4be](https://github.com/geoql/maplibre-gl-starfield/commit/1dcd4be40755ad1e8ede67e95fb0c98eeee9311a))
* add vite example with globe demo ([abfcea4](https://github.com/geoql/maplibre-gl-starfield/commit/abfcea4d022b391886fd91579ef71abbf19d31ae))


### Bug Fixes

* use correct EOX tile URL and resolve base path for galaxy texture ([2449a99](https://github.com/geoql/maplibre-gl-starfield/commit/2449a995310db30e28ab1170562e94ee16ec15bb))


### Documentation

* add license and readme ([bb1218e](https://github.com/geoql/maplibre-gl-starfield/commit/bb1218ec9a0ed40d3193ad56c3e5fa20bff789c2))
* update README ([6e598c8](https://github.com/geoql/maplibre-gl-starfield/commit/6e598c8a3b103c5122e379993e48bd68543e9e38))


### Miscellaneous

* add editor and repo configuration ([a83868c](https://github.com/geoql/maplibre-gl-starfield/commit/a83868c1b7b64793042c40d3e144e2fab4115124))
* add git hooks and commit conventions ([2561708](https://github.com/geoql/maplibre-gl-starfield/commit/2561708d4b6d2c4562665556301548e0700b2ae7))
* add jsr registry configuration ([56d8693](https://github.com/geoql/maplibre-gl-starfield/commit/56d86939b3578d5a952c295962c34be54df06a3e))
* add linting and formatting configuration ([528fdc5](https://github.com/geoql/maplibre-gl-starfield/commit/528fdc55d32912a04baa54210e527653f20fe9bb))
* add typescript and build configuration ([a050047](https://github.com/geoql/maplibre-gl-starfield/commit/a0500473c01d01121eb2eb295eb54409e3707e73))
* initialize project with package.json and lockfile ([4f226be](https://github.com/geoql/maplibre-gl-starfield/commit/4f226be8e6d0c05bd75c00b4f96719108994f305))
