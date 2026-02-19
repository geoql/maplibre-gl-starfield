uniform vec3  uColor;
uniform float uFade;

varying float vOpacity;

void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float a = vOpacity * smoothstep(0.5, 0.1, d) * uFade;
  gl_FragColor = vec4(uColor * a, a);
}
