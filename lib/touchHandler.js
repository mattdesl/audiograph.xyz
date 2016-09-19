const EventEmitter = require('events').EventEmitter;
const eventOffset = require('mouse-event-offset');
const newArray = require('new-array');
const createDesktopTouch = require('touches');
const copy = require('gl-vec2/copy');

module.exports = function (target, maxFingers) {
  const emitter = new EventEmitter();
  const fingers = newArray(maxFingers).map(() => new Finger());
  enable();
  emitter.fingers = fingers;
  return emitter;

  function enable () {
    if ('ontouchstart' in window) {
      target.addEventListener('touchstart', onTouchStart, false);
      target.addEventListener('touchmove', onTouchMove, false);
      target.addEventListener('touchend', onTouchRemoved, false);
      target.addEventListener('touchcancel', onTouchRemoved, false);
    } else {
      const touches = createDesktopTouch(target, {
        filtered: true,
        type: 'mouse'
      });
      touches.on('start', (ev, position) => {
        fingers[0].active = true;
        copy(fingers[0].position, position);
        emitter.emit('start', fingers[0], 0, ev);
      }).on('move', (ev, position) => {
        fingers[0].active = true;
        copy(fingers[0].position, position);
        emitter.emit('move', fingers[0], 0, ev);
      }).on('end', (ev, position) => {
        fingers[0].active = false;
        copy(fingers[0].position, position);
        emitter.emit('end', fingers[0], 0, ev);
      });
    }
  }

  function onTouchStart (ev) {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      const newTouch = ev.changedTouches[i];
      const id = newTouch.identifier;
      let idx = indexOfTouch(id);
      let finger;
      if (idx === -1) {
        // new finger
        idx = findInactive();
        if (idx === -1) continue; // no left, skip
        finger = fingers[idx];
        finger.touch = newTouch;
      } else {
        // existing finger
        finger = fingers[idx];
      }
      finger.active = true;
      eventOffset(newTouch, target, finger.position);
      emitter.emit('start', finger, idx, ev);
    }
  }

  function onTouchMove (ev) {
    let changed = false;
    for (let i = 0; i < ev.changedTouches.length; i++) {
      var movedTouch = ev.changedTouches[i];
      var idx = indexOfTouch(movedTouch);
      if (idx !== -1) {
        changed = true;
        fingers[idx].touch = movedTouch; // avoid caching touches
        fingers[idx].active = true; // should already be true...
        eventOffset(movedTouch, target, fingers[idx].position);
        emitter.emit('move', fingers[idx], idx, ev);
      }
    }
  }

  function onTouchRemoved (ev) {
    let changed = false;
    for (let i = 0; i < ev.changedTouches.length; i++) {
      let removed = ev.changedTouches[i];
      let idx = indexOfTouch(removed);

      if (idx !== -1) {
        changed = true;
        fingers[idx].active = false;
        emitter.emit('end', fingers[idx], idx, ev);
      }
    }
  }

  function indexOfTouch (touch) {
    const id = touch.identifier;
    for (let i = 0; i < fingers.length; i++) {
      if (fingers[i] &&
        fingers[i].touch &&
        fingers[i].touch.identifier === id) {
        return i;
      }
    }
    return -1;
  }

  function findInactive () {
    for (let i = 0; i < fingers.length; i++) {
      if (!fingers[i].active) {
        return i;
      }
    }
    return -1;
  }
};

function Finger () {
  this.position = [0, 0];
  this.active = false;
  this.touch = null;
}
