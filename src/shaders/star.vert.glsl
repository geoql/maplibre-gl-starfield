attribute float aSize;
attribute float aOpacity;

varying float vOpacity;

void main() {
  vOpacity = aOpacity;
  vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  clipPos.z = clipPos.w * 0.9999;
  gl_Position = clipPos;
  gl_PointSize = aSize;
}
