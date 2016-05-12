const EventEmitter = require('events').EventEmitter;
const isMobile = require('./isMobile');
const log = require('./log');

module.exports = function ({ scene, whitePalette, audio, camera, controls, geo }) {
  let previousPalette = geo.getFullPalette();
  const ret = new EventEmitter();
  ret.keyDown = false;
  ret.easterEggDown = false;
  ret.enable = enable;
  let isLoaded = false;

  const originalDistance = controls.distance;
  const trackContainer = document.querySelector('.track-aligner');
  const trackName = document.querySelector('.track-name');
  const trackNumber = document.querySelector('.track-number');

  return ret;

  function enable () {
    log.easterEgg();
    window.addEventListener('keydown', (ev) => {
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
    ret.keyDown = false;
    setupName(null);
    geo.setPalette(previousPalette);
    audio.playQueued();
    audio.effect = 0;
    controls.position[1] = 1;
    controls.distance = originalDistance;
    geo.globalSpeed = 1;
    geo.nextPalette();
    ret.emit('stop', isLoaded);
  }

  function setupName (name) {
    if (!name) {
      trackContainer.style.display = 'none';
      return;
    }
    trackContainer.style.display = 'table';

    const parts = name.split('-').map(x => x.trim());
    trackNumber.textContent = 'next track';
    trackName.textContent = parts[1];
  }
};
