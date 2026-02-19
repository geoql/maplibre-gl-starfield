uniform sampler2D tSky;
uniform float uBrightness;
uniform float uFade;

varying vec2 vUv;

void main() {
  vec3 col = texture2D(tSky, vUv).rgb * uBrightness * uFade;
  gl_FragColor = vec4(col, 1.0);
}
