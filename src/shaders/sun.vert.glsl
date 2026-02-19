varying vec3 vDirection;

void main() {
  vDirection = position;
  vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  clipPos.z = clipPos.w * 0.99998;
  gl_Position = clipPos;
}
