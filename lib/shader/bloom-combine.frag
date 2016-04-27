precision mediump float;

varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tBloomDiffuse;
uniform vec2 resolution;

void main () {
  vec4 blurred = texture2D(tBloomDiffuse, vUv);
  blurred.rgb *= 0.5;
  gl_FragColor = texture2D(tDiffuse, vUv) + blurred;
}