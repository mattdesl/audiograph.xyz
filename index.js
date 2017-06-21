// require('./lib/oldCore')
require('seed-random')('12', {
  global: true
});

const { audio, renderer } = require('./lib/context');
const createLoop = require('raf-loop');
const query = require('./lib/query')();
const defined = require('defined');
const Audiograph = require('./lib/scene/Audiograph');

const defaultDPR = 1.5;
start();

function start () {
  setupRenderer();

  const renderTargets = [];
  const app = {
    width: window.innerWidth,
    height: window.innerHeight
  };

  const audiograph = new Audiograph(app);
  window.addEventListener('resize', resize);

  resize();
  createLoop(render).start();

  function resize () {
    let width = defined(query.width, window.innerWidth);
    let height = defined(query.height, window.innerHeight);

    app.width = width;
    app.height = height;
    renderer.setSize(width, height);

    const dpr = renderer.getPixelRatio();
    const rtWidth = Math.floor(width * dpr);
    const rtHeight = Math.floor(height * dpr);
    renderTargets.forEach(t => {
      t.setSize(rtWidth, rtHeight);
    });

    audiograph.resize(app.width, app.height);
    render(0);
  }

  function setupRenderer () {
    const dpr = defined(query.dpr, Math.min(defaultDPR, window.devicePixelRatio));
    renderer.setPixelRatio(dpr);
    renderer.gammaFactor = 2.2;
    renderer.gammaOutput = false;
    renderer.gammaInput = false;
    renderer.sortObjects = false;
    renderer.setClearColor('black', 1);
  }

  function render (dt = 0) {
    audio.update(dt);
    audiograph.render(dt);
  }
}
