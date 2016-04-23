uniform vec2 renderBufferSize;
uniform mat4 inverseProjectionMatrix;
varying vec2 vUv;
varying vec3 vCameraRay;
varying vec2 vOneDividedByRenderBufferSize; // Optimization: removes 2 divisions every itteration

void main() {
  vUv = uv;

  vec4 cameraRay = vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  cameraRay = inverseProjectionMatrix * cameraRay;
  vCameraRay = (cameraRay / cameraRay.w).xyz;
  vOneDividedByRenderBufferSize = 1.0 / renderBufferSize;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
}
