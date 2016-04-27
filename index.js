const createLoop = require('raf-loop');
const createApp = require('./lib/app');
const newArray = require('new-array');
const createGeometry = require('./lib/geometry');
const createLine3D = require('./lib/createLine3D');
const glslify = require('glslify');
const fs = require('fs');
const geoScene = require('./lib/geoScene');
const getPalette = require('./lib/palette');
const setupInteractions = require('./lib/setupInteractions');

const EffectComposer = require('./lib/EffectComposer');
const CopyShader = require('three-copyshader');
const FogPass = require('./lib/FogPass');
const GodRayPass = require('./lib/GodRayPass');
const BloomPass = require('./lib/BloomPass');
const SSAOShader = require('./lib/shader/SSAOShader');
const createAudio = require('./lib/audio');

const white = new THREE.Color('white');
const opt = { antialias: true };
const {updateProjectionMatrix, camera, scene, renderer, controls, canvas} = createApp(opt);

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

  // const envMap = pmremGenerator.cubeLods[3];
  const envMap = pmremGenerator.cubeLods[ pmremGenerator.cubeLods.length - 4 ];
  
  getPalette(palettes => {
    setupScene({ palettes, envMap });
  });
});

scene.add(new THREE.AmbientLight('#020102'));
// const dir = new THREE.DirectionalLight('#fff', 1);
// dir.position.set(0, 0, 0);
// scene.add(dir);

var hemi = new THREE.HemisphereLight('#fff', '#adadad', 1);
scene.add(hemi);

var floatDepth = false;
renderer.gammaInput = true;
renderer.gammaOutput = true;
renderer.gammaFactor = 2.2;

// renderer.shadowMap.enabled = true;
// renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const rt1 = createRenderTarget();
const rt2 = createRenderTarget();
const rtDepth = floatDepth ? rt1.clone() : null;
const rtInitial = createRenderTarget();
const composer = new EffectComposer(renderer, rt1, rt2, rtInitial);
const targets = [ rt1, rt2, rtInitial, rtDepth ].filter(Boolean);

if (floatDepth) {
  composer.depthTexture = rtDepth;  
  rtDepth.texture.type = THREE.FloatType;
} else {
  rtInitial.depthTexture = new THREE.DepthTexture();
}

const depthTarget = floatDepth ? rtDepth : rtInitial.depthTexture;

const depthMaterial = new THREE.MeshDepthMaterial();
depthMaterial.depthPacking = THREE.BasicDepthPacking;
depthMaterial.blending = THREE.NoBlending;

function setupPost () {
  composer.addPass(new EffectComposer.RenderPass(scene, camera));
  
  var pass = new EffectComposer.ShaderPass(SSAOShader);
  composer.addPass(pass);
  pass.uniforms.tDepth.value = depthTarget;
  pass.uniforms.cameraNear.value = camera.near;
  pass.uniforms.cameraFar.value = camera.far;

  composer.addPass(new BloomPass(scene, camera));
  composer.passes[composer.passes.length - 1].renderToScreen = true;
}

function createRenderTarget (numAttachments) {
  numAttachments = numAttachments || 0;
  const target = numAttachments > 1 
    ? new THREE.WebGLMultiRenderTarget(window.innerWidth, window.innerHeight)
    : new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
  target.texture.format = THREE.RGBFormat;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  target.stencilBuffer = false;
  target.depthBuffer = true;
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

const loop = createLoop(render).start();
resize();
window.addEventListener('resize', resize);
setupPost();

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

  const oldClear = renderer.getClearColor();
  
  if (floatDepth) {
    scene.overrideMaterial = depthMaterial;
    renderer.setRenderTarget(rtDepth);
    renderer.setClearColor(white, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, camera, rtDepth);
  }
  
  composer.passes.forEach(pass => {
    if (pass.uniforms && pass.uniforms.resolution) {
      pass.uniforms.resolution.value.set(rtInitial.width, rtInitial.height);
    }
  });
  
  renderer.setRenderTarget(null);
  renderer.setClearColor(oldClear, 1);
  scene.overrideMaterial = null;
  if (composer.passes.length > 1) composer.render();
  else renderer.render(scene, camera);
}

function setupScene ({ palettes, envMap }) {
  console.log('Total palettes', palettes.length);
  const geo = geoScene({ palettes, scene, envMap, loop, camera, renderer });
  geo.setPalette([ '#fff', '#c1c1c1', '#606060', '#353535' ]);

  const audio = createAudio();
  
  let started = false;
  let time = 0;
  let switchPalettes = false;
  let readyForGeometry = newArray(audio.binCount, true);
  let readyForPaletteChange = false;

  const interactions = setupInteractions({ scene, controls, audio, camera, geo });

  audio.once('ready', () => {
    started = true;
    switchPalettes = true;
    audio.play();
    geo.nextPalette();
  });

  setInterval(() => {
    for (let i = 0; i < readyForGeometry.length; i++) {
      readyForGeometry[i] = true;
    }
  }, 100);

  setInterval(() => {
    readyForPaletteChange = true;
  }, 500);

  // setInterval(() => {
  //   geo.nextColor();
  // }, 2000);

  loop.on('tick', dt => {
    time += dt;
    if (!started) return;

    audio.update(dt);

    for (let i = 0; i < audio.detection.length; i++) {
      if (readyForGeometry[i] && audio.detection[i]) {
        geo.nextGeometry({ type: i });
        readyForGeometry[i] = false;
      }
    }
    if (!interactions.keyDown && readyForPaletteChange && audio.detection[1] && switchPalettes) {
      geo.nextPalette();
      readyForPaletteChange = false;
    }
  });
}
