const random = require('random-float');
const geoPieceRing = require('geo-piecering');
const geoArc = require('geo-arc');
const geoChevron = require('geo-chevron');
const createComplex = require('three-simplicial-complex')(THREE);
const { createPBRMaterial, createTexture } = require('./utils');
const PI = Math.PI;
const INITIAL_Y = [ -20, -5 ];
const RESET_Y = [ -20, -10 ]
const INITIAL_COUNT = 100;

module.exports = function ({ renderer, camera, scene, envMap, loop }) {
  const wireMat = new THREE.MeshBasicMaterial({
    wireframe: true,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide
  });

  const materials = [
    // wireMat,
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide
    })
  ];
  const colors = [ '#000', '#263248', '#7E8AA2', '#FFFFFF', '#FF9800' ];
  const meshes = [];
  
  renderer.setClearColor(colors.shift(), 1);

  function addCore () {
    addGeom(geoPieceRing({
      y: 0,
      height: random(0.01, 1.0),
      radius: random(0.1, 1.5),
      numPieces: Math.floor(random(5, 20)),
      quadsPerPiece: 1,
      pieceSize: (PI * 2) * 1 / random(20, 40)
    }));

    const radius = random(0, 2);
    addGeom(geoArc({
      y: 0,
      startRadian: random(-PI, PI),
      endRadian: random(-PI, PI),
      innerRadius: radius,
      outerRadius: radius + random(0.05, 0.15),
      numBands: 4,
      numSlices: 90,
    }));
  }

  for (var i = 0; i < INITIAL_COUNT; i++) {
    addCore();
  }
  
  // addBasic(new THREE.IcosahedronGeometry(0.25, 0), {});
  // addBasic(new THREE.TetrahedronGeometry(0.25, 0), {});
  
  function addBasic (geom, opt) {
    let mat;
    if (opt.material) {
      mat = opt.material;
    } else {
      mat = materials[Math.floor(Math.random() * materials.length)].clone();
      mat.color = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
    }
    addMesh(geom, mat, {
      mirror: true,
      offset: 2,
    })
  }

  function addGeom (complex, opt) {
    if (complex.cells.length === 0) return;
    opt = opt || {};
    const geom = createComplex(complex);
    let mat;
    if (opt.material) {
      mat = opt.material;
    } else {
      mat = materials[Math.floor(Math.random() * materials.length)].clone();
      mat.color = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
    }
    addMesh(geom, mat, opt);
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
        // m2.rotation.y = -a;
        // m2.rotation.z = -Math.PI;
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
    mesh.speed = random(0, 1);
    mesh.active = true;
    mesh.position.y = random(INITIAL_Y[0], INITIAL_Y[1]);
    return mesh;
  }

  meshes.forEach(m => scene.add(m));
  const time = 0;
  const tmpVec = new THREE.Vector3();
  
  tmpVec.copy(camera.position);
  camera.localToWorld(tmpVec);
  console.log(tmpVec.y)
      
  loop.on('tick', (dt) => {
    meshes.forEach((m) => {
      m.rotation.y += (dt / 1000) * m.rotationFactor;
      m.position.y += (dt / 1000) * m.speed;
      if (m.isGroup) {
        m.children.forEach(child => {
          child.rotation.x += (dt / 1000);
        });
      }
      const meshHeight = m.boundingRegion.max.y - m.boundingRegion.min.y;
      if (m.position.y > (meshHeight + tmpVec.y)) {
        console.log("SKIP")
        m.active = false;
      }
    });
    
    let newMeshes = 0;
    for (let i = meshes.length - 1; i >= 0; i--) {
      if (!meshes[i].active) {
        const mesh = meshes[i];
        mesh.position.y = random(RESET_Y[0], RESET_Y[1]);
        mesh.active = true;
        // mesh.geometry.dispose();
        // scene.remove(mesh);
        // meshes.splice(i, 1);
        // newMeshes++;
      }
    }
    
  });
};
