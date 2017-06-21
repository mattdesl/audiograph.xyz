/*
  This is a generic "ThreeJS Application"
  helper which sets up a renderer and camera
  controls.
 */

const createControls = require('orbit-controls');
const assign = require('object-assign');
const lerp = require('lerp');
const defined = require('defined');
const mouseTimeline = require('tweenr')();
const angleOffsetTimeline = require('tweenr')();
const touches = require('touches');
// const createPostShader = require('./shaders/createPostShader');
const glslify = require('glslify');
const path = require('path');

// const EffectComposer = require('./post/EffectComposer');
// const BloomTexturePass = require('./post/BloomTexturePass');
// const RenderPass = require('./post/RenderPass');
// const SSAO = require('./shaders/SSAOShader');
// const FXAA = require('./shaders/fxaa');
const query = require('./query')();

const { renderer } = require('./context');

module.exports = createApp;
function createApp (opt = {}) {
  // Scale for retina
  const defaultDPR = 1.5;
  const dpr = defined(query.dpr, Math.min(defaultDPR, window.devicePixelRatio));

  const cameraDistance = 1;

  renderer.setPixelRatio(dpr);
  renderer.gammaFactor = 2.2;
  renderer.gammaOutput = false;
  renderer.gammaInput = false;
  renderer.sortObjects = false;

  // Add the <canvas> to DOM body
  const canvas = renderer.domElement;

  // perspective camera
  const near = 0.01;
  const far = 100;
  const fieldOfView = 75;
  const camera = new THREE.PerspectiveCamera(fieldOfView, 1, near, far);
  const target = new THREE.Vector3();

  // 3D scene
  const scene = new THREE.Scene();

  // post processing
  let bloom, fxaa;
  const postPasses = [];
  const hdrTarget = createTarget(true);
  const ldrTarget = createTarget(false);
  const renderTargets = [ hdrTarget, ldrTarget ];

  // Update renderer size
  window.addEventListener('resize', resize);

  const app = assign({}, {
    tick,
    camera,
    scene,
    renderer,
    canvas,
    render,
    getBloom: () => bloom
  });

  app.width = 0;
  app.height = 0;
  app.top = 0;
  app.left = 0;

  // Setup initial size & aspect ratio
  // setupPost();
  resize();
  tick();
  return app;

  function setupPost () {
    // bloom = new BloomTexturePass(scene, camera, {
    //   gammaOutput: renderer.gammaFactor
    // });
    // postPasses.push(bloom);

    // if (!isMobile && query.fxaa !== false) {
    //   fxaa = new EffectComposer.ShaderPass(FXAA());
    //   postPasses.push(fxaa);
    // }
  }

  function tick (dt = 0) {
    const aspect = app.width / app.height;

    camera.position.set(0, 1, 0);
    camera.lookAt(target);

    // Update camera matrices
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    postPasses.forEach(pass => {
      if (typeof pass.tick === 'function') pass.tick(dt);
    });
  }

  function render () {
    renderer.render(scene, camera);
  }

  function resize () {
    let width = defined(query.width, window.innerWidth);
    let height = defined(query.height, window.innerHeight);

    app.width = width;
    app.height = height;
    renderer.setSize(width, height);

    const rtWidth = Math.floor(width * dpr);
    const rtHeight = Math.floor(height * dpr);
    postPasses.forEach(pass => {
      if (pass.uniforms && pass.uniforms.resolution) {
        pass.uniforms.resolution.value.set(rtWidth, rtHeight);
      }
    });

    renderTargets.forEach(t => {
      t.setSize(rtWidth, rtHeight);
    });

    tick(0);
    render();
  }

  function createTarget (hdrType) {
    const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    rt.texture.minFilter = THREE.NearestFilter;
    rt.texture.magFilter = THREE.NearestFilter;
    rt.texture.generateMipmaps = false;
    rt.texture.format = hdrType ? THREE.RGBFormat : THREE.RGBAFormat;
    rt.texture.type = hdrType ? THREE.HalfFloatType : THREE.UnsignedByteType;
    return rt;
  }
}
