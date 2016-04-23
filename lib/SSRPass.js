const glslify = require('glslify');

module.exports = SSRPass;
function SSRPass (renderer, camera) {
  this.camera = camera;
  this.renderer = renderer;

  this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  this.postScene = new THREE.Scene();

  this.color = [255, 255, 255];

  this.distances = {
    min: 0.5,
    max: 1
  };
  this.uniforms = {
    tDiffuse: { type: 't', value: null },
    tDepth: { type: 't', value: null },
    cameraNear: { type: 'f', value: camera.near },
    cameraFar: { type: 'f', value: camera.far },
    gBufferNormalRoughness: { type: 't', value: null },
    inverseProjectionMatrix: { type: 'm4', value: new THREE.Matrix4() },
    projectToPixelMatrix: { type: 'm4', value: new THREE.Matrix4() },
    // iterations: { type: 'f', value: 20 },
    // binarySearchIterations: { type: 'f', value: 0 },
    constantPixelStride: { type: 'f', value: 100 },
    pixelStrideZCutoff: { type: 'f', value: 0.5 },
    maxRayDistance: { type: 'f', value: 400 },
    screenEdgeFadeStart: { type: 'f', value: 0.5 },
    eyeFadeStart: { type: 'f', value: 0 },
    eyeFadeEnd: { type: 'f', value: 1 },
    renderBufferSize: { type: 'v2', value: new THREE.Vector2() },
    cb_zThickness: { type: 'f', value: 10 },
  };

  this.material = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: glslify(__dirname + '/shader/ssr.vert'),
    fragmentShader: glslify(__dirname + '/shader/ssr.frag')
  });

  this.postQuad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), this.material);
  this.postQuad.name = 'ssr-post-quad';
  this.postScene.add(this.postQuad);

  this.enabled = true;
  this.clear = true;
  this.needsSwap = true;

  this._lastWidth = null;
  this._lastHeight = null;
}

SSRPass.prototype = {

  render: function (renderer, writeBuffer, readBuffer, delta, maskActive, depthTexture, attachments) {
    var finalBuffer = this.renderToScreen ? undefined : writeBuffer;

    this.material.uniforms.tDiffuse.value = readBuffer;
    this.material.uniforms.tDepth.value = depthTexture;
    this.material.uniforms.gBufferNormalRoughness.value = attachments[1];
    this.material.uniforms.cameraNear.value = this.camera.near;
    this.material.uniforms.cameraFar.value = this.camera.far;
    this.material.uniforms.inverseProjectionMatrix.value.getInverse(this.camera.projectionMatrix);
    
    var width = readBuffer.width;
    var height = readBuffer.height;
    this.material.uniforms.renderBufferSize.value.set(width, height);
    
    
    var T = new THREE.Matrix4().makeTranslation(0.5, 0.5, 0);
    var S = new THREE.Matrix4().makeScale(0.5, 0.5, 1.0);
    var screenScale = new THREE.Matrix4().makeScale(width, height, 1.0);
    var projToPixel = this.material.uniforms.projectToPixelMatrix.value;
    T.multiply(S);
    screenScale.multiply(T).multiply(this.camera.projectionMatrix)
    projToPixel.copy(screenScale);

    renderer.render(this.postScene, this.postCamera, finalBuffer);
  }
};
