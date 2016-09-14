const random = require('random-float');
const geoPieceRing = require('geo-piecering');
const geoArc = require('geo-arc');
const shuffle = require('array-shuffle');
const unlerp = require('unlerp');
const newArray = require('new-array');
const createComplex = require('./createComplex');
const PI = Math.PI;
const randomSphere = require('gl-vec2/random');
const tweenr = require('tweenr')();
const glslify = require('glslify');
const isMobile = require('./isMobile');
const createTouch = require('touches');

const INITIAL_Y = [ -10, -4 ]
const LOWEST_Y = INITIAL_Y[0];

const PARTS_PER_BUCKET = 50;
const ADDITIONAL_PARTS = 1;
const MAX_TAP_GROUPS = 4;

module.exports = function ({ renderer, camera, scene, palettes, envMap, loop }) {
  const touch = createTouch(renderer.canvas, { filtered: true });

  const shaderMat = new THREE.RawShaderMaterial({
    opacity: 1,
    transparent: true,
    uniforms: {
      screenOffset: { type: 'v2', value: new THREE.Vector2() },
      iGlobalTime: { type: 'f', value: 0 },
      aspect: { type: 'f', value: 1 },
      opacity: { type: 'f', value: 1 },
      resolution: { type: 'v2', value: new THREE.Vector2() },
      color: { type: 'c', value: new THREE.Color() },
      dance: { type: 'f', value: 0 }
    },
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: glslify('./shader/shape.vert'),
    fragmentShader: glslify('./shader/shape.frag'),
    side: THREE.DoubleSide
  });

  const shaderMatWire = shaderMat.clone();
  shaderMatWire.wireframe = true;

  const materials = [
    shaderMat,
    shaderMatWire
  ];

  const tapGroups = newArray(MAX_TAP_GROUPS).map((_, i) => {
    return {
      index: i,
      active: false,
      palette: palettes[Math.floor(Math.random() * palettes.length)],
      position: new THREE.Vector3().fromArray(randomSphere([], 0.5))
    };
  });

  // list of all meshes
  let meshes = [];

  // create a set of parts for each touch point
  for (let bucket = 0; bucket < MAX_TAP_GROUPS; bucket++) {
    for (let i = 0; i < PARTS_PER_BUCKET; i++) {
      addCore({
        tapGroup: tapGroups[bucket],
        active: false,
        type: Math.random() > 0.5 ? 0 : 1
      });
    }
  }

  // shuffle so order of availabaility doesn't matter
  meshes = shuffle(meshes);

  let time = 0;
  const tmpVec = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  tmpVec.copy(camera.position);
  camera.localToWorld(tmpVec);

  touch.on('start', (ev, pos) => {
    const index = ev.metaKey ? 1 : 0;
    const group = tapGroups[index];
    group.active = true;
    group.palette = palettes[Math.floor(Math.random() * palettes.length)];
    normalizeMouse(pos, group.position);
  });
  touch.on('move', (ev, pos) => {
    const index = ev.metaKey ? 1 : 0;
    const group = tapGroups[index];
    if (group.active) {
      normalizeMouse(pos, group.position);
    }
  });
  touch.on('end', (ev, pos) => {
    const index = ev.metaKey ? 1 : 0;
    tapGroups[index].active = false;
  });

  const api = {
    setPalette,
    setBackground,
    randomizeMaterials,
    globalSpeed: 1,
    clearGeometry
  };

  setInterval(() => {
    tapGroups.forEach(group => {
      if (group.active) {
        nextGeometry(group.index);
      }
    });
  }, 50);

  loop.on('tick', (dt) => {
    const size = renderer.getSize();
    const width = size.width;
    const height = size.height;
    time += dt / 1000;

    meshes.forEach((m) => {
      m.time += dt / 1000;

      if (m.material.uniforms) {
        m.material.uniforms.aspect.value = width / height;
        m.material.uniforms.screenOffset.value.copy(m.screenOffset);
        m.material.uniforms.resolution.value.set(width, height);
        m.material.uniforms.iGlobalTime.value = time;
      }
      m.position.y += (dt / 1000) * m.speed * api.globalSpeed;
      m.rotationY += (dt / 1000) * m.rotationFactor;

      if (m.isGroup) {
        m.children.forEach(child => {
          child.rotation.x += (dt / 1000);
        });
      }

      const meshHeight = m.boundingRegion.max.y - m.boundingRegion.min.y;
      const minY = (LOWEST_Y - meshHeight * 2);
      const maxY = (meshHeight * 2 + tmpVec.y + 5);
      const opacity = 1 - m.time / m.duration;
      if (m.material.uniforms) {
        m.material.uniforms.opacity.value = opacity;
      }
      if (m.active && (m.time > m.duration ||
          (m.position.y > maxY ||
          m.position.y < minY))) {
        m.active = false;
        m.visible = false;
      }
    });
  });

  return api;

  function normalizeMouse (positionArray, outVector) {
    const size = renderer.getSize();
    outVector.x = positionArray[0] / size.width * 2 - 1;
    outVector.y = ((size.height - positionArray[1]) / size.height) * 2 - 1;
    return outVector;
  }

  function randomizeMaterials () {
    meshes.forEach(m => {
      tmpColor.copy(getColor(m));
      m.material = materials[Math.floor(Math.random() * materials.length)].clone();
      setColor(m, tmpColor);
    });
  }

  function clearGeometry () {
    meshes.forEach(m => {
      m.active = false;
      m.visible = false;
    });
  }

  function setPalette (palette, withBackground) {
    // colors.length = 0;
    // currentColors.length = 0;

    // colors = palette.slice();
    // if (withBackground) setBackground(colors.shift());
    // currentColors = colors.slice();
    // // console.log("New colors", currentColors);

    // meshes.forEach(m => {
    //   setRandColor(m);
    // });
  }

  function nextGeometry (tapGroupIndex) {
    for (let i = 0, count = 0; i < meshes.length && count < ADDITIONAL_PARTS; i++) {
      const m = meshes[i];

      if (!m.active && tapGroupIndex === m.tapGroup.index) {
        resetMesh(m);
        count++;
      }
    }
  }

  function resetMesh (mesh, opt = {}) {
    const yOff = INITIAL_Y;
    mesh.position.y = random(yOff[0], yOff[1]);
    mesh.active = true;
    mesh.time = 0;
    mesh.screenOffset = mesh.tapGroup.position.clone();
    mesh.duration = randomDuration();
    mesh.visible = true;
    if (mesh.material.uniforms) {
      mesh.material.uniforms.dance.value = Math.random() > 0.5 ? random(0, 1) : 0;
    }
    setRandColor(mesh);
    if (opt.animate !== false) {
      const minScale = 1e-10;
      const tween = { value: 0 };
      mesh.scale.set(minScale, minScale, minScale);
      tweenr.to(tween, { duration: 0.5, value: 1, ease: 'expoOut' })
        .on('update', () => {
          const value = tween.value;
          // mesh.material.uniforms.opacity.value = value;
          mesh.scale.set(value, value, value);
        });
    }
  }

  function addCore (opt = {}) {
    let mesh;
    if (opt.type === 0) {
      const numPieces = Math.floor(random(5, 40));
      const pieceSize = random(0.25, 0.75);
      mesh = addGeom(geoPieceRing({
        y: 0,
        height: random(0.01, 1.0),
        radius: random(0.1, 1.5),
        numPieces: numPieces,
        quadsPerPiece: 1,
        pieceSize: (PI * 2) * 1 / numPieces * pieceSize
      }), opt);
    } else if (opt.type === 1) {
      const radius = random(0, 2);
      mesh = addGeom(geoArc({
        y: 0,
        startRadian: random(-PI, PI),
        endRadian: random(-PI, PI),
        innerRadius: radius,
        outerRadius: radius + random(0.005, 0.15),
        numBands: 2,
        numSlices: 90
      }), opt);
    }

    if (mesh && !opt.active) {
      mesh.active = false;
      mesh.visible = false;
    }
    if (mesh) mesh.type = opt.type;
    return mesh;
  }

  function addGeom (complex, opt = {}) {
    if (complex.cells.length === 0) return null;
    const geom = createComplex(complex, opt);
    if (!geom) return;
    let mat = materials[Math.floor(Math.random() * materials.length)].clone();
    const mesh = addMesh(geom, mat, opt);
    setRandColor(mesh);
    return mesh;
  }

  function addMesh (geom, mat, opt) {
    let mesh = new THREE.Mesh(geom, mat);
    if (opt.mirror) {
      const offset = opt.offset || 0;
      const group = new THREE.Object3D();
      const mirrorCount = 4;
      for (var i = 0; i < mirrorCount; i++) {
        const a = PI * 2 * (i / mirrorCount);
        const m2 = mesh.clone();
        m2.position.x = Math.cos(a) * offset;
        m2.position.z = Math.sin(a) * offset;
        group.add(m2);
      }
      meshes.push(group);
      mesh = group;
      mesh.isGroup = true;
    } else {
      meshes.push(mesh);
    }
    mesh.boundingRegion = new THREE.Box3().setFromObject(mesh);
    mesh.rotationFactor = random(-0.5, 0.5);
    mesh.speed = random(0.8, 1);
    mesh.active = true;
    mesh.rotationY = 0;
    mesh.rotationX = -Math.PI / 2;
    mesh.tapGroup = opt.tapGroup;
    mesh.duration = randomDuration();
    mesh.time = 0;
    mesh.screenOffset = mesh.tapGroup.position.clone();
    mesh.position.y = random(INITIAL_Y[0], INITIAL_Y[1]);
    scene.add(mesh);
    return mesh;
  }

  function randColor (mesh) {
    const meshPalette = mesh.tapGroup.palette;
    return meshPalette[Math.floor(Math.random() * meshPalette.length)];
  }

  function setRandColor (mesh) {
    var mat = mesh.material;
    if (mat.color) mat.color.setStyle(randColor(mesh));
    else mat.uniforms.color.value.setStyle(randColor(mesh));
  }

  function setColor (mesh, color) {
    var mat = mesh.material;
    if (mat.color) mat.color.copy(color);
    else mat.uniforms.color.value.copy(color);
  }

  function getColor (mesh) {
    var mat = mesh.material;
    if (mat.color) return mat.color;
    else return mat.uniforms.color.value;
  }

  function setBackground (color) {
    renderer.setClearColor(color, 1);
    document.body.style.background = color;
  }

  function randomDuration () {
    return random(1, 5);
  }
};
