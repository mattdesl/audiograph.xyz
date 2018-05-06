const createLoop = require('raf-loop');
const createApp = require('./lib/app');
const newArray = require('new-array');
const geoScene = require('./lib/geoScene');
const getPalette = require('./lib/palette');
const rightNow = require('right-now');
const randomFloat = require('random-float');
const setupInteractions = require('./lib/setupInteractions');
const log = require('./lib/log');

const isMobile = require('./lib/isMobile');
const showIntro = require('./lib/intro');
const EffectComposer = require('./lib/EffectComposer');
const BloomPass = require('./lib/BloomPass');
const SSAOShader = require('./lib/shader/SSAOShader');
const createAudio = require('./lib/audio');

const white = new THREE.Color('white');
const opt = { antialias: false, alpha: false, stencil: false };
const { updateProjectionMatrix, camera, scene, renderer, controls, canvas } = createApp(opt);

let supportsDepth = true;
if (!renderer.extensions.get('WEBGL_depth_texture')) {
  if (window.ga) window.ga('send', 'event', 'error', 'WEBGL_depth_texture', 0)
  console.warn('Requires WEBGL_depth_texture for certain post-processing effects.');
  supportsDepth = false;
}

var floatDepth = false;
renderer.gammaInput = true;
renderer.gammaOutput = true;
renderer.gammaFactor = 2.2;

const rt1 = createRenderTarget();
const rt2 = createRenderTarget();
const rtDepth = floatDepth ? rt1.clone() : null;
const rtInitial = createRenderTarget();
const composer = new EffectComposer(renderer, rt1, rt2, rtInitial);
const targets = [ rt1, rt2, rtInitial, rtDepth ].filter(Boolean);

if (floatDepth) {
  composer.depthTexture = rtDepth;  
  rtDepth.texture.type = THREE.FloatType;
} else if (supportsDepth) {
  rtInitial.depthTexture = new THREE.DepthTexture();
}

const depthTarget = floatDepth ? rtDepth : rtInitial.depthTexture;

const depthMaterial = new THREE.MeshDepthMaterial();
depthMaterial.depthPacking = THREE.BasicDepthPacking;
depthMaterial.blending = THREE.NoBlending;

let time = 0;
let mesh = null;

const loop = createLoop(render).start();
resize();
window.addEventListener('resize', resize);
window.addEventListener('touchstart', ev => ev.preventDefault());
helloWorld();

// ensure we are at top on iPhone in landscape
const isIOS = /(iPhone|iPad)/i.test(navigator.userAgent);
if (isIOS) {
  const fixScroll = () => {
    setTimeout(() => {
      window.scrollTo(0, 1);
    }, 500);
  };

  fixScroll();
  window.addEventListener('orientationchange', () => {
    fixScroll();
  }, false);
}

window.onkeydown = function (e) { 
  if (e.keyCode === 32) return false;
};
setupPost();

const supportsMedia = !isIOS;
setupScene({ palettes: getPalette(), supportsMedia });

function setupPost () {
  composer.addPass(new EffectComposer.RenderPass(scene, camera));

  if (supportsDepth) {
    var pass = new EffectComposer.ShaderPass(SSAOShader);
    pass.material.precision = 'highp'
    composer.addPass(pass);
    pass.uniforms.tDepth.value = depthTarget;
    pass.uniforms.cameraNear.value = camera.near;
    pass.uniforms.cameraFar.value = camera.far;
  }

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
  document.querySelector('#canvas').style.display = 'block';

  // console.log('Total palettes', palettes.length);
  const geo = geoScene({ palettes, scene, envMap, loop, camera, renderer });

  const initialPalette = [ '#fff', '#e2e2e2' ];
  geo.setPalette(initialPalette);
  document.body.style.background = '#F9F9F9';

  const audio = createAudio();
  let started = false;
  let time = 0;
  let switchPalettes = false;
  let readyForGeometry = newArray(audio.binCount, true);
  let readyForPaletteChange = false;
  let paletteInterval;

  const whitePalette = [ '#fff', '#d3d3d3', '#a5a5a5' ];
  const interactions = setupInteractions({ whitePalette, scene, controls, audio, camera, geo });

  let hasNextGeometry = false;
  let hasNextPalette = false;
  let ignorePaletteSwap = false;
  const introAutoGeo = setInterval(() => {
    hasNextGeometry = true;
    geo.nextGeometry();
  }, 400);

  // if (isMobile) {
    audio.skip();
  // } else {
  //   audio.queue();
  //   audio.once('ready', () => {
  //     audio.playQueued();
  //   });
  // }

  const randomPaletteInterval = () => {
    hasNextPalette = false;
    setTimeout(() => {
      if (!hasNextPalette && !ignorePaletteSwap) {
        hasNextPalette = true;
        // fake data for iOS
        geo.nextPalette();
      }
      randomPaletteInterval();
    }, randomFloat(4000, 8000));
  };

  // handle slow internet on first track
  interactions.once('stop', (isLoaded) => {
    // every time we release spacebar, we reset the counter here
    interactions.on('stop', () => {
      ignorePaletteSwap = false;
      hasNextPalette = true;
      resetPaletteSwapping();
      readyForPaletteChange = false;
    });
    interactions.on('start', () => {
      ignorePaletteSwap = true;
    })

    let firstSwapTimeout = null;
    const onAudioPlaying = () => {
      const firstSwapDelay = 7721;
      firstSwapTimeout = setTimeout(() => {
        firstSwap();
        randomPaletteInterval();
      }, firstSwapDelay);
    };
    if (!isLoaded) audio.once('ready', onAudioPlaying);
    else onAudioPlaying();
    interactions.once('start', () => {
      if (firstSwapTimeout) clearTimeout(firstSwapTimeout);
    });
  });

  const randomGeoInterval = () => {
    hasNextGeometry = false;
    setTimeout(() => {
      if (!hasNextGeometry) {
        hasNextGeometry = true;
        // fake data for iOS
        geo.nextGeometry();
      }
      randomGeoInterval();
    }, randomFloat(500, 2000));
  };

  showIntro({ interactions }, () => {
    started = true;
    clearInterval(introAutoGeo);
    randomGeoInterval();
  });

  setInterval(() => {
    for (let i = 0; i < readyForGeometry.length; i++) {
      readyForGeometry[i] = true;
    }
  }, 100);

  loop.on('tick', dt => {
    time += dt;
    if (!started) return;

    audio.update(dt);

    for (let i = 0; i < audio.beats.length; i++) {
      if (readyForGeometry[i] && audio.beats[i]) {
        hasNextGeometry = true;
        geo.nextGeometry({ type: i });
        readyForGeometry[i] = false;
      }
    }
    if (!interactions.keyDown && readyForPaletteChange && audio.beats[1] && switchPalettes) {
      hasNextPalette = true;
      geo.nextPalette();
      readyForPaletteChange = false;
    }
  });

  function firstSwap () {
    switchPalettes = true;
    geo.nextPalette();
    resetPaletteSwapping();
  }
  
  function resetPaletteSwapping () {
    readyForPaletteChange = false;
    if (paletteInterval) clearInterval(paletteInterval);
    paletteInterval = setInterval(() => {
      readyForPaletteChange = true;
    }, 2000);
  }
}

function helloWorld () {
  log.intro();
}