attribute vec4 position;
attribute vec2 uv;
attribute vec3 centroid;
uniform float iGlobalTime;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float dance;
uniform float animate;
uniform vec2 screenOffset;
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

  vec4 newPosition = vec4(position.xyz, 1.0);
  newPosition.xyz = mix(centroid.xyz, newPosition.xyz, animate) + offset.xyz;
  // newPosition.xyz = mix(centroid.xyz + offset.xyz, newPosition.xyz, animate);

  mat4 tProj = mat4(projectionMatrix);
  tProj[2].x -= screenOffset.x;
  tProj[2].y -= screenOffset.y;
  gl_Position = tProj * modelViewMatrix * newPosition;
}
