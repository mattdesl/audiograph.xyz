const createLoop = require('raf-loop');
const createApp = require('./lib/app');
const newArray = require('new-array');
const createGeometry = require('./lib/geometry');
const createLine3D = require('./lib/createLine3D');
const glslify = require('glslify');
const fs = require('fs');
const geoScene = require('./lib/geoScene');
const testScene = require('./lib/testScene');

const EffectComposer = require('./lib/EffectComposer');
const CopyShader = require('three-copyshader');
const FogPass = require('./lib/FogPass');
const GodRayPass = require('./lib/GodRayPass');
const SSAOShader = require('./lib/shader/SSAOShader');

const opt = { antialias: true };
const {updateProjectionMatrix, camera, scene, renderer, controls, canvas} = createApp(opt);
// renderer.setClearColor('#0d000e', 1);

var genCubeUrls = function (prefix, postfix) {
  return [
    prefix + 'px' + postfix, prefix + 'nx' + postfix,
    prefix + 'py' + postfix, prefix + 'ny' + postfix,
    prefix + 'pz' + postfix, prefix + 'nz' + postfix
  ];
};

let hdrUrls = genCubeUrls('assets/pisaHDR/', '.hdr');
let cubeLoader = new THREE.HDRCubeTextureLoader();
cubeLoader.load(THREE.UnsignedByteType, hdrUrls, function (hdrCubeMap) {
  const pmremGenerator = new THREE.PMREMGenerator(hdrCubeMap);
  pmremGenerator.update(renderer);

  const pmremCubeUVPacker = new THREE.PMREMCubeUVPacker(pmremGenerator.cubeLods);
  pmremCubeUVPacker.update(renderer);

  // const envMap = pmremCubeUVPacker.CubeUVRenderTarget;
  const envMap = pmremGenerator.cubeLods[ pmremGenerator.cubeLods.length - 4 ];

  setupScene(envMap);
});

scene.add(new THREE.AmbientLight('#020102'));
const dir = new THREE.DirectionalLight('#f0dfaa', 1);
dir.position.set(-40, 60, 50);
dir.castShadow = true;
scene.add(dir);

renderer.gammaInput = true;
renderer.gammaOutput = true;
renderer.gammaFactor = 2.2;

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const rt1 = createRenderTarget();
const rt2 = createRenderTarget();
const rtDepth = rt1.clone();
const rtInitial = createRenderTarget(false, 0);
const composer = new EffectComposer(renderer, rt1, rt2, rtInitial);
composer.depthTexture = rtDepth;
rtDepth.texture.type = THREE.FloatType;

const depthMaterial = new THREE.MeshDepthMaterial();
depthMaterial.depthPacking = THREE.BasicDepthPacking;
depthMaterial.blending = THREE.NoBlending;

function setupPost () {
  composer.addPass(new EffectComposer.RenderPass(scene, camera));
  // composer.addPass(new GodRayPass(scene, camera, {
  //   sunPosition: new THREE.Vector3(0, 0, 0),
  // }));

  // var pass = new EffectComposer.ShaderPass(SSAOShader);
  // composer.addPass(pass);
  // pass.uniforms.tDepth.value = rtDepth;
  // pass.uniforms.cameraNear.value = camera.near;
  // pass.uniforms.cameraFar.value = camera.far;

  composer.passes[composer.passes.length - 1].renderToScreen = true;
}

function createRenderTarget (depthTexture, numAttachments) {
  const target = numAttachments > 1 
    ? new THREE.WebGLMultiRenderTarget(window.innerWidth, window.innerHeight)
    : new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
  target.texture.format = THREE.RGBFormat;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  target.stencilBuffer = false;
  target.depthBuffer = true;
  if (depthTexture) target.depthTexture = new THREE.DepthTexture();
  if (numAttachments > 1) {
    var gBufferNormalRoughness = target.texture.clone();
    gBufferNormalRoughness.format = THREE.RGBAFormat;
    gBufferNormalRoughness.type = THREE.FloatType;
    target.attachments.push(gBufferNormalRoughness);
  }
  return target;
}

let time = 0;
let mesh = null;
const targets = [ rt1, rt2, rtInitial, rtDepth ];

const loop = createLoop(render).start();
let clearColor = renderer.getClearColor().clone();
resize();
window.addEventListener('resize', resize);


function resize () {
  const dpr = renderer.getPixelRatio();
  const size = renderer.getSize();
  const width = size.width * dpr;
  const height = size.height * dpr;
  targets.forEach(t => {
    t.setSize(width, height);
  });
}

function render (dt) {
  time += Math.min(30, dt) / 1000;
  if (mesh) {
    mesh.position.y = Math.sin(time) * 0.25 + 1;
    mesh.rotation.y += dt * 0.00005;
  }

  updateProjectionMatrix();
  scene.overrideMaterial = depthMaterial;
  renderer.setRenderTarget(rtDepth);
  renderer.setClearColor('#fff', 1);
  renderer.clear(true, true, true);
  renderer.render(scene, camera, rtDepth);
  
  composer.passes.forEach(pass => {
    if (pass.uniforms && pass.uniforms.resolution) {
      pass.uniforms.resolution.value.set(rtInitial.width, rtInitial.height);
    }
  });
  
  renderer.setRenderTarget(null);
  renderer.setClearColor(clearColor, 1);
  scene.overrideMaterial = null;
  if (composer.passes.length > 1) composer.render();
  else renderer.render(scene, camera);
}


function setupScene (envMap) {
  const repeats = 20;
  const demo = geoScene;
  // const demo = testScene;
  demo({ scene, envMap, loop, camera, renderer });
  clearColor = renderer.getClearColor().clone();
}
