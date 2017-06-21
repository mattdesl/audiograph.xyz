// Our WebGL renderer with alpha and device-scaled
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#canvas'),
  alpha: false,
  stencil: false,
  depth: true,
  preserveDrawingBuffer: false,
  antialias: false
});

module.exports = {
  renderer
};
