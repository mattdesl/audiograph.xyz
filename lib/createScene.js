const newArray = require('new-array');
const randomSphere = require('gl-vec2/random');
const isMobile = require('./isMobile');
const createTouch = require('./touchHandler');
const createMeshPool = require('./createMeshPool');

const MAX_TAP_GROUPS = 100;
const noop = () => {};

module.exports = function ({ renderer, camera, scene, palettes, whitePalette, loop, onHotspotDown = noop, onHotspotUp = noop }) {
  const touch = createTouch(renderer.domElement, MAX_TAP_GROUPS);

  const tapGroups = newArray(MAX_TAP_GROUPS).map((_, i) => {
    return {
      index: i,
      active: false,
      palette: palettes[Math.floor(Math.random() * palettes.length)],
      position: new THREE.Vector3().fromArray(randomSphere([], 0.5))
    };
  });

  const meshPool = createMeshPool({ camera });
  scene.add(meshPool.object3d);

  const circleGeometry = new THREE.CircleGeometry(0.15, 64, 64);
  const circleMesh = new THREE.Mesh(
    circleGeometry,
    new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      map: new THREE.TextureLoader().load('assets/images/hotspot.png', (tex) => {
      })
    })
  );
  circleMesh.position.x = 0.25;
  scene.add(circleMesh);

  const tmpMouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let isHotspotDown = false;
  const isHit = (position) => {
    const size = renderer.getSize();
    tmpMouse.x = (position[0] / size.width) * 2 - 1;
    tmpMouse.y = -(position[1] / size.height) * 2 + 1;
    raycaster.setFromCamera(tmpMouse, camera);
    var hit = raycaster.intersectObject(circleMesh);
    return hit && hit.length > 0;
  };

  touch.on('start', (finger, index, ev) => {
    if (isHit(finger.position)) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!isHotspotDown) {
        isHotspotDown = true;
        onHotspotDown();
      }
    } else {
      const group = tapGroups[index];
      group.active = true;
      group.palette = palettes[Math.floor(Math.random() * palettes.length)];
      normalizeMouse(finger.position, group.position);
      meshPool.emit(group.position, group.palette);
    }
  });
  touch.on('move', (finger, index) => {
    const group = tapGroups[index];
    if (group.active) {
      normalizeMouse(finger.position, group.position);
    }
  });
  touch.on('end', (finger, index, ev) => {
    if (isHotspotDown) {
      isHotspotDown = false;
      ev.preventDefault();
      ev.stopPropagation();
      onHotspotUp();
    } else {
      tapGroups[index].active = false;
    }
  });

  const api = {
    globalSpeed: 1
  };

  setInterval(() => {
    tapGroups.forEach(group => {
      if (group.active) {
        meshPool.emit(group.position, group.palette);
      }
    });
  }, 100);

  loop.on('tick', (dt) => {
    const size = renderer.getSize();
    const width = size.width;
    const height = size.height;

    circleMesh.quaternion.copy(camera.quaternion);
    meshPool.update(dt, width, height, api.globalSpeed);
  });

  return api;

  function normalizeMouse (positionArray, outVector) {
    const size = renderer.getSize();
    outVector.x = positionArray[0] / size.width * 2 - 1;
    outVector.y = ((size.height - positionArray[1]) / size.height) * 2 - 1;
    return outVector;
  }
};
