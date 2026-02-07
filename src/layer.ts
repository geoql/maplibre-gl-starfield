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
};

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
  varying vec2 vUv;
  void main() {
    vec3 col = texture2D(tSky, vUv).rgb * uBrightness;
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
  varying float vOpacity;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = vOpacity * smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(uColor * a, a);
  }
`;

class MaplibreStarfieldLayer implements CustomLayerInterface {
  id: string;
  type: 'custom' = 'custom' as const;
  renderingMode: '2d' | '3d' = '3d';

  private starCount: number;
  private starSize: number;
  private starColor: number;
  private galaxyTextureUrl: string | undefined;
  private galaxyBrightness: number;

  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: Camera | null = null;

  constructor(options: MaplibreStarfieldLayerOptions = {}) {
    this.id = options.id ?? 'starfield';
    this.starCount = options.starCount ?? 4000;
    this.starSize = options.starSize ?? 2.0;
    this.starColor = options.starColor ?? 0xffffff;
    this.galaxyTextureUrl = options.galaxyTextureUrl;
    this.galaxyBrightness = options.galaxyBrightness ?? 0.35;
  }

  onAdd(map: MaplibreMap, gl: WebGLRenderingContext): void {
    this.scene = new Scene();
    this.camera = new Camera();

    // --- Galaxy skybox sphere (renders first, behind everything) ---
    if (this.galaxyTextureUrl) {
      const loader = new TextureLoader();
      loader.setCrossOrigin('anonymous');
      const brightness = this.galaxyBrightness;
      const scene = this.scene;

      loader.load(this.galaxyTextureUrl, (texture: Texture) => {
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearFilter;

        const skyGeo = new SphereGeometry(1, 64, 32);
        const skyMat = new ShaderMaterial({
          uniforms: {
            tSky: { value: texture },
            uBrightness: { value: brightness },
          },
          vertexShader: GALAXY_VERTEX_SHADER,
          fragmentShader: GALAXY_FRAGMENT_SHADER,
          side: BackSide,
          depthWrite: false,
          depthTest: false,
        });

        const skybox = new Mesh(skyGeo, skyMat);
        // Insert at index 0 so it renders behind point stars
        scene.children.unshift(skybox);
        map.triggerRepaint();
      });
    }

    // --- Point stars (bright individual stars on top of galaxy) ---
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

    this.scene.add(new Points(geo, mat));

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
  }
}

export type { MaplibreStarfieldLayerOptions };
export { MaplibreStarfieldLayer };
