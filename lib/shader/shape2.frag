#extension GL_OES_standard_derivatives : enable
precision mediump float;
uniform vec3 color;
// varying vec2 vUv;
varying float angle;

#pragma glslify: aastep = require('glsl-aastep');

void main () {
  vec3 rgb = color;
  // float pattern = sin(angle * 100.0) * 0.5 + 0.5;
  // pattern = aastep(0.5, pattern);
  gl_FragColor = vec4(rgb, 1.0);
  // gl_FragColor.a *= pattern;
  // if (gl_FragColor.a < 0.001) discard;
}