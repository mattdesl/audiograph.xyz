const EventEmitter = require('events').EventEmitter;
const keycode = require('keycode');

module.exports = function ({ scene, whitePalette, audio, camera, controls, geo }) {
  let previousPalette = geo.getFullPalette();
  const ret = new EventEmitter();
  ret.keyDown = false;
  ret.enable = enable;

  const trackContainer = document.querySelector('.track-aligner');
  const trackName = document.querySelector('.track-name');
  const trackNumber = document.querySelector('.track-number');

  // if (/(Android|iPhone|iPod|iPad)/i.test(navigator.userAgent)) {
  //   window.addEventListener('touchstart', () => {
  //     beginEvent();
  //   });
  //   window.addEventListener('touchend', () => {
  //     endEvent();
  //   });
  // } else {
  //   audio.queue();
  // }
  return ret;
  
  function enable () {
    window.addEventListener('keydown', (ev) => {
      if (ev.keyCode === 32 && !ret.keyDown) {
        beginEvent();
      }
    });
    window.addEventListener('keyup', (ev) => {
      if (ev.keyCode === 32 && ret.keyDown) {
        endEvent();
      }
    });
  }

  function beginEvent () {
    ret.emit('start');
    previousPalette = geo.getFullPalette();
    geo.setPalette(whitePalette);
    ret.keyDown = true;
    const name = audio.queue();
    setupName(name);
    audio.effect = 1;
    controls.position[1] = -1;
  }

  function endEvent () {
    ret.keyDown = false;
    setupName(null);
    geo.setPalette(previousPalette);
    audio.playQueued();
    audio.effect = 0;
    controls.position[1] = 1;
    geo.globalSpeed = 1;
    ret.emit('stop');
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
