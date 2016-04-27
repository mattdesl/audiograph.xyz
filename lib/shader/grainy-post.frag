#define LUT_FLIP_Y

varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float iGlobalTime;
uniform sampler2D tLookup;

vec3 tex(vec2 uv);

#pragma glslify: blur = require('glsl-hash-blur', sample=tex, iterations=10)

vec3 tex(vec2 uv) {
  return texture2D(tDiffuse, uv).rgb;
}

void main () {
  float aspect = resolution.x / resolution.y;
  
  //jitter the noise but not every frame
  float tick = floor(fract(iGlobalTime)*20.0);
  float jitter = mod(tick * 382.0231, 21.321);
  
  vec3 blurred = vec3(0.0);
  blurred += 0.6 * blur(vUv, 0.3, 1.0 / aspect, jitter);
  
  gl_FragColor = texture2D(tDiffuse, vUv);
  gl_FragColor.rgb += blurred;
  gl_FragColor.a = 1.0;
}