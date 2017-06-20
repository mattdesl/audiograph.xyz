const EventEmitter = require('events').EventEmitter;
const isMobile = require('./isMobile');
const log = require('./log');

module.exports = function ({ scene, whitePalette, audio, camera, controls, geo }) {
  let previousPalette = geo.getFullPalette();
  const ret = new EventEmitter();
  let enabled = false;
  let attached = false;
  ret.keyDown = false;
  ret.easterEggDown = false;
  ret.enable = enable;
  ret.disable = () => {
    ret.keyDown = false;
    enabled = false;
  };
  let isLoaded = false;

  const originalDistance = controls.distance;

  return ret;

  function enable () {
    enabled = true;
    if (attached) {
      return;
    }

    attached = true;
    log.easterEgg();
    window.addEventListener('keydown', (ev) => {
      if (!enabled) return;
      if (ev.keyCode === 32 && !ret.keyDown) {
        beginEvent();
        return false;
      } else if (ev.keyCode === 67 && !ret.easterEggDown) {
        // ret.easterEggDown = true;
        // controls.position[0] = 10;
        // controls.position[2] = 0;
        // controls.distance = 5;
        // return false;
      }
    });
    window.addEventListener('keyup', (ev) => {
      if (!enabled) return;
      if (ev.keyCode === 32 && ret.keyDown) {
        endEvent();
        return false;
      } else if (ev.keyCode === 67 && ret.easterEggDown) {
        // ret.easterEggDown = false;
        // controls.position[0] = 0;
        // controls.position[2] = 0;
        // controls.distance = originalDistance;
        // return false;
      }
    });

    if (isMobile) {
      const canvas = document.querySelector('#canvas');
      canvas.addEventListener('touchstart', beginEvent);
      canvas.addEventListener('touchend', endEvent);
    }
  }

  function beginEvent () {
    if (!enabled) return;
    ret.emit('start');
    previousPalette = geo.getFullPalette();
    geo.setPalette(whitePalette);
    ret.keyDown = true;
    
    isLoaded = false;
    audio.once('ready', () => {
      isLoaded = true;
    });
    const name = audio.queue();
    setupName(name);
    audio.effect = 1;
    geo.globalSpeed = 0.75;
    controls.position[1] = -1;
  }

  function endEvent () {
    if (!enabled) return;
    ret.keyDown = false;
    setupName(null);
    audio.playQueued();
    audio.effect = 0;
    controls.position[1] = 1;
    controls.distance = originalDistance;
    geo.globalSpeed = 1;
    ret.emit('stop', isLoaded);
  }

  function setupName (name) {
  }
};
