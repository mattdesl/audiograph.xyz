const createLoop = require('raf-loop');
const createApp = require('./lib/app');
const newArray = require('new-array');
const createGeometry = require('./lib/geometry');
const createLine3D = require('./lib/createLine3D');
const glslify = require('glslify');
const fs = require('fs');

const EffectComposer = require('./lib/EffectComposer');
const CopyShader = require('three-copyshader');
const SSRPass = require('./lib/SSRPass');
const FogPass = require('./lib/FogPass');

const opt = { antialias: false };
const {updateProjectionMatrix, camera, scene, renderer, controls, canvas} = createApp(opt);
renderer.setClearColor('#0d000e', 1);

var genCubeUrls = function (prefix, postfix) {
  return [
    prefix + 'px' + postfix, prefix + 'nx' + postfix,
    prefix + 'py' + postfix, prefix + 'ny' + postfix,
    prefix + 'pz' + postfix, prefix + 'nz' + postfix
  ];
};

const triRepeats = 3;
const map = createTexture('assets/textures/pattern_182/diffuse.png', triRepeats);
const normalMap = createTexture('assets/textures/pattern_182/normal.png', triRepeats);
const specularMap = createTexture('assets/textures/pattern_182/specular.png', triRepeats);

const material = createPBRMaterial({
  map: map,
  normalMap,
  specularMap,
  roughnessMap: null,
  color: 0xffffff,
  // bumpScale: 0.1,
  metalness: 1,
  roughness: 0.75,
  shading: THREE.FlatShading,
})

let hdrUrls = genCubeUrls('assets/pisaHDR/', '.hdr');
let cubeLoader = new THREE.HDRCubeTextureLoader();
cubeLoader.load(THREE.UnsignedByteType, hdrUrls, function (hdrCubeMap) {
  const pmremGenerator = new THREE.PMREMGenerator(hdrCubeMap);
  pmremGenerator.update(renderer);

  const pmremCubeUVPacker = new THREE.PMREMCubeUVPacker(pmremGenerator.cubeLods);
  pmremCubeUVPacker.update(renderer);

  // const envMap = pmremCubeUVPacker.CubeUVRenderTarget;
  const envMap = pmremGenerator.cubeLods[ pmremGenerator.cubeLods.length - 4 ];
  material.envMap = envMap;
  material.needsUpdate = true;

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
const rtInitial = createRenderTarget(false, 2);
const composer = new EffectComposer(renderer, rt1, rt2, rtInitial);
composer.depthTexture = rtDepth;
rtDepth.type = THREE.FloatType;


const depthMaterial = new THREE.MeshDepthMaterial();
depthMaterial.depthPacking = THREE.BasicDepthPacking;
depthMaterial.blending = THREE.NoBlending;

composer.addPass(new EffectComposer.RenderPass(scene, camera));
composer.addPass(new SSRPass(renderer, camera));
// composer.addPass(new FogPass(renderer, camera));

composer.passes[composer.passes.length - 1].renderToScreen = true;

function createPBRMaterial (opts = {}) {
  const material = new THREE.MeshPhysicalMaterial(opts);
  material.shaderOverride = {
    vertexShader: fs.readFileSync(__dirname + '/lib/shader/mesh.vert', 'utf8'),
    fragmentShader: fs.readFileSync(__dirname + '/lib/shader/mesh.frag', 'utf8')
  };
  material.name = 'meshStandard';
  material.extensions = {
    drawBuffers: true,
    derivatives: true
  };
  return material;
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

resize();
window.addEventListener('resize', resize);
createLoop(render).start();

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
  
  
  renderer.setClearColor('#000', 1);
  scene.overrideMaterial = null;
  composer.render();
}

function createTexture (url, repeats = 1) {
  const textureLoader = new THREE.TextureLoader();
  return textureLoader.load(url, function (map) {
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeats, repeats);
  }, (err) => {
    console.error(err);
  });
}

function setupScene (envMap) {
  const repeats = 20;
  const map = createTexture('assets/textures/pattern_143/diffuse.png', repeats);
  const normalMap = createTexture('assets/textures/pattern_143/normal.png', repeats);
  const specularMap = createTexture('assets/textures/pattern_143/specular.png', repeats);

  const skybox = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 32), new THREE.MeshBasicMaterial({
    map: new THREE.TextureLoader().load('assets/Barce_Rooftop_C_8k.jpg'),
    side: THREE.BackSide,
    fog: false
  }));
  scene.add(skybox);

  // const floorGeom = new THREE.PlaneGeometry(100,100,100);
  const floorGeom = new THREE.CircleGeometry(200, 64);
  floorGeom.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  const floorMaterial = createPBRMaterial({
    envMap,
    normalMap,
    specularMap,
    normalScale: new THREE.Vector2(-0.5, -0.5),
    map,
    roughness: 0.65,
    metalness: 1
  });
  const floor = new THREE.Mesh(floorGeom, floorMaterial);
  floor.receiveShadow = true;
  scene.add(floor);

  var ball = new THREE.Mesh(new THREE.SphereGeometry(1,64,64), createPBRMaterial({
    color: 'red',
    roughness: 1,
    envMap,
    metalness: 1,
  }));
  ball.position.x = 10;
  ball.position.y = 1.5;
  ball.scale.multiplyScalar(2);
  scene.add(ball);

  // const geometry = new THREE.IcosahedronGeometry(1, 1);
  // const mesh = new THREE.Mesh(geometry, material);
  // scene.add(mesh);
  // mesh.castShadow = true;
  // mesh.position.y = 1;
  new THREE.JSONLoader().load('assets/pyramid.json', (geometry) => {
    mesh = new THREE.Mesh(geometry, material);
    mesh.scale.multiplyScalar(3);
    scene.add(mesh);
    mesh.castShadow = true;
    mesh.position.y = 1;
  }, (err) => console.error(err));
}
