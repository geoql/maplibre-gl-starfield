// Fractal Brownian Motion — 4 octaves of simplex noise
// Requires: snoise() from simplex-noise.glsl

float fbm(vec3 p) {
  float f = 0.5 * snoise(p); p *= 2.02;
  f += 0.25 * snoise(p); p *= 2.03;
  f += 0.125 * snoise(p); p *= 2.01;
  f += 0.0625 * snoise(p);
  return f / 0.9375;
}
