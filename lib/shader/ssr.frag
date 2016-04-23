
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D gBufferNormalRoughness;

uniform float cameraNear;
uniform float cameraFar;
uniform mat4 projectToPixelMatrix;
// uniform mat3 cameraWorldToMatrix;

varying vec2 vUv;
varying vec3 vCameraRay;
varying vec2 vOneDividedByRenderBufferSize; // Optimization: removes 2 divisions every itteration

// Adapted from Unity 5 SSR
// https://github.com/kode80/kode80SSR/blob/master/Assets/Resources/Shaders/SSR.shader
// By Morgan McGuire and Michael Mara at Williams College 2014
// Released as open source under the BSD 2-Clause License
// http://opensource.org/licenses/BSD-2-Clause

// More references:
// http://g3d.cs.williams.edu/websvn/filedetails.php?repname=g3d&path=%2FG3D10%2Fdata-files%2Fshader%2FscreenSpaceRayTrace.glsl&peg=5

uniform mat4 projectionMatrix;           // projection matrix that maps to screen pixels (not NDC)
const float iterations = 15.0;                          // maximum ray iterations
const float binarySearchIterations = 0.0;              // maximum binary search refinement iterations
uniform float constantPixelStride;                         // number of pixels per ray step close to camera
uniform float pixelStrideZCutoff;                  // ray origin Z at this distance will have a pixel stride of 1.0
uniform float maxRayDistance;                      // maximum distance of a ray
uniform float screenEdgeFadeStart;                 // distance to screen edge that ray hits will start to fade (0.0 -> 1.0)
uniform float eyeFadeStart;                        // ray direction's Z that ray hits will start to fade (0.0 -> 1.0)
uniform float eyeFadeEnd;                          // ray direction's Z that ray hits will be cut (0.0 -> 1.0)

uniform vec2 renderBufferSize;

// uniform float cb_strideZCutoff;
uniform float cb_zThickness;

float unpackRGBAToDepth( const in vec4 rgba ) {
  const vec4 bitSh = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );
  return dot( rgba, bitSh );
}

vec3 ScreenSpaceToViewSpace (vec3 cameraRay, float depth) {
    return (cameraRay * depth);
}

void swapIfBigger (inout float aa, inout float bb) {
    if( aa > bb) {
        float tmp = aa;
        aa = bb;
        bb = tmp;
    }
}

float fetchLinearDepth (vec2 depthUV) {
    float cameraFarPlusNear = cameraFar + cameraNear;
    float cameraFarMinusNear = cameraFar - cameraNear;
    float cameraCoef = 2.0 * cameraNear;
    return cameraCoef / (cameraFarPlusNear - texture2D( tDepth, depthUV ).x * cameraFarMinusNear);
}

bool rayIntersectsDepthBuffer (float minZ, float maxZ, vec2 depthUV) {
    /*
    * Based on how far away from the camera the depth is,
    * adding a bit of extra thickness can help improve some
    * artifacts. Driving this value up too high can cause
    * artifacts of its own.
    */
    float z = fetchLinearDepth(depthUV) * -cameraFar;
    float depthScale = min(1.0, z);
    z += cb_zThickness + mix(0.0, 2.0, depthScale);
    return (maxZ >= z) && (minZ - cb_zThickness <= z);
}

float distanceSquared( vec2 a, vec2 b) {
    a -= b;
    return dot(a, a);
}

// Trace a ray in screenspace from rayOrigin (in camera space) pointing in rayDirection (in camera space)
// using jitter to offset the ray based on (jitter * pixelStride).
//
// Returns true if the ray hits a pixel in the depth buffer
// and outputs the hitPixel (in UV space), the hitPoint (in camera space) and the number
// of iterations it took to get there.
//
// Based on Morgan McGuire & Mike Mara's GLSL implementation:
// http://casual-effects.blogspot.com/2014/08/screen-space-ray-tracing.html
bool traceScreenSpaceRay( vec3 rayOrigin, 
                                 vec3 rayDirection, 
                                 float jitter, 
                                 out vec2 hitPixel, 
                                 out vec3 hitPoint, 
                                 out float iterationCount,
                                 out float debug) 
{
    // Clip to the near plane    
    float rayLength = ((rayOrigin.z + rayDirection.z * maxRayDistance) > -cameraNear) ?
                      (-cameraNear - rayOrigin.z) / rayDirection.z : maxRayDistance;
    vec3 rayEnd = rayOrigin + rayDirection * rayLength;
    
    // Project into homogeneous clip space
    vec4 H0 = projectToPixelMatrix * vec4(rayOrigin, 1.0);
    vec4 H1 = projectToPixelMatrix * vec4(rayEnd, 1.0);
    
    float k0 = 1.0 / H0.w;
    float k1 = 1.0 / H1.w;

    // The interpolated homogeneous version of the camera-space points  
    vec3 Q0 = rayOrigin * k0;
    vec3 Q1 = rayEnd * k1;
    
    // Screen-space endpoints
    vec2 P0 = H0.xy * k0;
    vec2 P1 = H1.xy * k1;
    
    // If the line is degenerate, make it cover at least one pixel
    // to avoid handling zero-pixel extent as a special case later
    P1 += (distanceSquared(P0, P1) < 0.0001) ? 0.01 : 0.0;
    
    vec2 delta = P1 - P0;
 
    // Permute so that the primary iteration is in x to collapse
    // all quadrant-specific DDA cases later
    bool permute = false;
    if (abs(delta.x) < abs(delta.y)) { 
        // This is a more-vertical line
        permute = true; delta = delta.yx; P0 = P0.yx; P1 = P1.yx; 
    }
 
    float stepDir = sign(delta.x);
    float invdx = stepDir / delta.x;
 
    // Track the derivatives of Q and k
    vec3  dQ = (Q1 - Q0) * invdx;
    float dk = (k1 - k0) * invdx;
    vec2  dP = vec2(stepDir, delta.y * invdx);
 
    // Calculate pixel stride based on distance of ray origin from camera.
    // Since perspective means distant objects will be smaller in screen space
    // we can use this to have higher quality reflections for far away objects
    // while still using a large pixel stride for near objects (and increase performance)
    // this also helps mitigate artifacts on distant reflections when we use a large
    // pixel stride.
    float strideScaler = 1.0 - min(1.0, -rayOrigin.z / pixelStrideZCutoff);
    float pixelStride = 1.0 + strideScaler * constantPixelStride;
    
    // Scale derivatives by the desired pixel stride and then
    // offset the starting values by the jitter fraction
    dP *= pixelStride; dQ *= pixelStride; dk *= pixelStride;
    P0 += dP * jitter; Q0 += dQ * jitter; k0 += dk * jitter;
  
    float i = 0.0;
    float zA = 0.0;
    float zB = 0.0;
    
    // Track ray step and derivatives in a vec4 to parallelize
    vec4 pqk = vec4(P0, Q0.z, k0);
    vec4 dPQK = vec4(dP, dQ.z, dk);
    bool intersect = false;
    float numIterations = 0.0;
    for (float i = 0.0; i < iterations; i += 1.0) {
        pqk += dPQK;
        
        zA = zB;
        zB = (dPQK.z * 0.5 + pqk.z) / (dPQK.w * 0.5 + pqk.w);
        swapIfBigger(zB, zA);
        
        hitPixel = permute ? pqk.yx : pqk.xy;
        hitPixel *= vOneDividedByRenderBufferSize;
        // hitPixel.y = 1.0 - hitPixel.y;

        intersect = rayIntersectsDepthBuffer(zA, zB, hitPixel);
        numIterations += 1.0;
        if (intersect == true) break;
    }
    
    debug = intersect ? 1.0 : 0.0;
    
    // Binary search refinement
    if( pixelStride > 1.0 && intersect )
    {
        pqk -= dPQK;
        dPQK /= pixelStride;
        
        float originalStride = pixelStride * 0.5;
        float stride = originalStride;
        
        zA = pqk.z / pqk.w;
        zB = zA;
        
        for( float j=0.0; j<binarySearchIterations; j+=1.0)
        {
            pqk += dPQK * stride;

            zA = zB;
            zB = (dPQK.z * -0.5 + pqk.z) / (dPQK.w * -0.5 + pqk.w);
            swapIfBigger( zB, zA);
            
            hitPixel = permute ? pqk.yx : pqk.xy;
            hitPixel *= vOneDividedByRenderBufferSize;
            
            originalStride *= 0.5;
            stride = rayIntersectsDepthBuffer(zA, zB, hitPixel) ? -originalStride : originalStride;
        }
    }

    Q0.xy += dQ.xy * numIterations;
    Q0.z = pqk.z;
    hitPoint = Q0 / pqk.w;
    iterationCount = numIterations;
    return intersect;
}

float calculateAlphaForIntersection( bool intersect, 
                                           float iterationCount, 
                                           float specularStrength,
                                           vec2 hitPixel,
                                           vec3 hitPoint,
                                           vec3 vsRayOrigin,
                                           vec3 vsRayDirection)
{
    float alpha = min( 1.0, specularStrength * 1.0);
    
    // Fade ray hits that approach the maximum iterations
    alpha *= 1.0 - (iterationCount / iterations);
    
    // Fade ray hits that approach the screen edge
    float screenFade = screenEdgeFadeStart;
    vec2 hitPixelNDC = (hitPixel * 2.0 - 1.0);
    float maxDimension = min(1.0, max(abs(hitPixelNDC.x), abs(hitPixelNDC.y)));
    alpha *= 1.0 - (max(0.0, maxDimension - screenFade) / (1.0 - screenFade));
    
    // Fade ray hits base on how much they face the camera
    float eyeFadeStart = eyeFadeStart;
    float eyeFadeEnd = eyeFadeEnd;
    swapIfBigger( eyeFadeStart, eyeFadeEnd);
    
    float eyeDirection = clamp( vsRayDirection.z, eyeFadeStart, eyeFadeEnd);
    alpha *= 1.0 - ((eyeDirection - eyeFadeStart) / (eyeFadeEnd - eyeFadeStart));
    
    // Fade ray hits based on distance from ray origin
    alpha *= 1.0 - clamp( distance( vsRayOrigin, hitPoint) / maxRayDistance, 0.0, 1.0);
    alpha *= intersect ? 1.0 : 0.0;
    
    return alpha;
}

float trunc (float x) {
  return float(int(x));
}

float fmod (float x, float y) {
  return x - y * trunc(x/y);
}

void main () {
  vec4 gBufferData = texture2D(gBufferNormalRoughness, vUv);
  float specularRoughness = gBufferData.a;
  
  float decodedDepth = fetchLinearDepth(vUv);
  vec3 viewSpaceRayOrigin = ScreenSpaceToViewSpace(vCameraRay, decodedDepth);

  vec3 decodedNormal = gBufferData.rgb;
  vec3 viewSpaceRayDirection = normalize(reflect(normalize(viewSpaceRayOrigin), normalize(decodedNormal)));
  
  vec2 hitPixel; 
  vec3 hitPoint;
  float iterationCount;

  vec2 uv2 = vUv * renderBufferSize;
  float c = (uv2.x + uv2.y) * 0.25;
  float jitter = fmod(c, 1.0); // TODO: replace with glsl mod?
  float debug = 0.0;
  bool intersect = traceScreenSpaceRay(
    viewSpaceRayOrigin,
    viewSpaceRayDirection,
    jitter,
    hitPixel,
    hitPoint,
    iterationCount, debug);
  float alpha = calculateAlphaForIntersection(intersect, iterationCount, specularRoughness, hitPixel, hitPoint, viewSpaceRayOrigin, viewSpaceRayDirection);
  hitPixel = mix(vUv, hitPixel, intersect ? 1.0 : 0.0);

  vec4 originalPixel = texture2D(tDiffuse, vUv);
  vec4 ssrPixel = texture2D(tDiffuse, hitPixel);
  
  gl_FragColor = originalPixel;
  gl_FragColor.rgb = ssrPixel.rgb;
  // gl_FragColor = vec4((ssrPixel.rgb * ssrPixel.a) + (originalPixel.rgb * (1.0 - ssrPixel.a)), 1.0);
  // gl_FragColor = mix(gl_FragColor, originalPixel, 1.0 - alpha);
  // gl_FragColor = vec4(vec3(decodedDepth), 1.0);
  
  // float depth = 1.0 - clamp((1.0 - readDepth()), 0.0, 1.0) * depthRatio;
  // gl_FragColor = applyFog(readDepth());
  // gl_FragColor = vec4(vec3(readDepth()), 1.0);
}