varying vec2 vUv;

void main() {
  vUv = uv;
  vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  clipPos.z = clipPos.w * 0.99999;
  gl_Position = clipPos;
}
