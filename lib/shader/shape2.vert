attribute vec4 position;
attribute vec2 uv;
uniform float aspect;
uniform float iGlobalTime;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float dance;
varying vec2 vUv;
varying float angle;

#define PI 3.14
#pragma glslify: noise = require('glsl-noise/simplex/4d');
#pragma glslify: noise3d = require('glsl-noise/simplex/3d');

void main() {
  // vUv = uv;
  vec3 offset = vec3(0.0);
  float p = uv.x * 2.0 - 1.0;

  angle = (atan(-1.0 * position.y, position.x) + PI * 1.0) / (PI * 2.0);

  float theta = 1.0 * noise3d(vec3(position.y, angle, 0.25 * iGlobalTime));
  // mat3 rotMat = mat3(
  //   vec3(cos(theta), 0.0, sin(theta)),
  //   vec3(0.0, 1.0, 0.0),
  //   vec3(-sin(theta), 0.0, cos(theta))
  // );

  mat3 rotMat = mat3(
    vec3(1.0, 0.0, 0.0),
    vec3(0.0, cos(theta), -sin(theta)),
    vec3(0.0, sin(theta), cos(theta))
  );

  if (dance > 0.0) {
    float strength = 0.5;
    offset.y = strength * noise(vec4(position.x, position.y, position.z, p * mix(2.0, 5.0, dance)));
  }
  // offset *= theta;

  vec4 newPosition = vec4(position.xyz + offset.xyz, 1.0);
  // newPosition.xyz = newPosition.xyz * rotMat;

  vec4 worldPos = modelViewMatrix * newPosition;
  vec4 projected = projectionMatrix * worldPos;

  //into NDC space [-1 .. 1]
  vec2 currentScreen = projected.xy / projected.w;

  //correct for aspect ratio (screenWidth / screenHeight)
  currentScreen.x *= aspect;

  gl_Position = projected;
}
