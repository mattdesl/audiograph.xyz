const newArray = require('new-array');
const randomSphere = require('gl-vec2/random');
const random = require('random-float');
const createTouch = require('./touchHandler');
const createTimeline = require('tweenr');
const createMeshPool = require('./createMeshPool');

const MAX_TAP_GROUPS = Math.max(1, typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 100);
const noop = () => {};

module.exports = function (opt) {
  const {
    renderer,
    camera,
    scene,
    palettes,
    whitePalette,
    onHotspotDown = noop,
    onHotspotUp = noop
  } = opt;

  const touch = createTouch(renderer.domElement, MAX_TAP_GROUPS);
  const tapGroups = newArray(MAX_TAP_GROUPS).map((_, i) => {
    return {
      index: i,
      active: false,
      palette: palettes[Math.floor(Math.random() * palettes.length)],
      position: new THREE.Vector2()
    };
  });

  const meshPool = createMeshPool({ camera, totalFingers: MAX_TAP_GROUPS });
  scene.add(meshPool.object3d);

  const uiCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  const uiScene = new THREE.Scene();
  const circleGeometry = new THREE.CircleGeometry(0.1, 64, 64);

  const hotspots = [
    { position: [ 0.75, 0.5 ], effect: 'reverb', url: 'assets/images/hotspot-reverb.png' },
    { position: [ -0.75, -0.5 ], effect: 'playbackRate', url: 'assets/images/hotspot-playback.png' }
  ].map((data) => {
    const circleMesh = new THREE.Mesh(
      circleGeometry,
      new THREE.MeshBasicMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        // blending: THREE.CustomBlending,
        // blendSrc: THREE.SrcAlphaFactor,
        // blendDst: THREE.OneMinusSrcAlphaFactor,
        map: new THREE.TextureLoader().load(data.url, (tex) => {
          circleMesh.visible = true;
          circleMesh.scale.set(1, 1 / (tex.image.width / tex.image.height), 1);
          circleMesh.originalScale.copy(circleMesh.scale);
        })
      })
    );
    circleMesh.originalScale = circleMesh.scale.clone();
    circleMesh.timeline = createTimeline();
    circleMesh.visible = false;
    circleMesh.effect = data.effect;
    circleMesh.isPressed = false;
    circleMesh.interactionScale = 1;
    circleMesh.fingerIndex = -1;
    circleMesh.screenPosition = new THREE.Vector2().fromArray(data.position);
    return circleMesh;
  });
  hotspots.forEach(m => uiScene.add(m));

  const tmpMouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  touch.on('start', (finger, index, ev) => {
    const hit = getHit(finger.position);
    if (hit) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!hit.object.isPressed) {
        hit.object.isPressed = true;
        hit.object.fingerIndex = index;
        animateHotspot(hit.object, true);
        onHotspotDown(hit.object);
      }
    } else {
      const group = tapGroups[index];
      group.active = true;
      group.palette = palettes[Math.floor(Math.random() * palettes.length)];
      normalizeMouse(finger.position, group.position);
      meshPool.emit(group.position, group.palette, false, index);
    }
  });
  touch.on('move', (finger, index) => {
    const group = tapGroups[index];
    if (group.active) {
      normalizeMouse(finger.position, group.position);
    }
  });
  touch.on('end', (finger, index, ev) => {
    let prevent = false;
    hotspots.forEach(m => {
      if (m.isPressed && m.fingerIndex === index) {
        prevent = true;
        m.fingerIndex = -1;
        m.isPressed = false;
        animateHotspot(m, false);
        onHotspotUp(m);
      }
    });
    if (prevent) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    tapGroups[index].active = false;
  });

  const api = {
    globalSpeed: 1,
    uiCamera,
    uiScene,
    update,
    resize
  };

  let nextBeat = false;
  setInterval(() => {
    const type = nextBeat ? 'beat' : 'normal';
    tapGroups.forEach((group, i) => {
      if (group.active) {
        meshPool.emit(group.position, group.palette, type, i);
      }
    });
    nextBeat = false;
  }, 150);
  setupIdleState();

  return api;

  function update (dt, beats) {
    const size = renderer.getSize();
    const width = size.width;
    const height = size.height;

    if (beats[1]) {
      nextBeat = true;
    }

    hotspots.forEach(m => {
      m.scale.copy(m.originalScale).multiplyScalar(m.interactionScale);
    });
    meshPool.update(dt, width, height, api.globalSpeed, beats);
  }

  function setupIdleState () {
    const randomDuration = () => random(500, 1000);
    const tick = () => {
      const hotspot = hotspots[Math.floor(Math.random() * hotspots.length)];
      meshPool.emit(hotspot.screenPosition, whitePalette, 'hotspot', -1);
    };
    const next = () => {
      setTimeout(() => {
        tick();
        next();
      }, randomDuration());
    };
    next();
  }

  function animateHotspot (mesh, isDown) {
    const maxScale = 1.15;
    const minScale = 1;
    mesh.timeline.cancel()
      .to(mesh, {
        interactionScale: isDown ? maxScale : minScale,
        duration: 0.5,
        ease: 'expoOut'
      });
  }

  function getHit (position) {
    const size = renderer.getSize();
    tmpMouse.x = (position[0] / size.width) * 2 - 1;
    tmpMouse.y = -(position[1] / size.height) * 2 + 1;
    raycaster.setFromCamera(tmpMouse, uiCamera);
    var hit = raycaster.intersectObjects(uiScene.children);
    return (hit && hit.length > 0) ? hit[0] : null;
  }

  function resize (width, height) {
    const xAspect = width > height ? 1 : (width / height);
    const yAspect = width > height ? (height / width) : 1;

    hotspots.forEach(mesh => {
      mesh.position.x = mesh.screenPosition.x;
      mesh.position.y = mesh.screenPosition.y;
      mesh.position.x *= xAspect;
      mesh.position.y *= yAspect;
    });

    uiCamera.scale.set(1 * xAspect, 1 * yAspect, 1);
    uiCamera.updateProjectionMatrix();
  }

  function normalizeMouse (positionArray, outVector) {
    const size = renderer.getSize();
    outVector.x = positionArray[0] / size.width * 2 - 1;
    outVector.y = ((size.height - positionArray[1]) / size.height) * 2 - 1;
    return outVector;
  }
};
