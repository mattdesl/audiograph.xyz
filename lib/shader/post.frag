uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D gBufferNormalRoughness;

uniform float cameraNear;
uniform float cameraFar;
uniform float camLength;
uniform float fogRatio;
uniform float fogExp;
uniform float depthOffset;
uniform float depthRatio;
const vec3 fogColor = vec3(0.85, 0.85, 0.85);
varying vec2 vUv;

vec4 applyFog(in float dist) // camera to point distance
{
  vec4 texelColor = texture2D( tDiffuse, vUv ); // original pixel color

  float fogAmount = fogRatio * (1.0 - exp(-dist * fogExp));
  fogAmount = clamp(fogAmount, 0.0, 1.0);
  texelColor.rgb = mix(texelColor.rgb, fogColor, fogAmount);
  return texelColor;
}

float readDepth () {
  float cameraFarPlusNear = cameraFar + cameraNear;
  float cameraFarMinusNear = cameraFar - cameraNear;
  float cameraCoef = 2.0 * cameraNear;
  return cameraCoef / ( cameraFarPlusNear - texture2D( tDepth, vUv ).x * cameraFarMinusNear );
}

void main () {
  // gl_FragColor = vec4(texture2D(gBufferNormalRoughness, vUv).rgb, 1.0);
  // gl_FragColor = vec4(vec3(readDepth()), 1.0);
  
  // float depth = 1.0 - clamp((1.0 - readDepth()), 0.0, 1.0) * depthRatio;
  gl_FragColor = applyFog(readDepth());
  // gl_FragColor = vec4(vec3(readDepth()), 1.0);
}