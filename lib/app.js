
/*
  This is a generic "ThreeJS Application"
  helper which sets up a renderer and camera
  controls.
 */

const createControls = require('orbit-controls');
const assign = require('object-assign');

module.exports = createApp;
function createApp (opt = {}) {
  // Scale for retina
  const dpr = 1//window.devicePixelRatio;

  // Our WebGL renderer with alpha and device-scaled
  const renderer = new THREE.WebGLRenderer(assign({
    antialias: true // default enabled
  }, opt));
  renderer.setPixelRatio(dpr);

  // Show the <canvas> on screen
  const canvas = renderer.domElement;
  document.body.appendChild(canvas);

  // 3D camera looking
  const camera = new THREE.PerspectiveCamera(75, 1, 1, 100);
  const target = new THREE.Vector3();

  // 3D scene
  const scene = new THREE.Scene();

  // 3D orbit controller with damping
  const controls = createControls(assign({
    canvas,
    theta: 40 * Math.PI / 180,
    phi: -70 * Math.PI / 180,
    distance: 12,
    distanceBounds: [ 2, 100 ]
  }, opt));

  // Update frame size
  window.addEventListener('resize', resize);

  // Setup initial size
  resize();

  return {
    updateProjectionMatrix,
    camera,
    scene,
    renderer,
    controls,
    canvas
  };

  function updateProjectionMatrix () {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    // update camera controls
    controls.update();
    camera.position.fromArray(controls.position);
    camera.up.fromArray(controls.up);
    camera.lookAt(target.fromArray(controls.direction));

    // Update camera matrices
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  function resize () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateProjectionMatrix();
  }
}
