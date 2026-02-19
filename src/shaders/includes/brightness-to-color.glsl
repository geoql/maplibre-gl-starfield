// eclipseSimulator exact color function
// Maps scalar brightness to warm orange → golden → white gradient
// See: https://github.com/Shahnab/eclipseSimulator

vec3 brightnessToColor(float b) {
  b *= 0.25;
  return (vec3(b, b * b, b * b * b * b) / 0.25) * 0.8;
}
