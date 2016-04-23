// Adapted from Unity 5 SSR
// https://github.com/kode80/kode80SSR/blob/master/Assets/Resources/Shaders/SSR.shader
// By Morgan McGuire and Michael Mara at Williams College 2014
// Released as open source under the BSD 2-Clause License
// http://opensource.org/licenses/BSD-2-Clause

sampler2D _MainTex;
sampler2D _CameraDepthTexture;
sampler2D _BackFaceDepthTex;

sampler2D _CameraGBufferTexture0;   // Diffuse color (RGB), unused (A)
sampler2D _CameraGBufferTexture1;   // Specular color (RGB), roughness (A)
sampler2D _CameraGBufferTexture2;   // World space normal (RGB), unused (A)
sampler2D _CameraGBufferTexture3;   // ARGBHalf (HDR) format: Emission + lighting + lightmaps + reflection probes buffer

mat4x4 _CameraProjectionMatrix;           // projection matrix that maps to screen pixels (not NDC)
mat4x4 _CameraInverseProjectionMatrix;    // inverse projection matrix (NDC to camera space)
float _Iterations;                          // maximum ray iterations
float _BinarySearchIterations;              // maximum binary search refinement iterations
float _PixelZSize;                          // Z size in camera space of a pixel in the depth buffer
float _PixelStride;                         // number of pixels per ray step close to camera
float _PixelStrideZCuttoff;                 // ray origin Z at this distance will have a pixel stride of 1.0
float _MaxRayDistance;                      // maximum distance of a ray
float _ScreenEdgeFadeStart;                 // distance to screen edge that ray hits will start to fade (0.0 -> 1.0)
float _EyeFadeStart;                        // ray direction's Z that ray hits will start to fade (0.0 -> 1.0)
float _EyeFadeEnd;                          // ray direction's Z that ray hits will be cut (0.0 -> 1.0)

mat4x4 _NormalMatrix;
vec2 _RenderBufferSize;
vec2 _OneDividedByRenderBufferSize;       // Optimization: removes 2 divisions every itteration

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
    float z = fetchLinearDepth(depthUV);
    
    /*
    * Based on how far away from the camera the depth is,
    * adding a bit of extra thickness can help improve some
    * artifacts. Driving this value up too high can cause
    * artifacts of its own.
    */
    float depthScale = min(1.0f, z * cb_strideZCutoff);
    z += cb_zThickness + mix(0.0f, 2.0f, depthScale);
    return (maxZ >= z) && (minZ - cb_zThickness <= z);
}

float distanceSquared( vec2 a, vec2 b) {
    a -= b;
    return dot(a, a);
}

// Trace a ray in screenspace from rayOrigin (in camera space) pointing in rayDirection (in camera space)
// using jitter to offset the ray based on (jitter * _PixelStride).
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
                                 out float iterationCount) 
{
    // Clip to the near plane    
    float rayLength = ((rayOrigin.z + rayDirection.z * _MaxRayDistance) > -_ProjectionParams.y) ?
                      (-_ProjectionParams.y - rayOrigin.z) / rayDirection.z : _MaxRayDistance;
    vec3 rayEnd = rayOrigin + rayDirection * rayLength;
 
    // Project into homogeneous clip space
    vec4 H0 = _CameraProjectionMatrix * vec4(rayOrigin, 1.0));
    vec4 H1 = _CameraProjectionMatrix * vec4(rayEnd, 1.0));
    
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
    float strideScaler = 1.0 - min(1.0, -rayOrigin.z / _PixelStrideZCuttoff);
    float pixelStride = 1.0 + strideScaler * _PixelStride;
    
    // Scale derivatives by the desired pixel stride and then
    // offset the starting values by the jitter fraction
    dP *= pixelStride; dQ *= pixelStride; dk *= pixelStride;
    P0 += dP * jitter; Q0 += dQ * jitter; k0 += dk * jitter;
 
    float i = 0.0;
    float zA = 0.0;
    float zB = 0.0;
    
    // Track ray step and derivatives in a vec4 to parallelize
    vec4 pqk = vec4( P0, Q0.z, k0);
    vec4 dPQK = vec4( dP, dQ.z, dk);
    bool intersect = false;
    
    for( i=0; i<_Iterations && intersect == false; i++)
    {
        pqk += dPQK;
        
        zA = zB;
        zB = (dPQK.z * 0.5 + pqk.z) / (dPQK.w * 0.5 + pqk.w);
        swapIfBigger(zB, zA);
        
        hitPixel = permute ? pqk.yx : pqk.xy;
        hitPixel *= _OneDividedByRenderBufferSize;
        
        intersect = rayIntersectsDepthBuffer(zA, zB, hitPixel);
    }
    
    // Binary search refinement
    if( pixelStride > 1.0 && intersect)
    {
        pqk -= dPQK;
        dPQK /= pixelStride;
        
        float originalStride = pixelStride * 0.5;
        float stride = originalStride;
        
        zA = pqk.z / pqk.w;
        zB = zA;
        
        for( float j=0; j<_BinarySearchIterations; j++)
        {
            pqk += dPQK * stride;
            
            zA = zB;
            zB = (dPQK.z * -0.5 + pqk.z) / (dPQK.w * -0.5 + pqk.w);
            swapIfBigger( zB, zA);
            
            hitPixel = permute ? pqk.yx : pqk.xy;
            hitPixel *= _OneDividedByRenderBufferSize;
            
            originalStride *= 0.5;
            stride = rayIntersectsDepthBF( zA, zB, hitPixel) ? -originalStride : originalStride;
        }
    }

    Q0.xy += dQ.xy * i;
    Q0.z = pqk.z;
    hitPoint = Q0 / pqk.w;
    iterationCount = i;
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
    alpha *= 1.0 - (iterationCount / _Iterations);
    
    // Fade ray hits that approach the screen edge
    float screenFade = _ScreenEdgeFadeStart;
    vec2 hitPixelNDC = (hitPixel * 2.0 - 1.0);
    float maxDimension = min( 1.0, max( abs( hitPixelNDC.x), abs( hitPixelNDC.y)));
    alpha *= 1.0 - (max( 0.0, maxDimension - screenFade) / (1.0 - screenFade));
    
    // Fade ray hits base on how much they face the camera
    float eyeFadeStart = _EyeFadeStart;
    float eyeFadeEnd = _EyeFadeEnd;
    swapIfBigger( eyeFadeStart, eyeFadeEnd);
    
    float eyeDirection = clamp( vsRayDirection.z, eyeFadeStart, eyeFadeEnd);
    alpha *= 1.0 - ((eyeDirection - eyeFadeStart) / (eyeFadeEnd - eyeFadeStart));
    
    // Fade ray hits based on distance from ray origin
    alpha *= 1.0 - clamp( distance( vsRayOrigin, hitPoint) / _MaxRayDistance, 0.0, 1.0);
    
    alpha *= intersect;
    
    return alpha;
}

void main () {
    
    half4 specRoughPixel = tex2D( _CameraGBufferTexture1, i.uv);
    vec3 specularStrength = specRoughPixel.a;
    
    float decodedDepth = Linear01Depth( tex2D( _CameraDepthTexture, i.uv).r);
    
    vec3 vsRayOrigin = ScreenSpaceToViewSpace( i.cameraRay, decodedDepth);
    
    vec3 decodedNormal = (tex2D( _CameraGBufferTexture2, i.uv)).rgb * 2.0 - 1.0;
    decodedNormal = mul( (float3x3)_NormalMatrix, decodedNormal);
    
    vec3 vsRayDirection = normalize( reflect( normalize( vsRayOrigin), normalize(decodedNormal)));
    
    vec2 hitPixel; 
    vec3 hitPoint;
    float iterationCount;
    
    vec2 uv2 = i.uv * _RenderBufferSize;
    float c = (uv2.x + uv2.y) * 0.25;
    float jitter = fmod( c, 1.0);

    bool intersect = traceScreenSpaceRay( vsRayOrigin, vsRayDirection, jitter, hitPixel, hitPoint, iterationCount, i.uv.x > 0.5);
    float alpha = calculateAlphaForIntersection( intersect, iterationCount, specularStrength, hitPixel, hitPoint, vsRayOrigin, vsRayDirection);
    hitPixel = lerp( i.uv, hitPixel, intersect);
    
    // Comment out the line below to get faked specular,
    // in no way physically correct but will tint based
    // on spec. Physically correct handling of spec is coming...
    specRoughPixel = half4( 1.0, 1.0, 1.0, 1.0);
    
    return half4( (tex2D( _MainTex, hitPixel)).rgb * specRoughPixel.rgb, alpha);
}