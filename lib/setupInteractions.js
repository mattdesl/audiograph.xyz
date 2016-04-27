module.exports = function ({ scene, whitePalette, audio, camera, controls, geo }) {
  let previousPalette = geo.getFullPalette();
  const ret = { keyDown: false };

  window.addEventListener('keydown', (ev) => {
    if (ev.keyCode === 32 && !ret.keyDown) {
      previousPalette = geo.getFullPalette();
      geo.setPalette(whitePalette);
      ret.keyDown = true;
      audio.effect = 1;
      controls.position[1] = -1;
      audio.element.src = audio.playlists[Math.floor(Math.random() * audio.playlists.length)];
      audio.element.load();
    }
  });
  window.addEventListener('keyup', (ev) => {
    if (ev.keyCode === 32 && ret.keyDown) {
      ret.keyDown = false;
      geo.setPalette(previousPalette);
      audio.effect = 0;
      controls.position[1] = 1;
      geo.globalSpeed = 1;
      
      audio.element.play();
    }
  });
  return ret;
};
