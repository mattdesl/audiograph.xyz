attribute vec4 position;
attribute vec2 uv;
uniform float aspect;
uniform float iGlobalTime;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float dance;
// varying vec2 vUv;

#define PI 3.14
#pragma glslify: noise = require('glsl-noise/simplex/3d');

void main() {
  // vUv = uv;
  vec3 offset = vec3(0.0);
  float p = uv.x * 2.0 - 1.0;

  if (dance > 0.0) {
    float nOff = noise(vec3(position.y, iGlobalTime, p * mix(2.0, 5.0, dance)));
    offset.y = 0.5 * nOff;
  }

  vec4 newPosition = vec4(position.xyz + offset.xyz, 1.0);
  vec4 worldPos = modelViewMatrix * newPosition;
  vec4 projected = projectionMatrix * worldPos;

  //into NDC space [-1 .. 1]
  // vec2 currentScreen = projected.xy / projected.w;

  //correct for aspect ratio (screenWidth / screenHeight)
  // currentScreen.x *= aspect;

  // angle = (atan(-1.0 * currentScreen.y, currentScreen.x) + PI * 1.0) / (PI * 2.0);
  gl_Position = projected;
}
