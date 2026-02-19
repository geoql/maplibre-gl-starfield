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
import galaxyVertexShader from './shaders/galaxy.vert.glsl';
import galaxyFragmentShader from './shaders/galaxy.frag.glsl';
import starVertexShader from './shaders/star.vert.glsl';
import starFragmentShader from './shaders/star.frag.glsl';
import sunVertexShader from './shaders/sun.vert.glsl';
import sunFragmentShaderRaw from './shaders/sun.frag.glsl';
import simplexNoiseGlsl from './shaders/includes/simplex-noise.glsl';
import fbmGlsl from './shaders/includes/fbm.glsl';
import brightnessToColorGlsl from './shaders/includes/brightness-to-color.glsl';

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

const GLSL_INCLUDES: Record<string, string> = {
  'includes/simplex-noise.glsl': simplexNoiseGlsl,
  'includes/fbm.glsl': fbmGlsl,
  'includes/brightness-to-color.glsl': brightnessToColorGlsl,
};

/** Resolve `#include path` directives in GLSL source (eclipseSimulator pattern). */
function resolveGlslIncludes(source: string): string {
  return source.replace(
    /^#include\s+(.+)$/gm,
    (_match: string, path: string) => {
      const trimmed = path.trim();
      const glsl = GLSL_INCLUDES[trimmed];
      if (!glsl) {
        throw new Error(`GLSL include not found: ${trimmed}`);
      }
      return glsl;
    },
  );
}

const sunFragmentShader = resolveGlslIncludes(sunFragmentShaderRaw);

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
          vertexShader: galaxyVertexShader,
          fragmentShader: galaxyFragmentShader,
          side: BackSide,
          depthWrite: false,
          depthTest: false,
        });

        this.galaxyMaterial = skyMat;
        const skybox = new Mesh(skyGeo, skyMat);
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
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
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
      vertexShader: sunVertexShader,
      fragmentShader: sunFragmentShader,
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
