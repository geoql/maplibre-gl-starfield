import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MaplibreMap,
} from 'maplibre-gl';
import type { Object3D, Texture } from 'three';
import {
  AddEquation,
  BackSide,
  BufferGeometry,
  Camera,
  CustomBlending,
  Float32BufferAttribute,
  LinearFilter,
  Matrix4,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from 'three';

type MaplibreStarfieldLayerOptions = {
  /** Unique layer ID */
  id?: string;
  /** Number of individual point stars (default: 4000) */
  starCount?: number;
  /** Base point size for stars (default: 2.0) */
  starSize?: number;
  /** Hex color for point stars (default: 0xffffff) */
  starColor?: number;
  /** URL to a panoramic galaxy/milky-way texture (equirectangular). If omitted, only point stars are rendered. */
  galaxyTextureUrl?: string;
  /** Brightness multiplier for the galaxy texture (default: 0.35) */
  galaxyBrightness?: number;
  /** Enable sun rendering (default: false) */
  sunEnabled?: boolean;
  /** Sun azimuth in degrees from north, clockwise. 0=N, 90=E, 180=S, 270=W (default: 180) */
  sunAzimuth?: number;
  /** Sun altitude in degrees above horizon. -90 to 90, 0=horizon, 90=zenith (default: 45) */
  sunAltitude?: number;
  /** Sun visual disc size in pixels (default: 100) */
  sunSize?: number;
  /** Sun color as hex (default: 0xffeeaa) */
  sunColor?: number;
  /** Sun glow intensity multiplier (default: 1.5) */
  sunIntensity?: number;
  /** Automatically fade stars and galaxy when the sun is above the horizon (default: true) */
  autoFadeStars?: boolean;
};

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const GALAXY_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    clipPos.z = clipPos.w * 0.99999;
    gl_Position = clipPos;
  }
`;

const GALAXY_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tSky;
  uniform float uBrightness;
  uniform float uFade;
  varying vec2 vUv;
  void main() {
    vec3 col = texture2D(tSky, vUv).rgb * uBrightness * uFade;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const STAR_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  varying   float vOpacity;

  void main() {
    vOpacity = aOpacity;
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    clipPos.z = clipPos.w * 0.9999;
    gl_Position  = clipPos;
    gl_PointSize = aSize;
  }
`;

const STAR_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3  uColor;
  uniform float uFade;
  varying float vOpacity;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = vOpacity * smoothstep(0.5, 0.1, d) * uFade;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const SUN_VERTEX_SHADER = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vDirection = position;
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    clipPos.z = clipPos.w * 0.99998;
    gl_Position = clipPos;
  }
`;

const SUN_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3  uSunDirection;
  uniform vec3  uSunColor;
  uniform float uSunIntensity;
  uniform float uSunAngularRadius;

  varying vec3 vDirection;

  vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 perm(vec4 x) { return mod289v4(((x * 34.0) + 10.0) * x); }
  vec4 tis(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - 0.5;
    i = mod289v3(i);
    vec4 p = perm(perm(perm(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    vec4 j = p - 49.0 * floor(p / 49.0);
    vec4 x_ = floor(j / 7.0);
    vec4 y_ = j - 7.0 * x_;
    vec4 ox = (x_ * 2.0 + 0.5) / 7.0 - 1.0;
    vec4 oy = (y_ * 2.0 + 0.5) / 7.0 - 1.0;
    vec4 h = 1.0 - abs(ox) - abs(oy);
    vec4 b0 = vec4(ox.xy, oy.xy);
    vec4 b1 = vec4(ox.zw, oy.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = tis(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  float fbm(vec3 p) {
    float f = 0.5 * snoise(p); p *= 2.02;
    f += 0.25 * snoise(p); p *= 2.03;
    f += 0.125 * snoise(p); p *= 2.01;
    f += 0.0625 * snoise(p);
    return f / 0.9375;
  }

  vec3 brightnessToColor(float b) {
    b *= 0.25;
    return (vec3(b, b * b, b * b * b * b) / 0.25) * 0.8;
  }

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

    float brightness = 0.0;

    if (r < 1.05) {
      vec3 nc = localDir * 200.0;
      vec3 warp = vec3(
        fbm(nc + vec3(5.2, 1.3, 0.0)),
        fbm(nc + vec3(1.7, 9.2, 0.0)),
        0.0
      );
      vec3 warped = nc + warp * 30.0;

      float n1 = fbm(warped);
      float n2 = abs(snoise(warped * 3.0));
      float n3 = abs(snoise(warped * 7.0));
      float surface = 0.3 + 0.4 * n1 + 0.2 * n2 + 0.1 * n3;

      float spots = 1.0 - 0.45 * pow(max(1.0 - n1, 0.0), 2.5);
      surface *= spots;

      float radial = 1.0 - r * 0.15;
      float rim = 1.0 + pow(max(r - 0.4, 0.0) / 0.6, 2.5) * 1.5;
      brightness += surface * radial * rim * (1.0 - smoothstep(0.9, 1.02, r));
    }

    float c1 = exp(-pow(max(r - 0.8, 0.0) / 0.8, 1.6)) * 0.7;
    float c2 = exp(-pow(max(r - 0.8, 0.0) / 3.0, 1.3)) * 0.25;
    float c3 = exp(-max(r - 0.5, 0.0) / 6.0) * 0.08;
    brightness += c1 + c2 + c3;

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
        brightness += ray * radialFade * 0.4;
      }
    }

    brightness *= uSunIntensity;
    if (brightness < 0.002) discard;

    vec3 color = brightnessToColor(brightness * 2.0) * uSunColor;
    gl_FragColor = vec4(color, clamp(brightness, 0.0, 1.0));
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEG2RAD = Math.PI / 180;

/**
 * Convert geographic-style azimuth + altitude to a unit-sphere position.
 *
 * Azimuth : 0 = north (+Z), 90 = east (+X), 180 = south (-Z), 270 = west (-X)
 * Altitude: 0 = horizon, +90 = zenith (+Y), -90 = nadir (-Y)
 */
function sunDirectionFromAngles(
  azimuthDeg: number,
  altitudeDeg: number,
): [number, number, number] {
  const az = azimuthDeg * DEG2RAD;
  const alt = altitudeDeg * DEG2RAD;
  const cosAlt = Math.cos(alt);
  return [
    cosAlt * Math.sin(az), // x  (east)
    Math.sin(alt), // y  (up)
    cosAlt * Math.cos(az), // z  (north)
  ];
}

/**
 * Convert the `sunSize` option (default 100) to the cosine of the angular
 * radius used in the sun sphere fragment shader.
 *
 * sunSize 100 → ~1.0° angular radius (2° diameter — close to real sun)
 * The glow extends well beyond the disc, so the sun looks ~3-4° total.
 */
function sunSizeToCos(size: number): number {
  const angularRadiusDeg = (size / 100) * 2.0;
  return Math.cos(angularRadiusDeg * DEG2RAD);
}

/**
 * Compute how much to fade stars/galaxy based on sun altitude.
 *
 * - altitude <= -18 deg  →  1.0  (full night, all stars visible)
 * - altitude >= 0 deg    →  0.0  (daytime, stars invisible)
 * - in between           →  smooth non-linear ramp
 */
function computeStarFade(altitudeDeg: number): number {
  if (altitudeDeg >= 0) return 0.0;
  if (altitudeDeg <= -18) return 1.0;
  // Non-linear smoothstep for realistic twilight transition
  const t = -altitudeDeg / 18; // 0..1
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Layer class
// ---------------------------------------------------------------------------

class MaplibreStarfieldLayer implements CustomLayerInterface {
  id: string;
  type: 'custom' = 'custom' as const;
  renderingMode: '2d' | '3d' = '3d';

  // Star / galaxy options
  private starCount: number;
  private starSize: number;
  private starColor: number;
  private galaxyTextureUrl: string | undefined;
  private galaxyBrightness: number;

  // Sun options
  private _sunEnabled: boolean;
  private _sunAzimuth: number;
  private _sunAltitude: number;
  private _sunSize: number;
  private _sunColor: number;
  private _sunIntensity: number;
  private _autoFadeStars: boolean;

  // Three.js internals
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: Camera | null = null;
  private map: MaplibreMap | null = null;

  // References for dynamic updates
  private starMaterial: ShaderMaterial | null = null;
  private galaxyMaterial: ShaderMaterial | null = null;
  private sunMesh: Mesh | null = null;
  private sunMaterial: ShaderMaterial | null = null;

  constructor(options: MaplibreStarfieldLayerOptions = {}) {
    this.id = options.id ?? 'starfield';
    this.starCount = options.starCount ?? 4000;
    this.starSize = options.starSize ?? 2.0;
    this.starColor = options.starColor ?? 0xffffff;
    this.galaxyTextureUrl = options.galaxyTextureUrl;
    this.galaxyBrightness = options.galaxyBrightness ?? 0.35;

    this._sunEnabled = options.sunEnabled ?? false;
    this._sunAzimuth = options.sunAzimuth ?? 180;
    this._sunAltitude = options.sunAltitude ?? 45;
    this._sunSize = options.sunSize ?? 100;
    this._sunColor = options.sunColor ?? 0xffeeaa;
    this._sunIntensity = options.sunIntensity ?? 1.5;
    this._autoFadeStars = options.autoFadeStars ?? true;
  }

  // -----------------------------------------------------------------------
  // Public API — dynamic updates
  // -----------------------------------------------------------------------

  /**
   * Update the sun position and re-render.
   *
   * @param azimuth  Degrees from north, clockwise (0-360)
   * @param altitude Degrees above horizon (-90 to 90)
   */
  setSunPosition(azimuth: number, altitude: number): void {
    this._sunAzimuth = azimuth;
    this._sunAltitude = altitude;
    this.applySunPosition();
    this.applyStarFade();
    this.map?.triggerRepaint();
  }

  /**
   * Enable or disable the sun.
   */
  setSunEnabled(enabled: boolean): void {
    this._sunEnabled = enabled;

    if (this.sunMesh) {
      this.sunMesh.visible = enabled;
    }

    if (!enabled) {
      this.setFadeUniforms(1.0);
    } else {
      this.applyStarFade();
    }

    this.map?.triggerRepaint();
  }

  /**
   * Update sun glow intensity.
   */
  setSunIntensity(intensity: number): void {
    this._sunIntensity = intensity;
    const u = this.sunMaterial?.uniforms['uSunIntensity'];
    if (u) u.value = intensity;
    this.map?.triggerRepaint();
  }

  setSunSize(size: number): void {
    this._sunSize = size;
    const u = this.sunMaterial?.uniforms['uSunAngularRadius'];
    if (u) u.value = sunSizeToCos(size);
    this.map?.triggerRepaint();
  }

  // -----------------------------------------------------------------------
  // CustomLayerInterface
  // -----------------------------------------------------------------------

  onAdd(map: MaplibreMap, gl: WebGLRenderingContext): void {
    this.map = map;
    this.scene = new Scene();
    this.camera = new Camera();

    const initialFade =
      this._sunEnabled && this._autoFadeStars
        ? computeStarFade(this._sunAltitude)
        : 1.0;

    // --- Galaxy skybox sphere (renders first, behind everything) ---------
    if (this.galaxyTextureUrl) {
      const loader = new TextureLoader();
      loader.setCrossOrigin('anonymous');
      const brightness = this.galaxyBrightness;
      const scene = this.scene;
      const fade = initialFade;
      const self = this;

      loader.load(this.galaxyTextureUrl, (texture: Texture) => {
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearFilter;

        const skyGeo = new SphereGeometry(1, 64, 32);
        const skyMat = new ShaderMaterial({
          uniforms: {
            tSky: { value: texture },
            uBrightness: { value: brightness },
            uFade: { value: fade },
          },
          vertexShader: GALAXY_VERTEX_SHADER,
          fragmentShader: GALAXY_FRAGMENT_SHADER,
          side: BackSide,
          depthWrite: false,
          depthTest: false,
        });

        self.galaxyMaterial = skyMat;
        const skybox = new Mesh(skyGeo, skyMat);
        // Insert at index 0 so it renders behind point stars
        scene.children.unshift(skybox);
        map.triggerRepaint();
      });
    }

    // --- Point stars (bright individual stars on top of galaxy) -----------
    const count = this.starCount;
    const size = this.starSize;
    const color = this.starColor;

    const positions = new Float32Array(count * 3);
    const starSizes = new Float32Array(count);
    const opacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const i3 = i * 3;
      positions[i3] = Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = Math.cos(phi);
      starSizes[i] = size * (0.4 + Math.random());
      opacities[i] = 0.15 + Math.random() * 0.85;
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new Float32BufferAttribute(starSizes, 1));
    geo.setAttribute('aOpacity', new Float32BufferAttribute(opacities, 1));

    const cr = ((color >> 16) & 0xff) / 255;
    const cg = ((color >> 8) & 0xff) / 255;
    const cb = (color & 0xff) / 255;

    const mat = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Vector3(cr, cg, cb) },
        uFade: { value: initialFade },
      },
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendEquation: AddEquation,
    });

    this.starMaterial = mat;
    this.scene.add(new Points(geo, mat));

    // --- Sun disc (single large glowing point) ---------------------------
    this.createSun();

    // --- Renderer --------------------------------------------------------
    this.renderer = new WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
    });
    this.renderer.autoClear = false;
  }

  render(_gl: WebGLRenderingContext, options: CustomRenderMethodInput): void {
    if (!this.renderer || !this.scene || !this.camera) return;

    const P = new Matrix4().fromArray(
      options.projectionMatrix as unknown as number[],
    );
    const MVP = new Matrix4().fromArray(
      options.modelViewProjectionMatrix as unknown as number[],
    );

    const PInv = new Matrix4().copy(P).invert();
    const MV = new Matrix4().multiplyMatrices(PInv, MVP);

    // Strip translation → stars at infinity (skybox)
    const e = MV.elements;
    e[12] = 0;
    e[13] = 0;
    e[14] = 0;

    this.camera.projectionMatrix.multiplyMatrices(P, MV);

    // Reset Three.js cached GL state (r136+ has resetState, r135 has state.reset)
    const r = this.renderer as unknown as Record<string, unknown>;
    if (typeof r['resetState'] === 'function') {
      (r['resetState'] as () => void)();
    } else if (
      r['state'] &&
      typeof (r['state'] as Record<string, unknown>)['reset'] === 'function'
    ) {
      ((r['state'] as Record<string, unknown>)['reset'] as () => void)();
    }

    this.renderer.render(this.scene, this.camera);
  }

  onRemove(): void {
    this.scene?.traverse((node: Object3D) => {
      if (node instanceof Points) {
        node.geometry.dispose();
        (node.material as ShaderMaterial).dispose();
      }
      if (node instanceof Mesh) {
        node.geometry.dispose();
        (node.material as ShaderMaterial).dispose();
      }
    });
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.map = null;
    this.starMaterial = null;
    this.galaxyMaterial = null;
    this.sunMesh = null;
    this.sunMaterial = null;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private createSun(): void {
    if (!this.scene) return;

    const [dx, dy, dz] = sunDirectionFromAngles(
      this._sunAzimuth,
      this._sunAltitude,
    );

    const angularRadiusCos = sunSizeToCos(this._sunSize);

    const scR = ((this._sunColor >> 16) & 0xff) / 255;
    const scG = ((this._sunColor >> 8) & 0xff) / 255;
    const scB = (this._sunColor & 0xff) / 255;

    const sunMat = new ShaderMaterial({
      uniforms: {
        uSunDirection: { value: new Vector3(dx, dy, dz) },
        uSunColor: { value: new Vector3(scR, scG, scB) },
        uSunIntensity: { value: this._sunIntensity },
        uSunAngularRadius: { value: angularRadiusCos },
      },
      vertexShader: SUN_VERTEX_SHADER,
      fragmentShader: SUN_FRAGMENT_SHADER,
      side: BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendEquation: AddEquation,
    });

    this.sunMaterial = sunMat;
    this.sunMesh = new Mesh(new SphereGeometry(1, 64, 32), sunMat);
    this.sunMesh.visible = this._sunEnabled;
    this.scene.add(this.sunMesh);
  }

  private applySunPosition(): void {
    if (!this.sunMaterial) return;

    const [x, y, z] = sunDirectionFromAngles(
      this._sunAzimuth,
      this._sunAltitude,
    );

    const u = this.sunMaterial.uniforms['uSunDirection'];
    if (u) (u.value as Vector3).set(x, y, z);
  }

  private applyStarFade(): void {
    if (!this._sunEnabled || !this._autoFadeStars) {
      this.setFadeUniforms(1.0);
      return;
    }
    const fade = computeStarFade(this._sunAltitude);
    this.setFadeUniforms(fade);
  }

  private setFadeUniforms(fade: number): void {
    const starFade = this.starMaterial?.uniforms['uFade'];
    if (starFade) starFade.value = fade;

    const galaxyFade = this.galaxyMaterial?.uniforms['uFade'];
    if (galaxyFade) galaxyFade.value = fade;
  }
}

export type { MaplibreStarfieldLayerOptions };
export { MaplibreStarfieldLayer };
