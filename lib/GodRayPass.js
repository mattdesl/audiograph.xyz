const glslify = require('glslify');
const clamp = require('clamp');
const CopyShader = require('three-copyshader');
const injectDefines = require('glsl-inject-defines');
const downsample = 4;
const maxSize = 1024;

// Samples taken by filter
const TAPS_PER_PASS = '5.0';

module.exports = GodRayPass;
function GodRayPass (scene, camera, opt = {}) {
  this.scene = scene;
  this.camera = camera;

  this.grainFrame = 0;
  this.grainTime = 0;

  this.debugCopyShader = new THREE.ShaderMaterial(CopyShader);

  this.occluderMaterial = new THREE.RawShaderMaterial({
    side: THREE.DoubleSide,
    lights: false,
    fog: false,
    uniforms: {
      color: { type: 'c', value: new THREE.Color('#000') }
    },
    vertexShader: glslify(__dirname + '/shader/pass-no-uv.vert'),
    fragmentShader: glslify(__dirname + '/shader/color.frag')
  });
  this.occluderMaterial.name = 'godray-occluder-material';

  this._lastWidth = null;
  this._lastHeight = null;
  this._blurTarget1 = null; // lazily created
  this._blurTarget2 = null; // lazily created
  this._occluderTarget = null;

  this.enabled = true;
  this.needsSwap = true;
  this.oldColor = new THREE.Color();
  this.oldAlpha = 1;
  this.clearColor = new THREE.Color('#fff');
  this.clearAlpha = 1;

  this.postShader = new THREE.RawShaderMaterial({
    vertexShader: glslify(__dirname + '/shader/pass.vert'),
    fragmentShader: injectDefines(glslify(__dirname + '/shader/godrays-sep-blur.frag'), {
      TAPS_PER_PASS
    }),
    uniforms: {
      lightScreenPosition: { type: 'v2', value: new THREE.Vector2() },
      tDiffuse: { type: 't', value: null },
      fStepSize: { type: 'f', value: 1 },
      resolution: { type: 'v2', value: new THREE.Vector2(1, 1) }
    }
  });
  this.postShader.name = 'godray-blur-material';

  this.combineShader = new THREE.RawShaderMaterial({
    vertexShader: glslify(__dirname + '/shader/pass.vert'),
    fragmentShader: glslify(__dirname + '/shader/godrays-combine.frag'),
    uniforms: {
      time: { type: 'f', value: 0 },
      grainSize: { type: 'f', value: 2.1 },
      grainOpacity: { type: 'f', value: 0.39 },
      grainLumLow: { type: 'f', value: 0.0 },
      grainLumHigh: { type: 'f', value: 0.35 },
      resolution: { type: 'v2', value: new THREE.Vector2() },
      tDiffuse: { type: 't', value: null },
      tLightDiffuse: { type: 't', value: null },
      color: { type: 'v3', value: new THREE.Vector3(1, 1, 1) }
    }
  });
  this.combineShader.name = 'godray-combine-material';

  this.grColor = [255, 255, 255];

  this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  this.postScene = new THREE.Scene();

  this.postQuad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2));
  this.postQuad.name = 'godray-post-quad';
  this.postScene.add(this.postQuad);

  this.sunScene = new THREE.Scene();
  this.sunMaterial = this.occluderMaterial.clone();
  this.sunMaterial.uniforms.color.value.setStyle('#fff');

  this.debugSun = false;
  this.useSunSprite = false;
  if (this.useSunSprite) {
    this.sunMesh = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(500, 500, 500),
      new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('assets/images/sun.png'),
        transparent: true
      })
    );
  } else {
    this.sunMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.25, 3),
      this.sunMaterial
    );
  }
  this.sunMesh.name = 'godray-sun';
  this.sunScene.add(this.sunMesh);

  this.sunPosition = opt.sunPosition || new THREE.Vector3();
  this.screenSpacePosition = new THREE.Vector3();
  this.renderToScreen = false;
  this._getOverrideMaterial = this._getOverrideMaterial.bind(this);
}

GodRayPass.prototype = {

  _getOverrideMaterial: function (mesh, geometry, material) {
    if (mesh.occluderMaterial) {
      return mesh.occluderMaterial;
    }
    return this.occluderMaterial;
  },

  _updateTargets: function (renderTarget) {
    var width = renderTarget.width;
    var height = renderTarget.height;
    var downWidth = clamp(Math.floor(width / downsample), 2, maxSize);
    var downHeight = clamp(Math.floor(height / downsample), 2, maxSize);
    if (!this._occluderTarget || !this._blurTarget1 || !this._blurTarget2) {      
      this._blurTarget1 = new THREE.WebGLRenderTarget(downWidth, downHeight);
      this._blurTarget1.texture.minFilter = THREE.LinearFilter;
      this._blurTarget1.texture.magFilter = THREE.LinearFilter;
      this._blurTarget1.texture.generateMipmaps = false;
      this._blurTarget1.depthBuffer = true;
      this._blurTarget1.stencilBuffer = false;

      this._blurTarget2 = this._blurTarget1.clone();
      this._occluderTarget = this._blurTarget1.clone();
    } else if (this._occluderTarget.width !== width || this._occluderTarget.height !== height) {
      this._occluderTarget.setSize(downWidth, downHeight);
      this._blurTarget1.setSize(downWidth, downHeight);
      this._blurTarget2.setSize(downWidth, downHeight);
    }
  },

  render: function (renderer, writeBuffer, readBuffer, delta) {
    this._updateTargets(readBuffer);
    var finalBuffer = this.renderToScreen ? undefined : writeBuffer;

    var oldOverride = this.scene.overrideMaterial;

    // 1. First, render black occluders into a downsampled FBO
    this.oldColor.copy(renderer.getClearColor());
    this.oldAlpha = renderer.getClearAlpha();
    var oldAutoClear = renderer.autoClear;

    // Clear target
    renderer.setClearColor(this.clearColor, this.clearAlpha);
    renderer.autoClear = false;
    renderer.clearTarget(this._occluderTarget, true, true, false);

    // Draw sprite sun into occluder target
    this.sunMesh.position.copy(this.sunPosition);
    this.sunMesh.lookAt(this.camera.position);
    renderer.render(this.sunScene, this.camera, this._occluderTarget, true);

    // this.postScene.overrideMaterial = this.debugCopyShader;
    // this.debugCopyShader.uniforms.tDiffuse.value = this._occluderTarget;
    // renderer.render(this.postScene, this.postCamera, finalBuffer, true);
    // return;

    // Draw occluders with black material
    this.scene.overrideMaterial = this.occluderMaterial;
    // this.scene.traverse(function (mesh) {
    //   if (mesh.ignoreGodRays) {
    //     mesh.wasVisible = mesh.visible;
    //     mesh.visible = false;
    //   }
    // });
    renderer.render(this.scene, this.camera, this._occluderTarget, false);
    this.scene.overrideMaterial = oldOverride;
    // this.scene.traverse(function (mesh) {
    //   if (mesh.ignoreGodRays) {
    //     mesh.visible = mesh.wasVisible;
    //   }
    // });

    // 2. Determine screen space position of light
    var lightPosition = this.postShader.uniforms.lightScreenPosition.value;
    var widthHalf = 1 * 0.5;
    var heightHalf = 1 * 0.5;

    this.screenSpacePosition.copy(this.sunPosition).project(this.camera);
    lightPosition.x = (this.screenSpacePosition.x * widthHalf) + widthHalf;
    lightPosition.y = (this.screenSpacePosition.y * heightHalf) + heightHalf;

    // 3. Now blur the sun light image in 3 taps
    var stepLen;
    this.postScene.overrideMaterial = this.postShader;

    // Maximum length of god-rays (in texture space [0,1]X[0,1])
    var filterLen = 1.0;

    // pass 1 - render occluders with first tap
    this.postShader.uniforms.fStepSize.value = filterLen * Math.pow(TAPS_PER_PASS, -1);
    this.postShader.uniforms.tDiffuse.value = this._occluderTarget;
    renderer.render(this.postScene, this.postCamera, this._blurTarget1, true);

    // pass 2 - render into second ping-pong target
    this.postShader.uniforms.fStepSize.value = filterLen * Math.pow(TAPS_PER_PASS, -2);
    this.postShader.uniforms.tDiffuse.value = this._blurTarget1;
    renderer.render(this.postScene, this.postCamera, this._blurTarget2, true);

    // pass 3 - render back into first ping-pong target
    this.postShader.uniforms.fStepSize.value = filterLen * Math.pow(TAPS_PER_PASS, -3);
    this.postShader.uniforms.tDiffuse.value = this._blurTarget2;
    renderer.render(this.postScene, this.postCamera, this._blurTarget1, true);

    // Now we render back to original scene, with additive blending!
    this.postScene.overrideMaterial = this.combineShader;
    this.combineShader.uniforms.tDiffuse.value = readBuffer;
    var dpr = renderer.getPixelRatio();

    this.combineShader.uniforms.resolution.value.set(
      finalBuffer ? finalBuffer.width : (window.innerWidth * dpr),
      finalBuffer ? finalBuffer.height : (window.innerHeight * dpr)
    );

    this.combineShader.uniforms.tLightDiffuse.value = this._blurTarget1;
    renderer.render(this.postScene, this.postCamera, finalBuffer, true);

    if (this.debugSun) {
      renderer.render(this.sunScene, this.camera, finalBuffer, true);
    }

    renderer.setClearColor(this.oldColor, this.oldAlpha);
    renderer.autoClear = oldAutoClear;
  },

};
