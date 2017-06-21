const getPalette = require('../palette');
const geoScene = require('../geoScene');
const { renderer, audio } = require('../context');
const setupInteractions = require('../setupInteractions');
const rightNow = require('right-now');
const allPalettes = require('nice-color-palettes/500');
const shuffle = require('array-shuffle');
const randomFloat = require('random-float');
const clipboard = require('clipboard-copy');

const EffectComposer = require('../EffectComposer');
const BloomPass = require('../BloomPass');
const SSAOShader = require('../shader/SSAOShader');

module.exports = class Audiograph extends THREE.Scene {

  constructor (app) {
    super();

    this.app = app;

    // perspective camera
    const near = 0.01;
    const far = 100;
    const fieldOfView = 75;
    this.camera = new THREE.PerspectiveCamera(fieldOfView, 1, near, far);
    this.camera.position.set(0, 1, 0);
    this.camera.lookAt(new THREE.Vector3());

    const palettes = getPalette();
    this.geo = geoScene({
      palettes,
      scene: this,
      camera: this.camera,
      renderer: renderer
    });

    const introPalette = [ '#fff', '#e2e2e2' ];
    this.geo.setPalette(introPalette);
    document.body.style.background = '#F9F9F9';

    const spaceBarPalette = [ '#fff', '#d3d3d3', '#a5a5a5' ];
    const interactions = setupInteractions({
      whitePalette: spaceBarPalette,
      scene: this,
      audio,
      camera: this.camera,
      geo: this.geo
    });

    this.timeline = this.createAudioTimeline(this.geo);
    interactions.enable();

    // First interaction
    interactions.once('start', () => {
      // intro.animateOut();
      interactions.once('stop', () => {
        const track = audio.getCurrentTrackIndex();
        const data = this.timeline[track];
        if (data.initialPalette) this.geo.setPalette(data.initialPalette);
      });
    });

    // interactions.on('start', () => {
    //   this.geo.clearGeometry();
    // })
    // interactions.on('stop', () => {
    //   this.geo.clearGeometry();
    //   const count = Math.floor(randomFloat(2, 5))
    //   const palette = shuffle(allPalettes[Math.floor(Math.random() * allPalettes.length)]).slice(0, count);
    //   this.geo.setPalette(palette)
    //   for (let i = 0; i < 50; i++) this.geo.nextGeometry()
    //   clipboard(JSON.stringify(palette));
    // })

    this.prevTime = rightNow();

    const dpr = renderer.getPixelRatio();
    const rtWidth = Math.floor(this.app.width * dpr);
    const rtHeight = Math.floor(this.app.height * dpr);
    const rt1 = createRenderTarget(rtWidth, rtHeight);
    const rt2 = createRenderTarget(rtWidth, rtHeight);
    const rtInitial = createRenderTarget(rtWidth, rtHeight);
    rtInitial.depthTexture = new THREE.DepthTexture();
    this.depthTarget = rtInitial.depthTexture;

    this.composer = new EffectComposer(renderer, rt1, rt2, rtInitial);
    this.isPostProcess = true;
    this.targets = [ rt1, rt2, rtInitial ];
    this.setupPost();
    process.nextTick(() => this.preRender());
  }

  preRender () {
    const wasPost = this.isPostProcess;
    this.targets.forEach(t => renderer.setRenderTarget(t));
    renderer.setRenderTarget(null);
    this.isPostProcess = true;
    this.geo.nextGeometry();
    this.render();
    this.geo.clearGeometry();
    this.isPostProcess = wasPost;
  }

  setupPost () {
    this.composer.addPass(new EffectComposer.RenderPass(this, this.camera));

    var pass = new EffectComposer.ShaderPass(SSAOShader);
    pass.material.precision = 'highp'
    this.composer.addPass(pass);
    pass.uniforms.tDepth.value = this.depthTarget;
    pass.uniforms.cameraNear.value = this.camera.near;
    pass.uniforms.cameraFar.value = this.camera.far;

    this.composer.addPass(new BloomPass(this, this.camera));
    this.composer.passes[this.composer.passes.length - 1].renderToScreen = true;
  }

  resize (width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const dpr = renderer.getPixelRatio();
    const rtWidth = Math.floor(width * dpr);
    const rtHeight = Math.floor(height * dpr);
    this.targets.forEach(t => {
      t.setSize(rtWidth, rtHeight);
    });
  }

  render () {
    const now = rightNow();
    const dt = now - this.prevTime;
    this.prevTime = now;

    const currentTrack = audio.getCurrentTrackIndex();
    const currentTime = audio.getCurrentTime();
    const audioTimeline = this.timeline[currentTrack];
    this.syncToTimeline(currentTime, audioTimeline);

    this.geo.tick(dt);

    const dpr = renderer.getPixelRatio();
    const rtWidth = Math.floor(this.app.width * dpr);
    const rtHeight = Math.floor(this.app.height * dpr);
    this.composer.passes.forEach(pass => {
      if (pass.uniforms && pass.uniforms.resolution) {
        pass.uniforms.resolution.value.set(rtWidth, rtHeight);
      }
    });

    if (this.composer.passes.length > 1 && this.isPostProcess) {
      this.composer.render();
    } else {
      renderer.render(this, this.camera);
    }
  }

  syncToTimeline (currentTime, audioTimeline) {
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

  createAudioTimeline () {
    const geo = this.geo;
    const initialPalette = ['white', 'hsl(0, 0%, 70%)'];
    const geometryOpts = [
      { dance: false, type: 0, additional: 2 },
      { dance: false, type: 0, additional: 2, palette: ["#0e2430","#fc3a51"] },
      { dance: false, additional: 5, palette: ["#351330","#424254","#e8caa4","#64908a"] },
      { dance: true, additional: 4, palette: ["#230f2b","#ebebbc","#f21d41","#bce3c5"] },
      { dance: true, additional: 8, palette: ["#eff3cd","#605063","#b2d5ba","#61ada0"] },
      
      // { dance: true, additional: 20 },
      // { type: undefined, dance: true }
    ];

    let geometryIndex = 0;
    if (geometryOpts[geometryIndex].palette) {
      geo.setPalette(geometryOpts[geometryIndex].palette);
    }

    const nextPalette = () => geo.nextPalette();
    const nextGeometry = () => {
      geo.nextGeometry(geometryOpts[geometryIndex]);
    }
    const swap = () => {
      if (geometryIndex < geometryOpts.length - 1) geometryIndex++;

      const geomOpt = geometryOpts[geometryIndex];
      if (geomOpt.post && !this.isPostProcess) this.isPostProcess = geomOpt.post;
      if (geomOpt.palette) geo.setPalette(geomOpt.palette);
      nextGeometry();
    };

    const beTheLight = [
      // main swaps
      { time: 7.74, trigger: swap },
      { time: 30.32, trigger: swap },
      { time: 52.917, trigger: swap },
      { time: 75.514, trigger: swap },
      { time: 98.111, trigger: swap },
       // 22.597
    ];
    return [
      { // intro track
      },
      { // now be the light
        initialPalette: initialPalette,
        events: beTheLight,
        beats: true,
        beatInterval: 1.327,
        beatStart: 1.427,
        beatTrigger: nextGeometry
      }
    ];
  }
};


  

function createRenderTarget (width, height) {
  const target = new THREE.WebGLRenderTarget(width, height);
  target.texture.format = THREE.RGBFormat;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  target.stencilBuffer = false;
  target.depthBuffer = true;
  return target;
}
