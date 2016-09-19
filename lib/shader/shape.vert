attribute vec4 position;
attribute vec2 uv;
uniform float aspect;
uniform vec2 resolution;
uniform float iGlobalTime;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float dance;
uniform vec2 screenOffset;
// varying vec2 vUv;

#define PI 3.14
#pragma glslify: noise = require('glsl-noise/simplex/3d');

mat4 projectionOffset (float fov, float aspect, float near, float far) {
  float f = 1.0 / tan(fov / 2.0);
  float nf = 1.0 / (near - far);
  float tx = screenOffset.x;
  float ty = screenOffset.y;
  mat4 outMat = mat4(
    vec4(f / aspect, 0.0, 0.0, 0.0),
    vec4(0.0, f, 0.0, 0.0),
    vec4(0.0 - tx, 0.0 - ty, (far + near) * nf, -1.0),
    vec4(0.0, 0.0, (2.0 * far * near) * nf, 0.0)
  );
  return outMat;
}

void offsetProjectionCenter(float xOffset, float xTotalSize, float yOffset, float yTotalSize, mat4 m) {
  // each axis has the scale of -1 to 1 with default at zero.
  // offsetting an axis by 1/TotalPixelSize would be 1/2 pixel.  So 2/Size is a full pixel.
  // or totalSize/2 is just from center to the edge.  So 1/halfPixelSize is a full pixel
  // the offset/(totalSize/2) or 2*offset/totalSize - is the answer
  // m[4].x *= 0.0;
  // -2.0 * yOffset / yTotalSize; // the y axis is reversed with -1 at the top
  // m[2].y += 2.0 * xOffset / xTotalSize;
}

void main() {
  // vUv = uv;
  vec3 offset = vec3(0.0);
  float p = uv.x * 2.0 - 1.0;

  if (dance > 0.0) {
    float nOff = noise(vec3(position.y, iGlobalTime, p * mix(2.0, 5.0, dance)));
    offset.y = 0.5 * nOff;
  }

  vec4 newPosition = vec4(position.xyz + offset.xyz, 1.0);
  mat4 projViewModel = projectionMatrix * modelViewMatrix;
  vec4 currentProjected = projViewModel * newPosition;
  vec2 currentScreen = currentProjected.xy / currentProjected.w;
  // currentScreen.x *= aspect;


  // vec4 worldPos = modelViewMatrix * newPosition;
  // vec4 projected = projectionMatrix * worldPos;

  //into NDC space [-1 .. 1]
  // vec2 currentScreen = projected.xy / projected.w;

  //correct for aspect ratio (screenWidth / screenHeight)
  // currentScreen.x *= aspect;

  // angle = (atan(-1.0 * currentScreen.y, currentScreen.x) + PI * 1.0) / (PI * 2.0);
  
  mat4 tProj = mat4(projectionMatrix);
  tProj[2].x -= screenOffset.x;
  tProj[2].y -= screenOffset.y;
  // mat4 tProj = projectionOffset(75.0 * 3.14 / 180.0, aspect, 0.01, 100.0);
  // offsetProjectionCenter(500.0, resolution.x, 0.0, resolution.y, tProj);
  gl_Position = tProj * modelViewMatrix * newPosition;
}
