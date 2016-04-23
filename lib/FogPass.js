const glslify = require('glslify');

module.exports = FogPass;
function FogPass (renderer, camera) {
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
    color: { type: 'v3', value: new THREE.Vector3(1, 1, 1) },
    depthOffset: { type: 'f', value: 1459 },
    minCamDistance: { type: 'f', value: 1 },
    maxCamDistance: { type: 'f', value: 1 },
    fogLimit: { type: 'f', value: 1 },
    depthRatio: { type: 'f', value: 2.1 },
    fogRatio: { type: 'f', value: 1 },
    fogExp: { type: 'f', value: 3.5 },
    camLength: { type: 'f', value: 0 },
    tDiffuse: { type: 't', value: null },
    tDepth: { type: 't', value: null },
    cameraNear: { type: 'f', value: camera.near },
    cameraFar: { type: 'f', value: camera.far },
    gBufferNormalRoughness: { type: 't', value: null }
  };

  this.material = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: glslify(__dirname + '/shader/post.vert'),
    fragmentShader: glslify(__dirname + '/shader/post.frag')
  });

  this.postQuad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), this.material);
  this.postQuad.name = 'fog-post-quad';
  this.postScene.add(this.postQuad);

  this.enabled = true;
  this.clear = true;
  this.needsSwap = true;

  this._lastWidth = null;
  this._lastHeight = null;
}

FogPass.prototype = {

  render: function (renderer, writeBuffer, readBuffer, delta, maskActive, depthTexture, attachments) {
    var finalBuffer = this.renderToScreen ? undefined : writeBuffer;

    this.material.uniforms.tDiffuse.value = readBuffer;
    this.material.uniforms.tDepth.value = depthTexture;
    this.material.uniforms.gBufferNormalRoughness.value = attachments ? attachments[1] : null;
    this.material.uniforms.cameraNear.value = this.camera.near;
    this.material.uniforms.cameraFar.value = this.camera.far;
    this.material.uniforms.camLength.value = this.camera.position.length();
    this.material.uniforms.oneDvidied
    renderer.render(this.postScene, this.postCamera, finalBuffer);
  }
};
