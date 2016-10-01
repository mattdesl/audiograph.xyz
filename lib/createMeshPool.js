const createTimeline = require('tweenr');
const geoPieceRing = require('geo-piecering');
const geoArc = require('geo-arc');
const shuffle = require('array-shuffle');
const unlerp = require('unlerp');
const newArray = require('new-array');
const createComplex = require('./createComplex');
const PI = Math.PI;
const randomSphere = require('gl-vec2/random');
const glslify = require('glslify');
const random = require('random-float');

module.exports = function ({ camera, totalFingers }) {
  const INITIAL_Y = [ -4, -4 ];
  const HOTSPOT_Y = [ -3, -3 ];
  const BEAT_Y = [ -2, -2 ];
  const LOWEST_Y = INITIAL_Y[0];
  const object3d = new THREE.Object3D();
  const meshesPerEmit = 2;
  const maxMeshesPerFinger = 50;
  const fingerMeshCounts = newArray(totalFingers, 0);
  const totalGeometries = 100;
  const totalMeshes = 750;
  const cameraWorldVector = new THREE.Vector3();
  let time = 0;

  const shaderMat = new THREE.RawShaderMaterial({
    opacity: 1,
    transparent: false,
    uniforms: {
      screenOffset: { type: 'v2', value: new THREE.Vector2() },
      beats: { type: 'v2', value: new THREE.Vector2() },
      iGlobalTime: { type: 'f', value: 0 },
      opacity: { type: 'f', value: 1 },
      animate: { type: 'f', value: 0 },
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

  // gather constant list of geometries
  const geometries = newArray(totalGeometries).map(() => {
    return createGeometry({
      type: random(0, 1) > 0.5 ? 0 : 1
    });
  }).filter(Boolean);

  // gather mesh pool
  const meshes = newArray(totalMeshes).map(createMesh);
  meshes.forEach(m => object3d.add(m));

  camera.localToWorld(cameraWorldVector);

  return {
    object3d,
    update,
    emit
  };

  function findFreeMesh () {
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      if (!m.active) return m;
    }
    return null;
  }

  function emit (screenPosition, palette, type, fingerIndex) {
    updateFingerCounts();

    for (let i = 0; i < meshesPerEmit; i++) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      if (fingerIndex >= 0 && fingerMeshCounts[fingerIndex] >= maxMeshesPerFinger) {
        // we ran out of meshes for this finger
        break;
      }

      const mesh = findFreeMesh();
      mesh.fingerIndex = fingerIndex;
      mesh.screenOffset.copy(screenPosition);
      mesh.material.uniforms.color.value.setStyle(color);
      resetMesh(mesh, type); // reset mesh randomization
      animateInMesh(mesh); // start tweens
    }

    // let sum = 0;
    // for (let i = 0; i < meshes.length; i++) {
    //   const m = meshes[i];
    //   if (m.active) sum++;
    // }
    // console.log(sum, meshes.length)
  }

  function updateFingerCounts () {
    for (let i = 0; i < fingerMeshCounts.length; i++) {
      fingerMeshCounts[i] = 0;
    }
    meshes.forEach(mesh => {
      if (mesh.active && mesh.fingerIndex >= 0 && mesh.fingerIndex <= fingerMeshCounts.length) {
        fingerMeshCounts[mesh.fingerIndex]++;
      }
    });
  }

  function createGeometry (opt) {
    let geometry;
    if (opt.type === 0) {
      const numPieces = Math.floor(random(5, 40));
      const pieceSize = random(0.25, 0.75);
      geometry = createGeom(geoPieceRing({
        y: 0,
        height: random(0.01, 1.0),
        radius: random(0.1, 1.5),
        numPieces: numPieces,
        quadsPerPiece: 1,
        pieceSize: (PI * 2) * 1 / numPieces * pieceSize
      }), opt);
    } else if (opt.type === 1) {
      const radius = random(0, 2);
      geometry = createGeom(geoArc({
        y: 0,
        startRadian: random(-PI, PI),
        endRadian: random(-PI, PI),
        innerRadius: radius,
        outerRadius: radius + random(0.005, 0.15),
        numBands: 2,
        numSlices: 90
      }), opt);
    }
    return geometry;
  }

  function createGeom (complex, opt = {}) {
    if (complex.cells.length === 0) return null;
    return createComplex(complex, opt);
  }

  function createMesh () {
    const geometry = geometries[Math.floor(Math.random() * geometries.length)];
    const material = materials[Math.floor(Math.random() * materials.length)].clone();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.boundingRegion = new THREE.Box3().setFromObject(mesh);
    mesh.screenOffset = new THREE.Vector2();
    mesh.timeline = createTimeline();
    mesh.fingerIndex = -1;
    resetMesh(mesh);
    return mesh;
  }

  function update (dt, width, height, globalSpeed = 1) {
    const timeDelta = dt / 1000 * globalSpeed;
    time += timeDelta;

    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      if (!m.active) continue;

      m.timeline.timeScale = globalSpeed;
      m.material.uniforms.screenOffset.value.copy(m.screenOffset);
      // m.material.uniforms.beats.value.set(beats[0] / 255, beats[1] / 255);
      m.material.uniforms.iGlobalTime.value = time;

      m.position.y += timeDelta * m.speed;
      m.rotationY += timeDelta * m.rotationFactor;

      const meshHeight = m.boundingRegion.max.y - m.boundingRegion.min.y;
      const minY = (LOWEST_Y - meshHeight * 2);
      const maxY = (meshHeight * 2 + cameraWorldVector.y + 5);
      if (m.active && ((m.position.y > maxY ||
          m.position.y < minY))) {
        m.active = false;
        m.visible = false;
      }
    }
  }

  function resetMesh (mesh, type) {
    mesh.rotationFactor = random(-0.5, 0.5);
    mesh.speed = random(0.5, 1);
    mesh.active = false;
    mesh.rotationY = 0;
    let yOff = INITIAL_Y;
    if (type === 'hotspot') yOff = HOTSPOT_Y;
    else if (type === 'beat') yOff = BEAT_Y;
    mesh.position.y = random(yOff[0], yOff[1]);
    mesh.visible = false;
    mesh.material.uniforms.animate.value = 0;
    mesh.material.uniforms.dance.value = Math.random() > 0.5 ? random(0, 1) : 0;
    mesh.material.uniforms.screenOffset.value.copy(mesh.screenOffset);
    mesh.material.uniforms.opacity.value = 0;
    mesh.timeline.cancel();
  }

  function animateInMesh (mesh) {
    mesh.active = true;
    mesh.visible = true;
    mesh.timeline.cancel();

    mesh.material.uniforms.animate.value = 1;
    mesh.material.uniforms.opacity.value = 1;

    const minScale = 1e-10;
    const tween = { value: 0 };
    const scaleDuration = random(0.5, 1.0);
    mesh.scale.set(minScale, minScale, minScale);
    mesh.timeline.to(tween, {
      duration: scaleDuration,
      value: 1,
      ease: 'expoOut'
    }).on('update', () => {
      const value = tween.value;
      mesh.scale.set(value, value, value);
    });

    mesh.timeline.to(mesh.material.uniforms.animate, {
      duration: random(0.5, 1.0),
      value: 0,
      delay: scaleDuration + random(0, 1),
      ease: 'quadOut'
    }).on('complete', () => {
      mesh.active = false;
      mesh.visible = false;
      mesh.fingerIndex = -1;
    });
  }
};
