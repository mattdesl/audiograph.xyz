precision highp float;

varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 resolution;

vec3 tex(vec2 uv);

#pragma glslify: blur = require('glsl-hash-blur', sample=tex, iterations=10);
#pragma glslify: luma = require('glsl-luma');

vec3 tex(vec2 uv) {
  vec3 rgb = texture2D(tDiffuse, uv).rgb;
  // float threshold = luma(rgb);
  return rgb;
  // return threshold > 0.2 ? rgb : vec3(0.0);
  // return step(1.0 - t, rgb);
  // return smoothstep(vec3(0.0), vec3(, threshold);
}

void main () {
  float aspect = resolution.x / resolution.y;
  
  //jitter the noise but not every frame
  float tick = 0.0;//floor(fract(iGlobalTime)*20.0);
  float jitter = mod(tick * 382.0231, 21.321);
  
  // vec3 blurred = vec3(0.0);
  // blurred += 0.6 * blur(vUv, 0.3, 1.0 / aspect, jitter);
  
  vec3 blurred = blur(vUv, 0.25, 1.0 / aspect);
  gl_FragColor.rgb = blurred;
  gl_FragColor.a = 1.0;
  // gl_FragColor = texture2D(tDiffuse, vUv);
}