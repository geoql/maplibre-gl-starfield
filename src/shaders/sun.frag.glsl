uniform vec3  uSunDirection;
uniform vec3  uSunColor;
uniform float uSunIntensity;
uniform float uSunAngularRadius;

varying vec3 vDirection;

#include includes/simplex-noise.glsl
#include includes/fbm.glsl
#include includes/brightness-to-color.glsl

void main() {
  vec3 dir = normalize(vDirection);
  vec3 sunDir = normalize(uSunDirection);
  float cosAngle = dot(dir, sunDir);
  float angularDist = acos(clamp(cosAngle, -1.0, 1.0));
  float sunRadius = acos(clamp(uSunAngularRadius, -1.0, 1.0));
  float r = angularDist / max(sunRadius, 0.001);

  if (r > 15.0) discard;

  vec3 upRef = abs(sunDir.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 t1 = normalize(cross(sunDir, upRef));
  vec3 t2 = cross(sunDir, t1);
  vec3 localDir = vec3(dot(dir, t1), dot(dir, t2), dot(dir, sunDir));

  float discBright = 0.0;
  float glowBright = 0.0;

  // Sun disc — procedural surface with domain warping
  if (r < 1.05) {
    vec3 nc = localDir * 40.0;
    vec3 warp = vec3(
      snoise(nc * 0.7 + vec3(5.2, 0.0, 0.0)),
      snoise(nc * 0.7 + vec3(0.0, 1.7, 0.0)),
      0.0
    );
    vec3 warped = nc + warp * 4.0;

    float n1 = fbm(warped);
    float n2 = snoise(warped * 2.5) * 0.5 + 0.5;
    float n3 = snoise(warped * 6.0) * 0.5 + 0.5;
    float surface = 0.55 + 0.35 * n1 + 0.07 * n2 + 0.03 * n3;

    // Dark spots
    float spots = 1.0 - 0.25 * pow(clamp(1.0 - n1, 0.0, 1.0), 3.0);
    surface *= spots;

    // Limb brightening
    float rim = 1.0 + r * r * 1.2;
    float edge = 1.0 - smoothstep(0.88, 1.02, r);

    discBright = surface * rim * edge;
  }

  // Multi-layer corona
  float c1 = exp(-pow(max(r - 0.95, 0.0) / 0.6, 1.5)) * 0.8;
  float c2 = exp(-pow(max(r - 0.95, 0.0) / 2.5, 1.3)) * 0.3;
  float c3 = exp(-max(r - 0.8, 0.0) / 5.0) * 0.1;
  glowBright = c1 + c2 + c3;

  // Coronal streamers
  if (r > 0.85 && r < 12.0) {
    vec3 projVec = dir - sunDir * cosAngle;
    float projLen = length(projVec);
    if (projLen > 0.001) {
      vec3 proj = projVec / projLen;
      float angle = atan(dot(proj, t2), dot(proj, t1));
      float ray = pow(max(snoise(vec3(angle * 3.0, 0.5, 0.0)), 0.0), 2.0);
      ray += pow(max(snoise(vec3(angle * 7.0, 1.5, 0.0)), 0.0), 3.0) * 0.5;
      ray += pow(max(snoise(vec3(angle * 13.0, 2.5, 0.0)), 0.0), 4.0) * 0.3;
      float radialFade = exp(-pow(max(r - 1.0, 0.0) / 4.0, 1.1));
      glowBright += ray * radialFade * 0.4;
    }
  }

  float totalBright = (discBright + glowBright) * uSunIntensity;
  if (totalBright < 0.002) discard;

  // Separate disc / glow coloring for warm orange disc, golden corona
  vec3 discColor = brightnessToColor(discBright * uSunIntensity * 1.5) * uSunColor;
  vec3 glowColor = brightnessToColor(glowBright * uSunIntensity * 2.5) * uSunColor;
  vec3 color = discColor + glowColor;

  gl_FragColor = vec4(color, clamp(totalBright, 0.0, 1.0));
}
