const tweenr = require('tweenr')();

module.exports = function ({ scene, audio, camera, controls, geo }) {
  let previousPalette = geo.getFullPalette();
  const ret = { keyDown: false };
  const cameraTween = { value: 1 };

  window.addEventListener('keydown', (ev) => {
    if (ev.keyCode === 32 && !ret.keyDown) {
      const palette = [ '#fff', '#c1c1c1', '#606060', '#353535' ];
      previousPalette = geo.getFullPalette();
      geo.setPalette(palette);
      ret.keyDown = true;
      audio.reverb.wet.value = 1;
      audio.reverb.dry.value = 0;
      // tweenr.to(cameraTween, { value: -1, duration: 1, ease: 'expoOut' })
      //   .on('update', () => controls.position[1] = cameraTween.value);
    }
  });
  window.addEventListener('keyup', (ev) => {
    if (ev.keyCode === 32 && ret.keyDown) {
      ret.keyDown = false;
      geo.setPalette(previousPalette);
      // tweenr.to(cameraTween, { value: 1, duration: 1, ease: 'expoOut' })
      //   .on('update', () => controls.position[1] = cameraTween.value);
      audio.reverb.wet.value = 0;
      audio.reverb.dry.value = 1;
    }
  });
  return ret;
};
