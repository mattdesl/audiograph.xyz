precision mediump float;

varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 lightScreenPosition;
uniform vec2 resolution;

const float exposure = 0.6;
const float decay = 0.93;
const float density = 0.96;
const float weight = 0.4;
const float maxLight = 1.0;
const int NUM_SAMPLES = 20;


void main () {
  float aspect = resolution.x / resolution.y;
  
  vec2 deltaTextCoord = vec2(vUv - lightScreenPosition.xy);

  vec2 tUv = vUv;
  tUv.x *= aspect;

  vec4 lightColor = vec4(0.0);
  
  vec2 textCoo = vUv;
  deltaTextCoord *= 2.0 / float(NUM_SAMPLES) * density;
  float illuminationDecay = 1.0;

  for(int i = 0; i < NUM_SAMPLES; i++) {
    textCoo -= deltaTextCoord;
    float sample = texture2D(tDiffuse, textCoo).r;
    sample *= illuminationDecay * weight;
    lightColor.rgb += sample;
    illuminationDecay *= decay;
  }
  lightColor *= exposure;
  lightColor = clamp(lightColor, 0.0, maxLight);
  gl_FragColor = lightColor;
}