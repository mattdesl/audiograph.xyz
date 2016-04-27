const EventEmitter = require('events').EventEmitter;

module.exports = function ({ scene, whitePalette, audio, camera, controls, geo }) {
  let previousPalette = geo.getFullPalette();
  const ret = new EventEmitter();
  ret.keyDown = false;
  ret.enable = enable;

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
        ret.emit('start');
        beginEvent();
      }
    });
    window.addEventListener('keyup', (ev) => {
      if (ev.keyCode === 32 && ret.keyDown) {
        endEvent();
        ret.emit('stop');
      }
    });
  }

  function beginEvent () {
    previousPalette = geo.getFullPalette();
    geo.setPalette(whitePalette);
    ret.keyDown = true;
    audio.queue();
    audio.effect = 1;
    controls.position[1] = -1;
  }

  function endEvent () {
    ret.keyDown = false;
    geo.setPalette(previousPalette);
    audio.playQueued();
    audio.effect = 0;
    controls.position[1] = 1;
    geo.globalSpeed = 1;
  }
};
