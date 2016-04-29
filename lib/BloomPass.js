const glslify = require('glslify');
const clamp = require('clamp');
const CopyShader = require('three-copyshader');
const isMobile = require('./isMobile');
const downsample = 2;
const maxSize = 4096;

module.exports = BloomPass;
function BloomPass (scene, camera, opt = {}) {
  this.scene = scene;
  this.camera = camera;

  this.debugCopyShader = new THREE.ShaderMaterial(CopyShader);

  this._lastWidth = null;
  this._lastHeight = null;
  this._blurTarget = null; // lazily created
  this._thresholdTarget = null;

  this.enabled = true;
  this.needsSwap = true;
  this.oldColor = new THREE.Color();
  this.oldAlpha = 1;
  this.clearColor = new THREE.Color('#fff');
  this.clearAlpha = 0;

  this.postShader = new THREE.RawShaderMaterial({
    vertexShader: glslify(__dirname + '/shader/pass.vert'),
    fragmentShader: glslify(__dirname + '/shader/bloom-blur.frag'),
    uniforms: {
      tDiffuse: { type: 't', value: null },
      resolution: { type: 'v2', value: new THREE.Vector2(1, 1) }
    }
  });
  this.postShader.name = 'bloom-blur-material';

  this.combineShader = new THREE.RawShaderMaterial({
    vertexShader: glslify(__dirname + '/shader/pass.vert'),
    fragmentShader: glslify(__dirname + '/shader/bloom-combine.frag'),
    uniforms: {
      resolution: { type: 'v2', value: new THREE.Vector2() },
      tDiffuse: { type: 't', value: null },
      tBloomDiffuse: { type: 't', value: null }
    }
  });
  this.combineShader.name = 'bloom-combine-material';

  this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  this.postScene = new THREE.Scene();

  this.postQuad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2));
  this.postQuad.name = 'godray-post-quad';
  this.postScene.add(this.postQuad);

  this.renderToScreen = false;
}

BloomPass.prototype = {

  _updateTargets: function (renderTarget) {
    var width = renderTarget.width;
    var height = renderTarget.height;
    var downWidth = clamp(Math.floor(width / downsample), 2, maxSize);
    var downHeight = clamp(Math.floor(height / downsample), 2, maxSize);
    if (!this._thresholdTarget || !this._blurTarget) {      
      this._blurTarget = new THREE.WebGLRenderTarget(downWidth, downHeight);
      this._blurTarget.texture.minFilter = THREE.LinearFilter;
      this._blurTarget.texture.magFilter = THREE.LinearFilter;
      this._blurTarget.texture.generateMipmaps = false;
      this._blurTarget.depthBuffer = true;
      this._blurTarget.stencilBuffer = false;
      this._thresholdTarget = this._blurTarget.clone();
    } else if (this._thresholdTarget.width !== width || this._thresholdTarget.height !== height) {
      this._thresholdTarget.setSize(downWidth, downHeight);
      this._blurTarget.setSize(downWidth, downHeight);
    }
  },

  render: function (renderer, writeBuffer, readBuffer, delta) {
    this._updateTargets(readBuffer);
    var finalBuffer = this.renderToScreen ? undefined : writeBuffer;

    // 1. First, render scene into downsampled FBO and threshold color
    this.oldColor.copy(renderer.getClearColor());
    this.oldAlpha = renderer.getClearAlpha();
    var oldAutoClear = renderer.autoClear;

    // Clear target
    renderer.setClearColor(this.clearColor, this.clearAlpha);
    renderer.autoClear = false;
    renderer.clearTarget(this._thresholdTarget, true, true, false);

    // Draw scene
    renderer.render(this.scene, this.camera, this._thresholdTarget, false);

    // 3. Now blur the threshold target
    this.postScene.overrideMaterial = this.postShader;

    this.postShader.uniforms.resolution.value.set(this._thresholdTarget.width, this._thresholdTarget.height);
    this.postShader.uniforms.tDiffuse.value = this._thresholdTarget;
    renderer.render(this.postScene, this.postCamera, this._blurTarget, true);

    // Now we render back to original scene, with additive blending!
    this.postScene.overrideMaterial = this.combineShader;
    this.combineShader.uniforms.tDiffuse.value = readBuffer;
    this.combineShader.uniforms.tBloomDiffuse.value = this._blurTarget;

    var dpr = renderer.getPixelRatio();
    this.combineShader.uniforms.resolution.value.set(
      finalBuffer ? finalBuffer.width : (window.innerWidth * dpr),
      finalBuffer ? finalBuffer.height : (window.innerHeight * dpr)
    );
    renderer.render(this.postScene, this.postCamera, finalBuffer, true);

    renderer.setClearColor(this.oldColor, this.oldAlpha);
    renderer.autoClear = oldAutoClear;
  },

};
