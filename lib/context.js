// Our WebGL renderer with alpha and device-scaled
const createAudio = require('./audio');

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#canvas'),
  alpha: false,
  stencil: false,
  depth: true,
  preserveDrawingBuffer: false,
  antialias: false
});

const audio = createAudio();
audio.queue();
audio.once('ready', () => {
  audio.playQueued();
});

module.exports = {
  renderer,
  audio
};
