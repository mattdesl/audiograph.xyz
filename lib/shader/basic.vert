attribute vec4 position;
attribute vec2 uv;
uniform float aspect;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform vec2 screenOffset;

void main () {
  mat4 tProj = mat4(projectionMatrix);
  tProj[2].x -= screenOffset.x;
  tProj[2].y -= screenOffset.y;
  gl_Position = tProj * modelViewMatrix * position;
}