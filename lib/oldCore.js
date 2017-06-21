require('seed-random')('1', {
  global: true
});

const createLoop = require('raf-loop');
const createApp = require('./app');
const createApp2 = require('./createApp');
const newArray = require('new-array');
const geoScene = require('./geoScene');
const getPalette = require('./palette');
const rightNow = require('right-now');
const randomFloat = require('random-float');
const setupInteractions = require('./setupInteractions');
const log = require('./log');

const isMobile = require('./isMobile');
const createIntro = require('./intro');
const EffectComposer = require('./EffectComposer');
const BloomPass = require('./BloomPass');
const SSAOShader = require('./shader/SSAOShader');
const createAudio = require('./audio');

const white = new THREE.Color('white');
const opt = { antialias: false, alpha: false, stencil: false };
const app = createApp(opt);

let supportsDepth = true;
if (!app.renderer.extensions.get('WEBGL_depth_texture')) {
  if (window.ga) window.ga('send', 'event', 'error', 'WEBGL_depth_texture', 0)
  console.warn('Requires WEBGL_depth_texture for certain post-processing effects.');
  supportsDepth = false;
}

var floatDepth = false;
app.renderer.gammaInput = true;
app.renderer.gammaOutput = true;
app.renderer.gammaFactor = 2.2;

const rt1 = createRenderTarget();
const rt2 = createRenderTarget();
const rtDepth = floatDepth ? rt1.clone() : null;
const rtInitial = createRenderTarget();
const composer = new EffectComposer(app.renderer, rt1, rt2, rtInitial);
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

window.onkeydown = function (e) { 
  if (e.keyCode === 32) return false;
};

setupPost();
setupScene({ palettes: getPalette() });

function setupPost () {
  composer.addPass(new EffectComposer.RenderPass(app.scene, app.camera));

  if (supportsDepth) {
    var pass = new EffectComposer.ShaderPass(SSAOShader);
    pass.material.precision = 'highp'
    composer.addPass(pass);
    pass.uniforms.tDepth.value = depthTarget;
    pass.uniforms.cameraNear.value = app.camera.near;
    pass.uniforms.cameraFar.value = app.camera.far;
  }

  composer.addPass(new BloomPass(app.scene, app.camera));
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
  const dpr = app.renderer.getPixelRatio();
  const size = app.renderer.getSize();
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

  app.tick(dt);

  const oldClear = app.renderer.getClearColor();
  if (floatDepth) {
    app.scene.overrideMaterial = depthMaterial;
    app.renderer.setRenderTarget(rtDepth);
    app.renderer.setClearColor(white, 1);
    app.renderer.clear(true, true, true);
    app.renderer.render(app.scene, app.camera, rtDepth);
  }

  composer.passes.forEach(pass => {
    if (pass.uniforms && pass.uniforms.resolution) {
      pass.uniforms.resolution.value.set(rtInitial.width, rtInitial.height);
    }
  });

  app.renderer.setRenderTarget(null);
  app.renderer.setClearColor(oldClear, 1);
  app.scene.overrideMaterial = null;
  if (composer.passes.length > 1) composer.render();
  else app.renderer.render(app.scene, app.camera);
}

function setupScene ({ palettes }) {
  document.querySelector('#canvas').style.display = 'block';

  // console.log('Total palettes', palettes.length);
  const geo = geoScene({ palettes, scene: app.scene, loop, camera: app.camera, renderer: app.renderer });

  const initialPalette = [ '#fff', '#e2e2e2' ];
  geo.setPalette(initialPalette);
  document.body.style.background = '#F9F9F9';

  const audio = createAudio();

  const whitePalette = [ '#fff', '#d3d3d3', '#a5a5a5' ];
  const interactions = setupInteractions({ whitePalette, scene: app.scene, controls: app.controls, audio, camera: app.camera, geo });

  audio.queue();
  audio.once('ready', () => {
    audio.playQueued();
  });

  const timeline = createAudioTimeline();

  const intro = createIntro();
  intro.animateIn();
  interactions.enable();

  // First interaction
  interactions.once('start', () => {
    intro.animateOut();
    geo.nextGeometry();
    interactions.once('stop', () => {
      geo.clearGeometry();
      for (let i = 0; i < 10; i++) geo.nextGeometry();
      interactions.disable();
    });
  });

  // Repeated interaction
  interactions.on('start', () => {
  });
  interactions.on('stop', () => {
  });

  let prevTime = rightNow();

  // setInterval(() => {
  //   geo.nextGeometry();
  // }, 1000);

  loop.on('tick', () => {
    const now = rightNow();
    const dt = now - prevTime;
    prevTime = now;
    audio.update(dt);

    const currentTrack = audio.getCurrentTrackIndex();
    const currentTime = audio.getCurrentTime();
    const audioTimeline = timeline[currentTrack];
    syncToTimeline(currentTime, audioTimeline);
  });

  function syncToTimeline (currentTime, audioTimeline) {
    if (!audioTimeline) return;
    const list = audioTimeline.events;
    if (list) {
      for (let i = 0; i < list.length; i++) {
        const ev = list[i];
        if (ev.hit) continue;
        if (currentTime >= ev.time) {
          ev.hit = true;
          ev.trigger();
        }
      }
    }

    if (audioTimeline.beats) {
      if (typeof audioTimeline._beatCount !== 'number') {
        audioTimeline._beatCount = 0;
      }
      if (audioTimeline._beatCount === 0 && currentTime >= audioTimeline.beatStart) {
        audioTimeline._beatCount++;
      }

      const beatTime = audioTimeline._beatCount * audioTimeline.beatInterval;
      
      if (currentTime >= beatTime && audioTimeline._beatCount > 0) {
        audioTimeline._beatCount++;
        audioTimeline.beatTrigger();
      }
    }
  }

  function createAudioTimeline () {
    const nextPalette = () => geo.nextPalette();
    const nextGeometry = () => geo.nextGeometry();
    const nextBoth = () => {
      nextPalette();
      nextGeometry();
    };

    const beTheLight = [
      // main swaps
      { time: 7.74, trigger: nextBoth },
      { time: 30.32, trigger: nextBoth },
      { time: 52.917, trigger: nextBoth },
    ];
    return [
      { // intro track
      },
      { // now be the light
        events: beTheLight,
        beats: true,
        beatInterval: 1.427,
        beatStart: 1.427,
        beatTrigger: nextGeometry
      }
    ];
  }
}
