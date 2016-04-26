precision mediump float;

varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tLightDiffuse;
uniform vec2 resolution;
uniform float grainOpacity;
uniform float grainSize;
uniform float grainLumLow;
uniform float grainLumHigh;
uniform float time;
uniform vec3 color;

void main () {
  vec4 diffuseColor = texture2D(tDiffuse, vUv);
  vec4 lightColor = texture2D(tLightDiffuse, vUv);
  gl_FragColor = diffuseColor + lightColor;

  #ifdef GAMMA_OUTPUT
    gl_FragColor.rgb = color * pow(gl_FragColor.rgb, vec3(1.0 / GAMMA_OUTPUT));
  #endif
}
