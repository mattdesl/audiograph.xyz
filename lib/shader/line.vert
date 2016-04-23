attribute vec3 position;
attribute float direction;
attribute vec3 nextPosition;
attribute vec3 previousPosition;

uniform mat4 modelViewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;

uniform float thickness;
uniform float iGlobalTime;
uniform float aspect;
uniform bool miter;

vec4 line3D (vec3 positionOffset, float computedThickness) {
  vec2 aspectVec = vec2(aspect, 1.0);
  mat4 projViewModel = projectionMatrix * modelViewMatrix;
  vec4 previousProjected = projViewModel * vec4(previousPosition + positionOffset, 1.0);
  vec4 currentProjected = projViewModel * vec4(position + positionOffset, 1.0);
  vec4 nextProjected = projViewModel * vec4(nextPosition + positionOffset, 1.0);

  //get 2D screen space with W divide and aspect correction
  vec2 currentScreen = currentProjected.xy / currentProjected.w * aspectVec;
  vec2 previousScreen = previousProjected.xy / previousProjected.w * aspectVec;
  vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;

  float len = computedThickness;
  float orientation = direction;

  //starting point uses (next - current)
  vec2 dir = vec2(0.0);
  if (currentScreen == previousScreen) {
    dir = normalize(nextScreen - currentScreen);
  } 
  //ending point uses (current - previous)
  else if (currentScreen == nextScreen) {
    dir = normalize(currentScreen - previousScreen);
  }
  //somewhere in middle, needs a join
  else {
    //get directions from (C - B) and (B - A)
    vec2 dirA = normalize((currentScreen - previousScreen));
    if (miter) {
      vec2 dirB = normalize((nextScreen - currentScreen));
      //now compute the miter join normal and length
      vec2 tangent = normalize(dirA + dirB);
      vec2 perp = vec2(-dirA.y, dirA.x);
      vec2 miter = vec2(-tangent.y, tangent.x);
      dir = tangent;
      len = computedThickness / dot(miter, perp);
    } else {
      dir = dirA;
    }
  }
  vec2 normal = vec2(-dir.y, dir.x);
  normal *= len/2.0;
  normal.x /= aspect;

  vec4 offset = vec4(normal * orientation, 0.0, 1.0);
  return currentProjected + offset;
}

void main () {
  gl_Position = line3D(vec3(0.0), thickness);  
}